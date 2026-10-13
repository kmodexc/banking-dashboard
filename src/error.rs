use axum::{Json, http::StatusCode, response::IntoResponse};
use serde_json::json;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("unauthorized")]
    Unauthorized,
    #[error("service unavailable")]
    ServiceUnavailable,
    #[error("request body too large")]
    RequestTooLarge,
    #[error("too many requests")]
    RateLimited,
    #[error("invalid request: {0}")]
    BadRequest(String),
    #[error("classification provider unavailable")]
    ProviderUnavailable,
    #[error("classification provider returned invalid data")]
    ProviderInvalid,
    #[error("database operation failed")]
    Database(#[source] sqlx::Error),
    #[error("internal server error")]
    Internal(#[source] anyhow::Error),
}

impl IntoResponse for AppError {
    fn into_response(self) -> axum::response::Response {
        let (status, detail) = match &self {
            Self::Unauthorized => (
                StatusCode::UNAUTHORIZED,
                "Authentication required".to_owned(),
            ),
            Self::ServiceUnavailable => (
                StatusCode::SERVICE_UNAVAILABLE,
                "Service unavailable".to_owned(),
            ),
            Self::RequestTooLarge => (
                StatusCode::PAYLOAD_TOO_LARGE,
                "Request body too large".to_owned(),
            ),
            Self::RateLimited => (
                StatusCode::TOO_MANY_REQUESTS,
                "Classification rate limit exceeded".to_owned(),
            ),
            Self::BadRequest(detail) => (StatusCode::UNPROCESSABLE_ENTITY, detail.clone()),
            Self::ProviderUnavailable => (
                StatusCode::BAD_GATEWAY,
                "Classification provider unavailable".to_owned(),
            ),
            Self::ProviderInvalid => (
                StatusCode::BAD_GATEWAY,
                "Classification provider returned invalid data".to_owned(),
            ),
            Self::Database(error) => {
                tracing::error!(error = ?error, "database operation failed");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Internal server error".to_owned(),
                )
            }
            Self::Internal(error) => {
                tracing::error!(error = ?error, "internal server error");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Internal server error".to_owned(),
                )
            }
        };

        let mut response = (status, Json(json!({ "detail": detail }))).into_response();
        if matches!(self, Self::Unauthorized) {
            response.headers_mut().insert(
                axum::http::header::WWW_AUTHENTICATE,
                axum::http::HeaderValue::from_static("Bearer"),
            );
        }
        if matches!(self, Self::RateLimited) {
            response.headers_mut().insert(
                axum::http::header::RETRY_AFTER,
                axum::http::HeaderValue::from_static("60"),
            );
        }
        response
    }
}

impl From<sqlx::Error> for AppError {
    fn from(error: sqlx::Error) -> Self {
        Self::Database(error)
    }
}
