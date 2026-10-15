use std::{collections::HashMap, path::PathBuf, sync::Arc, time::SystemTime};

use axum::{
    Json, Router,
    body::Body,
    extract::{Query, State},
    http::{StatusCode, header::CONTENT_TYPE},
    response::Response,
    routing::{get, post},
};
use dkb_dashboard_api::{
    app::{self, AppState},
    auth::Authenticator,
    config::Config,
    middleware::RateLimiter,
    rules::RuleStore,
};
use jsonwebtoken::{Algorithm, EncodingKey, Header, encode};
use serde::Serialize;
use serde_json::{Value, json};
use sqlx::PgPool;
use tokio::{net::TcpListener, task::JoinHandle};

const KEY_ID: &str = "integration-test-key";
const TEST_CLIENT_ID: &str = "integration-test-client";
const PRIVATE_KEY: &str = "-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEAzln5J+PImdxjSSyGnFZgA+R/2Lvgzac9WMvCZheLpjOV5WZN
cT0TYU+xo5gjIJta3WLeAdLQJce2mBBnZrFvlAAFdmyYT1JVSLe6G/Se+0dQ9RLe
3qNAbKBuJie19XIJ/Id/NCH32gXh9DWATfo/rb1JOyKvp2rysqU95zyeQozdtHFo
OaQQLmoolj3xAELHTzYefHJlOrrm3Q4SNSH49wzrM1Z4wIRSJZIGBWVhEeH9kkYj
1zoeGhn1SeHc2Y2iEGUHHLL6hE2Q02zmHEYVxQDbf8iFnTMC5fILta5GfsgUKaKb
HcfVO4aUQrkDuKRlv444Nw7Ib744IDBIjShYkwIDAQABAoIBABevoYyVS5lzABKO
LIVq2hVC9/SGMa++2qkupQnYT2IB2droe0sxmjU5U0gBVpw6OPE16rXa36RL4Fxk
GvphXlARZeR0t/xNlGyHFQh7Hnn0HbQujlaP9qfWt84Ou4beUuHMdoAixghzVGnB
GmaDqyY47AcAXEP4tWhm1KGOW7ws/8YLF8UO4dYwJ8ZmMHwCxPBJzvOKYf0fZRxj
ziA4ZJZRAjiR0RbZroZLpzlUPHKjDN7AXbpOO4oqAxgwx9jkYGpXTe6JINBTWGVA
9RTjM4ZCEIXOyOk82ZjbJ9z1jq/9Stn6P/1IU45kHqdL3PJx9SSudKkFEu8PIuzo
qH8998ECgYEA7S8ErP208IG5kfThZa2qYWJNo5UX3J58lmN4ssoWXAMYLFKCkWCo
Vl4jjqeWkHnjEcE1jq/rntpbrTF1tZmT7g/+QSkzTW8mx+pDI2B8HkXkQSPqzgf8
V9EWqgrrr8v6AJNk3Hbk9gZZ97G0smN7K/eEdcuQTT2+gfn857x2qH0CgYEA3rjI
AevwtDzpSNFYf6HMXUqDDLwz9YZTeS7Gp20AYNS61INmxK+fi0CYv50feYOYNhPz
ByH/zRjlTkg0nUGOTcWycqCWS2NqjIsC7owi+fzhNFzMEJsY/OxnMxwCttDjfLKn
N7nARLUj0aDnIkrDJfQzXfrRG9wr7dJRgQi84k8CgYBkZZuoEjht+atwUeS64nkV
gcP1c13HYDrCedaUb6BpUFICKObl3LFE5dJNRzkfbMimMk+WV3b4Jdvagu4dcaXB
hnmMYYE6zMrwooPKzMOdGN6WiDqS/aReE75xOfAr2L65UarG+3jNf0DD7S/ctulj
YgFqz0EEwRcL86KPASKFDQKBgGxfOyr8ND5vWRAOlWJdR0SpqgS7WwkAGIPhx9XV
yxZSzKn1Wj8gOaCXiPvLp3IIHztJD7sLxx10HLevmLJgIK8lIER4cUkzkbfbOEz8
sVQ0wRwqfz0hStJe8YRD/+oW0Gpvv7/0yWJlRY2OHoloGXbRUWFMVw2YX2O0L+Z6
avYvAoGBANvg8lxPcJ15rdhyausC3UnDglxc4aN5mt/ufmQG2cDeMqTyRdw7bTif
GnDN4rjE0dEBlczEYryxyrvNihVW3S9Ni8j5vlK6y7/nw2v+671gWlTIPTfSOEQE
9YEhOI84OaAdAfioZWueTWAPP7PtQI27DmBAkByrC2m0S0r0vlWp
-----END RSA PRIVATE KEY-----";

