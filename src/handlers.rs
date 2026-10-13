use axum::{
    body::Body,
    extract::{Json, Query, State},
    http::{StatusCode, header::CONTENT_TYPE},
    response::{IntoResponse, Response},
};
use serde::Deserialize;

use crate::{
    app::AppState,
    auth::AuthUser,
    classifier,
    error::AppError,
    models::{
        ClassificationRequest, ConfigResponse, GLOBAL_CATEGORIES, RuleCollection,
        RuleCollectionResponse,
    },
};

pub async fn healthz() -> impl IntoResponse {
    (StatusCode::OK, Json(serde_json::json!({"status": "ok"})))
}

pub async fn config_js(State(state): State<AppState>) -> Response {
    let config = ConfigResponse {
        keycloak_issuer: state.config.keycloak_issuer.clone(),
        keycloak_client_id: state.config.keycloak_client_id.clone(),
        api_base_url: state.config.public_api_base_url.clone(),
    };
    let body = format!(
        "window.APP_CONFIG = {};",
        serde_json::to_string(&config).unwrap_or_else(|_| "{}".into())
    );
    Response::builder()
        .status(StatusCode::OK)
        .header(CONTENT_TYPE, "application/javascript")
        .header("cache-control", "no-store")
        .body(Body::from(body))
        .expect("valid config response")
}

pub async fn classify(
    State(state): State<AppState>,
    user: AuthUser,
    Json(request): Json<ClassificationRequest>,
) -> Result<Json<crate::models::ClassificationResponse>, AppError> {
    request
        .validate(state.config.max_transactions)
        .map_err(AppError::BadRequest)?;
    if !state.limiter.allow(&user.subject) {
        return Err(AppError::RateLimited);
    }
    let response = classifier::classify(
        &state.client,
        state.config.gemini_api_key.as_deref(),
        &state.config.gemini_model,
        &request,
        state.config.max_transactions,
    )
    .await?;
    Ok(Json(response))
}

#[derive(Debug, Deserialize)]
pub struct RuleQuery {
    #[serde(default)]
    pub include_community: bool,
}

pub async fn get_rules(
    State(state): State<AppState>,
    user: AuthUser,
    Query(query): Query<RuleQuery>,
) -> Result<Json<RuleCollectionResponse>, AppError> {
    let private = state.store.private(&user.subject).await?;
    let community = if query.include_community {
        state.store.community().await?
    } else {
        Vec::new()
    };
    Ok(Json(RuleCollectionResponse { private, community }))
}

pub async fn replace_private(
    State(state): State<AppState>,
    user: AuthUser,
    Json(collection): Json<RuleCollection>,
) -> Result<Json<RuleCollectionResponse>, AppError> {
    collection.validate().map_err(AppError::BadRequest)?;
    state
        .store
        .replace_private(&user.subject, &collection.rules)
        .await?;
    Ok(Json(RuleCollectionResponse {
        private: collection.rules,
        community: Vec::new(),
    }))
}

pub async fn delete_private(
    State(state): State<AppState>,
    user: AuthUser,
) -> Result<Json<RuleCollectionResponse>, AppError> {
    state.store.replace_private(&user.subject, &[]).await?;
    Ok(Json(RuleCollectionResponse {
        private: Vec::new(),
        community: Vec::new(),
    }))
}

pub async fn add_community(
    State(state): State<AppState>,
    user: AuthUser,
    Json(collection): Json<RuleCollection>,
) -> Result<Json<RuleCollectionResponse>, AppError> {
    collection.validate().map_err(AppError::BadRequest)?;
    if let Some(category) = collection
        .rules
        .iter()
        .map(|rule| rule.category.as_str())
        .find(|category| !GLOBAL_CATEGORIES.contains(category))
    {
        return Err(AppError::BadRequest(format!(
            "Community rules may only use global categories: {category}"
        )));
    }
    let community = state
        .store
        .add_community(&user.subject, &collection.rules)
        .await?;
    Ok(Json(RuleCollectionResponse {
        private: Vec::new(),
        community,
    }))
}

pub async fn delete_community(
    State(state): State<AppState>,
    user: AuthUser,
) -> Result<Json<RuleCollectionResponse>, AppError> {
    state.store.remove_community(&user.subject).await?;
    Ok(Json(RuleCollectionResponse {
        private: Vec::new(),
        community: Vec::new(),
    }))
}
