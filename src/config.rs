use std::{env, path::PathBuf};

use anyhow::{Context, Result, anyhow, bail};

#[derive(Clone, Debug)]
pub struct Config {
    pub bind: String,
    pub frontend_dir: PathBuf,
    pub keycloak_issuer: String,
    pub keycloak_client_id: String,
    pub keycloak_audience: Option<String>,
    pub gemini_api_key: Option<String>,
    pub gemini_api_base_url: String,
    pub gemini_model: String,
    pub database_url: String,
    pub legacy_rule_store_path: Option<PathBuf>,
    pub allowed_origins: Vec<String>,
    pub allowed_hosts: Vec<String>,
    pub public_api_base_url: String,
    pub max_transactions: usize,
    pub max_request_bytes: usize,
    pub classification_requests_per_minute: usize,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        dotenvy::dotenv().ok();
        let keycloak_issuer = env::var("KEYCLOAK_ISSUER")
            .unwrap_or_default()
            .trim_end_matches('/')
            .to_owned();
        if !keycloak_issuer.is_empty() {
            let parsed = url::Url::parse(&keycloak_issuer).context("KEYCLOAK_ISSUER is invalid")?;
            if !matches!(parsed.scheme(), "http" | "https") || parsed.host_str().is_none() {
                bail!("KEYCLOAK_ISSUER must be an absolute HTTP(S) URL");
            }
            if parsed.scheme() != "https"
                && !matches!(
                    parsed.host_str(),
                    Some("localhost" | "127.0.0.1" | "::1" | "host.docker.internal" | "oidc")
                )
            {
                bail!("KEYCLOAK_ISSUER must use HTTPS outside local development");
            }
        }

        let allowed_origins = csv_env("ALLOWED_ORIGINS", "http://localhost:8080");
        if allowed_origins.iter().any(|value| value == "*") {
            bail!("ALLOWED_ORIGINS must list explicit origins");
        }
        let allowed_hosts = csv_env("ALLOWED_HOSTS", "localhost,127.0.0.1");
        if allowed_hosts.is_empty() || allowed_hosts.iter().any(|value| value == "*") {
            bail!("ALLOWED_HOSTS must list explicit hosts");
        }

        let database_url =
            normalize_database_url(&env::var("DATABASE_URL").context("DATABASE_URL is required")?);
        if database_url.is_empty() {
            bail!("DATABASE_URL must not be empty");
        }
        let max_transactions = positive_env("MAX_CLASSIFICATION_TRANSACTIONS", 500)?;
        if max_transactions > 500 {
            bail!("MAX_CLASSIFICATION_TRANSACTIONS must not exceed 500");
        }
        let max_request_bytes = positive_env("MAX_CLASSIFICATION_REQUEST_BYTES", 262_144)?;
        let classification_requests_per_minute =
            positive_env("CLASSIFICATION_REQUESTS_PER_MINUTE", 10)?;

        Ok(Self {
            bind: format!(
                "0.0.0.0:{}",
                env::var("PORT").unwrap_or_else(|_| "8080".into())
            ),
            frontend_dir: PathBuf::from(
                env::var("FRONTEND_DIR").unwrap_or_else(|_| "frontend/dist".into()),
            ),
            keycloak_issuer,
            keycloak_client_id: env::var("KEYCLOAK_CLIENT_ID").unwrap_or_default(),
            keycloak_audience: optional_env("KEYCLOAK_AUDIENCE"),
            gemini_api_key: optional_env("GEMINI_API_KEY"),
            gemini_api_base_url: env::var("GEMINI_API_BASE_URL")
                .unwrap_or_else(|_| "https://generativelanguage.googleapis.com".into()),
            gemini_model: env::var("GEMINI_MODEL")
                .unwrap_or_else(|_| "gemini-3.1-flash-lite".into()),
            database_url,
            legacy_rule_store_path: optional_env("LEGACY_RULE_STORE_PATH").map(PathBuf::from),
            allowed_origins,
            allowed_hosts,
            public_api_base_url: env::var("PUBLIC_API_BASE_URL").unwrap_or_default(),
            max_transactions,
            max_request_bytes,
            classification_requests_per_minute,
        })
    }
}

fn csv_env(name: &str, default: &str) -> Vec<String> {
    env::var(name)
        .unwrap_or_else(|_| default.to_owned())
        .split(',')
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .collect()
}

fn optional_env(name: &str) -> Option<String> {
    env::var(name)
        .ok()
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty())
}

fn positive_env(name: &str, default: usize) -> Result<usize> {
    let value = env::var(name).unwrap_or_else(|_| default.to_string());
    let parsed = value
        .parse::<usize>()
        .with_context(|| format!("{name} must be a positive integer"))?;
    if parsed == 0 {
        bail!("{name} must be positive");
    }
    Ok(parsed)
}

fn normalize_database_url(value: &str) -> String {
    value
        .trim()
        .strip_prefix("postgresql+psycopg://")
        .map_or_else(
            || value.trim().to_owned(),
            |rest| format!("postgresql://{rest}"),
        )
}

pub fn parse_bind(value: &str) -> Result<std::net::SocketAddr> {
    value
        .parse()
        .map_err(|error| anyhow!("invalid bind address {value}: {error}"))
}