const PUBLIC_MODULUS: &str = "zln5J-PImdxjSSyGnFZgA-R_2Lvgzac9WMvCZheLpjOV5WZNcT0TYU-xo5gjIJta3WLeAdLQJce2mBBnZrFvlAAFdmyYT1JVSLe6G_Se-0dQ9RLe3qNAbKBuJie19XIJ_Id_NCH32gXh9DWATfo_rb1JOyKvp2rysqU95zyeQozdtHFoOaQQLmoolj3xAELHTzYefHJlOrrm3Q4SNSH49wzrM1Z4wIRSJZIGBWVhEeH9kkYj1zoeGhn1SeHc2Y2iEGUHHLL6hE2Q02zmHEYVxQDbf8iFnTMC5fILta5GfsgUKaKbHcfVO4aUQrkDuKRlv444Nw7Ib744IDBIjShYkw";

#[derive(Clone)]
struct OidcState {
    issuer: String,
}

pub struct OidcStub {
    pub issuer: String,
    task: JoinHandle<()>,
}

impl OidcStub {
    pub async fn start() -> Self {
        let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
        let address = listener.local_addr().unwrap();
        let issuer = format!("http://{address}");
        let state = OidcState {
            issuer: issuer.clone(),
        };
        let router = Router::new()
            .route("/.well-known/openid-configuration", get(discovery))
            .route("/jwks", get(jwks))
            .with_state(state);
        let task = tokio::spawn(async move {
            axum::serve(listener, router).await.unwrap();
        });
        Self { issuer, task }
    }
}

impl Drop for OidcStub {
    fn drop(&mut self) {
        self.task.abort();
    }
}

#[derive(Clone, Debug)]
pub enum ProviderMode {
    Valid,
    Text(String),
    EmptyCandidates,
    MissingText,
    MalformedJson,
    Status(StatusCode),
}

#[derive(Clone, Debug)]
pub struct ProviderRequest {
    pub api_key: Option<String>,
    pub body: Value,
}

#[derive(Clone)]
struct ProviderState {
    mode: Arc<std::sync::Mutex<ProviderMode>>,
    requests: Arc<std::sync::Mutex<Vec<ProviderRequest>>>,
}

pub struct ProviderStub {
    pub base_url: String,
    state: ProviderState,
    task: JoinHandle<()>,
}

impl ProviderStub {
    pub async fn start() -> Self {
        let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
        let address = listener.local_addr().unwrap();
        let state = ProviderState {
            mode: Arc::new(std::sync::Mutex::new(ProviderMode::Valid)),
            requests: Arc::new(std::sync::Mutex::new(Vec::new())),
        };
        let router = Router::new()
            .route(
                "/v1beta/models/integration-test-model:generateContent",
                post(generate_content),
            )
            .with_state(state.clone());
        let task = tokio::spawn(async move {
            axum::serve(listener, router).await.unwrap();
        });
        Self {
            base_url: format!("http://{address}"),
            state,
            task,
        }
    }

    pub fn set_mode(&self, mode: ProviderMode) {
        *self.state.mode.lock().unwrap() = mode;
    }

    pub fn requests(&self) -> Vec<ProviderRequest> {
        self.state.requests.lock().unwrap().clone()
    }
}

impl Drop for ProviderStub {
    fn drop(&mut self) {
        self.task.abort();
    }
}

async fn generate_content(
    Query(query): Query<HashMap<String, String>>,
    State(state): State<ProviderState>,
    Json(body): Json<Value>,
) -> Response {
    state.requests.lock().unwrap().push(ProviderRequest {
        api_key: query.get("key").cloned(),
        body,
    });
    let mode = state.mode.lock().unwrap().clone();
    match mode {
        ProviderMode::Valid => provider_json(valid_provider_response()),
        ProviderMode::Text(text) => provider_json(json!({
            "candidates": [{"content": {"parts": [{"text": text}]}}]
        })),
        ProviderMode::EmptyCandidates => provider_json(json!({"candidates": []})),
        ProviderMode::MissingText => provider_json(json!({
            "candidates": [{"content": {"parts": [{}]}}]
        })),
        ProviderMode::MalformedJson => Response::builder()
            .status(StatusCode::OK)
            .header(CONTENT_TYPE, "application/json")
            .body(Body::from("{not-json"))
            .unwrap(),
        ProviderMode::Status(status) => Response::builder()
            .status(status)
            .header(CONTENT_TYPE, "application/json")
            .body(Body::from(
                r#"{"error":"integration test provider failure"}"#,
            ))
            .unwrap(),
    }
}

fn provider_json(value: Value) -> Response {
    let body = serde_json::to_vec(&value).unwrap();
    Response::builder()
        .status(StatusCode::OK)
        .header(CONTENT_TYPE, "application/json")
        .body(Body::from(body))
        .unwrap()
}

