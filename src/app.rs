use std::sync::Arc;

use axum::{
    Router,
    http::{HeaderValue, Method},
    middleware as axum_middleware,
    routing::{get, post},
};
use tokio::net::TcpListener;
use tower_http::{
    cors::{AllowOrigin, Any, CorsLayer},
    services::{ServeDir, ServeFile},
    trace::TraceLayer,
};

use crate::{
    auth::Authenticator,
    config::Config,
    handlers,
    middleware::{self, RateLimiter},
    rules::RuleStore,
};

#[derive(Clone)]
pub struct AppState {
    pub config: Arc<Config>,
    pub store: RuleStore,
    pub client: reqwest::Client,
    pub auth: Authenticator,
    pub limiter: Arc<RateLimiter>,
}

pub fn router(state: AppState) -> Router {
    let origins = state
        .config
        .allowed_origins
        .iter()
        .filter_map(|origin| origin.parse::<HeaderValue>().ok())
        .collect::<Vec<_>>();
    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::list(origins))
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE])
        .allow_headers(Any);
    let fallback = ServeDir::new(&state.config.frontend_dir)
        .fallback(ServeFile::new(state.config.frontend_dir.join("index.html")));
    Router::new()
        .route("/healthz", get(handlers::healthz))
        .route("/readyz", get(handlers::readyz))
        .route("/config.js", get(handlers::config_js))
        .route("/api/classify", post(handlers::classify))
        .route(
            "/api/rules",
            get(handlers::get_rules)
                .put(handlers::replace_private)
                .delete(handlers::delete_private),
        )
        .route(
            "/api/community/rules",
            post(handlers::add_community).delete(handlers::delete_community),
        )
        .fallback_service(fallback)
        .layer(axum_middleware::from_fn_with_state(
            state.clone(),
            middleware::request_limits,
        ))
        .layer(axum_middleware::from_fn_with_state(
            state.clone(),
            middleware::security_headers,
        ))
        .layer(axum_middleware::from_fn_with_state(
            state.clone(),
            middleware::host_check,
        ))
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

pub async fn serve(state: AppState) -> anyhow::Result<()> {
    let address = crate::config::parse_bind(&state.config.bind)?;
    let listener = TcpListener::bind(address).await?;
    tracing::info!(address = %address, "Rust API listening");
    axum::serve(listener, router(state)).await?;
    Ok(())
}
