use std::{
    collections::{HashMap, VecDeque},
    sync::Mutex,
    time::{Duration, Instant},
};

use axum::{
    extract::{Request, State},
    http::{
        HeaderValue, StatusCode,
        header::{CONTENT_LENGTH, HOST},
    },
    middleware::Next,
    response::{IntoResponse, Response},
};

use crate::{app::AppState, error::AppError};

pub struct RateLimiter {
    limit: usize,
    events: Mutex<HashMap<String, VecDeque<Instant>>>,
}

impl RateLimiter {
    pub fn new(limit: usize) -> Self {
        Self {
            limit,
            events: Mutex::new(HashMap::new()),
        }
    }

    pub fn allow(&self, key: &str) -> bool {
        let now = Instant::now();
        let Ok(mut events) = self.events.lock() else {
            return false;
        };
        let history = events.entry(key.to_owned()).or_default();
        while history
            .front()
            .is_some_and(|timestamp| now.duration_since(*timestamp) >= Duration::from_secs(60))
        {
            history.pop_front();
        }
        if history.len() >= self.limit {
            return false;
        }
        history.push_back(now);
        if events.len() > 10_000 {
            events.retain(|_, values| {
                values.back().is_some_and(|timestamp| {
                    now.duration_since(*timestamp) < Duration::from_secs(60)
                })
            });
        }
        true
    }
}

pub async fn request_limits(
    State(state): State<AppState>,
    request: Request,
    next: Next,
) -> Response {
    if request.uri().path() == "/api/classify"
        && let Some(value) = request
            .headers()
            .get(CONTENT_LENGTH)
            .and_then(|value| value.to_str().ok())
            .and_then(|value| value.parse::<usize>().ok())
        && value > state.config.max_request_bytes
    {
        return AppError::RequestTooLarge.into_response();
    }
    next.run(request).await
}

pub async fn host_check(State(state): State<AppState>, request: Request, next: Next) -> Response {
    let allowed = request
        .headers()
        .get(HOST)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.split(':').next())
        .is_some_and(|host| {
            state
                .config
                .allowed_hosts
                .iter()
                .any(|allowed| allowed == host)
        });
    if !allowed {
        return StatusCode::BAD_REQUEST.into_response();
    }
    next.run(request).await
}

pub async fn security_headers(
    State(state): State<AppState>,
    request: Request,
    next: Next,
) -> Response {
    let forwarded_https = request
        .headers()
        .get("x-forwarded-proto")
        .and_then(|value| value.to_str().ok())
        .is_some_and(|value| value.eq_ignore_ascii_case("https"));
    let mut response = next.run(request).await;
    let connect_sources = [
        "'self'",
        state.config.keycloak_issuer.as_str(),
        state.config.public_api_base_url.as_str(),
    ]
    .iter()
    .filter_map(|value| {
        url::Url::parse(value).ok().map(|url| {
            let port = url
                .port()
                .map(|port| format!(":{port}"))
                .unwrap_or_default();
            format!(
                "{}://{}{}",
                url.scheme(),
                url.host_str().unwrap_or_default(),
                port
            )
        })
    })
    .collect::<Vec<_>>()
    .join(" ");
    let csp = format!(
        "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; connect-src 'self' {connect_sources}; form-action 'self'; img-src 'self' data:; style-src 'self'; script-src 'self';"
    );
    let headers = response.headers_mut();
    headers.insert(
        "x-content-type-options",
        HeaderValue::from_static("nosniff"),
    );
    headers.insert("x-frame-options", HeaderValue::from_static("DENY"));
    headers.insert("referrer-policy", HeaderValue::from_static("no-referrer"));
    headers.insert(
        "permissions-policy",
        HeaderValue::from_static("camera=(), microphone=(), geolocation=()"),
    );
    if let Ok(value) = HeaderValue::from_str(&csp) {
        headers.insert("content-security-policy", value);
    }
    if forwarded_https {
        headers.insert(
            "strict-transport-security",
            HeaderValue::from_static("max-age=31536000; includeSubDomains"),
        );
    }
    response
}

#[cfg(test)]
mod tests {
    use super::RateLimiter;

    #[test]
    fn rate_limiter_rejects_requests_after_the_configured_limit() {
        let limiter = RateLimiter::new(2);
        assert!(limiter.allow("user-a"));
        assert!(limiter.allow("user-a"));
        assert!(!limiter.allow("user-a"));
        assert!(limiter.allow("user-b"));
    }
}