fn valid_provider_response() -> Value {
    json!({
        "candidates": [{
            "content": {
                "parts": [{
                    "text": "[{\"keyword\":\"REWE Markt\",\"category\":\"groceries\",\"column\":\"recipient\",\"confidence\":0.95},{\"keyword\":\"Lebensmittel\",\"category\":\"groceries\",\"column\":\"purpose\",\"confidence\":0.4}]"
                }]
            }
        }]
    })
}

async fn discovery(State(state): State<OidcState>) -> Json<Value> {
    Json(json!({
        "issuer": state.issuer,
        "jwks_uri": format!("{}/jwks", state.issuer),
    }))
}

async fn jwks() -> Json<Value> {
    Json(json!({
        "keys": [{
            "kty": "RSA",
            "kid": KEY_ID,
            "use": "sig",
            "alg": "RS256",
            "n": PUBLIC_MODULUS,
            "e": "AQAB"
        }]
    }))
}

#[derive(Serialize)]
struct Claims {
    exp: usize,
    iat: usize,
    iss: String,
    sub: String,
    azp: String,
}

pub fn token(issuer: &str, subject: &str) -> String {
    token_variant(issuer, subject, 3600, TEST_CLIENT_ID, KEY_ID)
}

pub fn token_variant(
    issuer: &str,
    subject: &str,
    expiry_offset: i64,
    authorized_party: &str,
    key_id: &str,
) -> String {
    let now = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap()
        .as_secs() as usize;
    let mut header = Header::new(Algorithm::RS256);
    header.kid = Some(key_id.into());
    encode(
        &header,
        &Claims {
            exp: if expiry_offset.is_negative() {
                now.saturating_sub(expiry_offset.unsigned_abs() as usize)
            } else {
                now.saturating_add(expiry_offset as usize)
            },
            iat: now,
            iss: issuer.into(),
            sub: subject.into(),
            azp: authorized_party.into(),
        },
        &EncodingKey::from_rsa_pem(PRIVATE_KEY.as_bytes()).unwrap(),
    )
    .unwrap()
}

pub fn tampered_token(issuer: &str, subject: &str) -> String {
    let mut value = token(issuer, subject);
    let separator = value.rfind('.').unwrap();
    value.insert(separator + 1, 'A');
    value
}

pub struct ApiServer {
    pub base_url: String,
    pub store: RuleStore,
    task: JoinHandle<()>,
}

impl Drop for ApiServer {
    fn drop(&mut self) {
        self.task.abort();
    }
}

pub async fn start_api(pool: PgPool, issuer: String) -> ApiServer {
    start_api_with_options(
        pool,
        issuer,
        "http://127.0.0.1:9".into(),
        None,
        500,
        262_144,
        10,
    )
    .await
}

pub async fn start_api_with_provider(
    pool: PgPool,
    issuer: String,
    provider: &ProviderStub,
) -> ApiServer {
    start_api_with_options(
        pool,
        issuer,
        provider.base_url.clone(),
        Some("integration-test-provider-key".into()),
        500,
        262_144,
        10,
    )
    .await
}

pub async fn start_api_with_options(
    pool: PgPool,
    issuer: String,
    provider_base_url: String,
    gemini_api_key: Option<String>,
    max_transactions: usize,
    max_request_bytes: usize,
    classification_requests_per_minute: usize,
) -> ApiServer {
    let client = reqwest::Client::builder().build().unwrap();
    let store = RuleStore::from_pool(pool);
    let config = Config {
        bind: "127.0.0.1:0".into(),
        frontend_dir: PathBuf::from("frontend/dist"),
        keycloak_issuer: issuer.clone(),
        keycloak_client_id: TEST_CLIENT_ID.into(),
        keycloak_audience: None,
        gemini_api_key,
        gemini_api_base_url: provider_base_url,
        gemini_model: "integration-test-model".into(),
        database_url: "postgres://integration-test".into(),
        legacy_rule_store_path: None,
        allowed_origins: vec!["http://localhost:8080".into()],
        allowed_hosts: vec!["127.0.0.1".into(), "localhost".into()],
        public_api_base_url: String::new(),
        max_transactions,
        max_request_bytes,
        classification_requests_per_minute,
    };
    let state = AppState {
        config: Arc::new(config),
        store: store.clone(),
        auth: Authenticator::new(client.clone(), issuer, TEST_CLIENT_ID.into(), None),
        client,
        limiter: Arc::new(RateLimiter::new(classification_requests_per_minute)),
    };
    let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
    let address = listener.local_addr().unwrap();
    let task = tokio::spawn(async move {
        axum::serve(listener, app::router(state)).await.unwrap();
    });
    ApiServer {
        base_url: format!("http://{address}"),
        store,
        task,
    }
}
