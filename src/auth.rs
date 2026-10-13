use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use axum::{
    extract::FromRequestParts,
    http::{header::AUTHORIZATION, request::Parts},
};
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use jsonwebtoken::{Algorithm, DecodingKey, Validation, decode, decode_header};
use reqwest::Client;
use serde::Deserialize;

use crate::{app::AppState, error::AppError};

#[derive(Clone)]
pub struct Authenticator {
    client: Client,
    issuer: String,
    client_id: String,
    audience: Option<String>,
    cache: Arc<Mutex<Option<CachedJwks>>>,
}

struct CachedJwks {
    fetched_at: Instant,
    keys: serde_json::Value,
}

#[derive(Debug, Deserialize)]
struct Discovery {
    issuer: String,
    jwks_uri: String,
}

#[derive(Debug, Deserialize)]
struct Claims {
    exp: usize,
    iat: usize,
    iss: String,
    sub: String,
    azp: Option<String>,
}

#[derive(Clone, Debug)]
pub struct AuthUser {
    pub subject: String,
}

impl Authenticator {
    pub fn new(
        client: Client,
        issuer: String,
        client_id: String,
        audience: Option<String>,
    ) -> Self {
        Self {
            client,
            issuer,
            client_id,
            audience,
            cache: Arc::new(Mutex::new(None)),
        }
    }

    async fn authenticate(&self, token: &str) -> Result<AuthUser, AppError> {
        if self.issuer.is_empty() || self.client_id.is_empty() {
            return Err(AppError::ServiceUnavailable);
        }
        let header = decode_header(token).map_err(|_| AppError::Unauthorized)?;
        if header.alg != Algorithm::RS256 {
            return Err(AppError::Unauthorized);
        }
        let kid = header.kid.ok_or(AppError::Unauthorized)?;
        let jwk = self.jwk(&kid).await?;
        let decoding_key = rsa_key(&jwk).ok_or(AppError::Unauthorized)?;
        let mut validation = Validation::new(Algorithm::RS256);
        validation.set_issuer(std::slice::from_ref(&self.issuer));
        validation.required_spec_claims.insert("iat".to_owned());
        validation.required_spec_claims.insert("sub".to_owned());
        if let Some(audience) = &self.audience {
            validation.set_audience(std::slice::from_ref(audience));
        } else {
            validation.validate_aud = false;
        }
        let claims = decode::<Claims>(token, &decoding_key, &validation)
            .map_err(|error| {
                tracing::info!(error = ?error, "rejected access token");
                AppError::Unauthorized
            })?
            .claims;
        if claims.azp.as_deref() != Some(self.client_id.as_str()) || claims.sub.trim().is_empty() {
            return Err(AppError::Unauthorized);
        }
        let _ = (claims.exp, claims.iat, claims.iss);
        Ok(AuthUser {
            subject: claims.sub,
        })
    }

    async fn jwk(&self, kid: &str) -> Result<serde_json::Value, AppError> {
        if let Some(key) = self.cached_keys(kid) {
            return Ok(key);
        }
        let discovery = self
            .client
            .get(format!("{}/.well-known/openid-configuration", self.issuer))
            .timeout(Duration::from_secs(5))
            .send()
            .await
            .map_err(|error| {
                tracing::error!(error = ?error, "Keycloak discovery failed");
                AppError::ServiceUnavailable
            })?
            .error_for_status()
            .map_err(|error| {
                tracing::error!(error = ?error, "Keycloak discovery failed");
                AppError::ServiceUnavailable
            })?
            .json::<Discovery>()
            .await
            .map_err(|error| {
                tracing::error!(error = ?error, "Keycloak discovery response was invalid");
                AppError::ServiceUnavailable
            })?;
        if discovery.issuer.trim_end_matches('/') != self.issuer {
            tracing::error!("Keycloak discovery issuer does not match configuration");
            return Err(AppError::ServiceUnavailable);
        }
        let issuer_url = url::Url::parse(&self.issuer).map_err(|_| AppError::ServiceUnavailable)?;
        let jwks_url =
            url::Url::parse(&discovery.jwks_uri).map_err(|_| AppError::ServiceUnavailable)?;
        if issuer_url.scheme() != jwks_url.scheme() || issuer_url.host_str() != jwks_url.host_str()
        {
            tracing::error!("Keycloak JWKS host does not match configured issuer");
            return Err(AppError::ServiceUnavailable);
        }
        let keys = self
            .client
            .get(jwks_url)
            .timeout(Duration::from_secs(5))
            .send()
            .await
            .map_err(|_| AppError::ServiceUnavailable)?
            .error_for_status()
            .map_err(|_| AppError::ServiceUnavailable)?
            .json::<serde_json::Value>()
            .await
            .map_err(|_| AppError::ServiceUnavailable)?;
        let key = keys
            .get("keys")
            .and_then(serde_json::Value::as_array)
            .and_then(|keys| {
                keys.iter()
                    .find(|key| key.get("kid").and_then(serde_json::Value::as_str) == Some(kid))
            })
            .cloned()
            .ok_or(AppError::Unauthorized)?;
        if let Ok(mut cache) = self.cache.lock() {
            *cache = Some(CachedJwks {
                fetched_at: Instant::now(),
                keys,
            });
        }
        Ok(key)
    }

    fn cached_keys(&self, kid: &str) -> Option<serde_json::Value> {
        let cache = self.cache.lock().ok()?;
        let cached = cache.as_ref()?;
        if cached.fetched_at.elapsed() >= Duration::from_secs(300) {
            return None;
        }
        cached
            .keys
            .get("keys")
            .and_then(serde_json::Value::as_array)
            .and_then(|keys| {
                keys.iter()
                    .find(|key| key.get("kid").and_then(serde_json::Value::as_str) == Some(kid))
            })
            .cloned()
    }
}

impl FromRequestParts<AppState> for AuthUser {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let value = parts
            .headers
            .get(AUTHORIZATION)
            .and_then(|header| header.to_str().ok())
            .and_then(|value| {
                value
                    .strip_prefix("Bearer ")
                    .or_else(|| value.strip_prefix("bearer "))
            })
            .ok_or(AppError::Unauthorized)?;
        state.auth.authenticate(value).await
    }
}

fn rsa_key(jwk: &serde_json::Value) -> Option<DecodingKey> {
    if jwk.get("kty")?.as_str()? != "RSA" {
        return None;
    }
    let modulus = URL_SAFE_NO_PAD.decode(jwk.get("n")?.as_str()?).ok()?;
    let exponent = URL_SAFE_NO_PAD.decode(jwk.get("e")?.as_str()?).ok()?;
    Some(DecodingKey::from_rsa_raw_components(&modulus, &exponent))
}
