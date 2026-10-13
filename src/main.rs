mod app;
mod auth;
mod classifier;
mod config;
mod error;
mod handlers;
mod middleware;
mod models;
mod rules;

use std::sync::Arc;

use anyhow::Context;
use app::{AppState, serve};
use auth::Authenticator;
use config::Config;
use middleware::RateLimiter;
use rules::RuleStore;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            std::env::var("RUST_LOG")
                .unwrap_or_else(|_| "dkb_dashboard_api=info,tower_http=info".into()),
        )
        .with_target(false)
        .init();
    let config = Arc::new(Config::from_env()?);
    let client = reqwest::Client::builder()
        .user_agent("dkb-dashboard-api/0.1")
        .build()
        .context("could not create HTTP client")?;
    let store =
        RuleStore::connect(&config.database_url, config.legacy_rule_store_path.clone()).await?;
    let auth = Authenticator::new(
        client.clone(),
        config.keycloak_issuer.clone(),
        config.keycloak_client_id.clone(),
        config.keycloak_audience.clone(),
    );
    let state = AppState {
        limiter: Arc::new(RateLimiter::new(config.classification_requests_per_minute)),
        config,
        store,
        client,
        auth,
    };
    serve(state).await
}
