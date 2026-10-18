mod support;

use serde_json::json;
use sqlx::PgPool;
use support::{
    ApiServer, OidcStub, ProviderMode, ProviderStub, start_api, start_api_with_options,
    start_api_with_provider, tampered_token, token, token_variant,
};

async fn server(pool: PgPool) -> (OidcStub, ApiServer, reqwest::Client) {
    let oidc = OidcStub::start().await;
    let api = start_api(pool, oidc.issuer.clone()).await;
    (oidc, api, reqwest::Client::new())
}

fn rules() -> serde_json::Value {
    json!({
        "rules": [
            {"keyword": "REWE", "category": "groceries", "column": "recipient", "confidence": 0.9},
            {"keyword": "Miete", "category": "rent", "column": "purpose"}
        ]
    })
}

#[sqlx::test(migrations = "./db/rust-migrations")]
async fn authenticated_private_rules_round_trip_through_http(pool: PgPool) {
    let (oidc, api, client) = server(pool).await;
    let bearer = token(&oidc.issuer, "user-a");

    let put = client
        .put(format!("{}/api/rules", api.base_url))
        .header("host", "127.0.0.1")
        .bearer_auth(&bearer)
        .json(&rules())
        .send()
        .await
        .unwrap();
    assert_eq!(put.status(), reqwest::StatusCode::OK);
    let put_body: serde_json::Value = put.json().await.unwrap();
    assert_eq!(put_body["private"].as_array().unwrap().len(), 2);
    assert!(put_body["community"].as_array().unwrap().is_empty());

    let get = client
        .get(format!("{}/api/rules", api.base_url))
        .header("host", "127.0.0.1")
        .bearer_auth(&bearer)
        .send()
        .await
        .unwrap();
    assert_eq!(get.status(), reqwest::StatusCode::OK);
    let get_body: serde_json::Value = get.json().await.unwrap();
    assert_eq!(
        get_body["private"],
        json!([
            {"keyword": "Miete", "category": "rent", "column": "purpose"},
            {"keyword": "REWE", "category": "groceries", "column": "recipient", "confidence": 0.9}
        ])
    );
    assert!(get_body["community"].as_array().unwrap().is_empty());

    let saved = api.store.private("user-a").await.unwrap();
    assert_eq!(saved.len(), 2);

    let delete = client
        .delete(format!("{}/api/rules", api.base_url))
        .header("host", "127.0.0.1")
        .bearer_auth(&bearer)
        .send()
        .await
        .unwrap();
    assert_eq!(delete.status(), reqwest::StatusCode::OK);
    assert!(api.store.private("user-a").await.unwrap().is_empty());
}

#[sqlx::test(migrations = "./db/rust-migrations")]
async fn private_categories_round_trip_by_stable_id(pool: PgPool) {
    let (oidc, api, client) = server(pool).await;
    let bearer = token(&oidc.issuer, "user-a");
    let categories = json!({
        "categories": [
            {"id": "category-1", "name": "Food", "aliases": ["groceries"]}
        ],
        "deletedIds": []
    });

    let put = client
        .put(format!("{}/api/rules", api.base_url))
        .header("host", "127.0.0.1")
        .bearer_auth(&bearer)
        .json(&json!({"rules": [], "categories": categories}))
        .send()
        .await
        .unwrap();
    assert_eq!(put.status(), reqwest::StatusCode::OK);

    let get = client
        .get(format!("{}/api/rules", api.base_url))
        .header("host", "127.0.0.1")
        .bearer_auth(&bearer)
        .send()
        .await
        .unwrap();
    assert_eq!(get.status(), reqwest::StatusCode::OK);
    let body: serde_json::Value = get.json().await.unwrap();
    assert_eq!(body["categories"], categories);
}

#[sqlx::test(migrations = "./db/rust-migrations")]
async fn private_budgets_round_trip_and_stay_user_scoped(pool: PgPool) {
    let (oidc, api, client) = server(pool).await;
    let user_a = token(&oidc.issuer, "user-a");
    let user_b = token(&oidc.issuer, "user-b");
    let budgets = json!({
        "budgets": {
            "defaults": {"Food": 450.50},
            "monthly": {"2026-02": {"Food": 500.0, "Travel": 900.0}}
        }
    });

    let put = client
        .put(format!("{}/api/budgets", api.base_url))
        .header("host", "127.0.0.1")
        .bearer_auth(&user_a)
        .json(&budgets)
        .send()
        .await
        .unwrap();
    assert_eq!(put.status(), reqwest::StatusCode::OK);

    let get = client
        .get(format!("{}/api/budgets", api.base_url))
        .header("host", "127.0.0.1")
        .bearer_auth(&user_a)
        .send()
        .await
        .unwrap();
    assert_eq!(get.status(), reqwest::StatusCode::OK);
    assert_eq!(get.json::<serde_json::Value>().await.unwrap(), budgets);

    let other_user = client
        .get(format!("{}/api/budgets", api.base_url))
        .header("host", "127.0.0.1")
        .bearer_auth(&user_b)
        .send()
        .await
        .unwrap();
    assert_eq!(other_user.status(), reqwest::StatusCode::OK);
    assert_eq!(
        other_user.json::<serde_json::Value>().await.unwrap(),
        json!({"budgets": null})
    );

    let delete = client
        .delete(format!("{}/api/budgets", api.base_url))
        .header("host", "127.0.0.1")
        .bearer_auth(&user_a)
        .send()
        .await
        .unwrap();
    assert_eq!(delete.status(), reqwest::StatusCode::OK);
    assert_eq!(api.store.private_budgets("user-a").await.unwrap(), None);
}

#[sqlx::test(migrations = "./db/rust-migrations")]
async fn invalid_private_budgets_are_rejected(pool: PgPool) {
    let (oidc, api, client) = server(pool).await;
    let bearer = token(&oidc.issuer, "user-a");
    let invalid = client
        .put(format!("{}/api/budgets", api.base_url))
        .header("host", "127.0.0.1")
        .bearer_auth(&bearer)
        .json(&json!({
            "budgets": {"defaults": {"Food": -1}, "monthly": {}}
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(invalid.status(), reqwest::StatusCode::UNPROCESSABLE_ENTITY);
}

#[sqlx::test(migrations = "./db/rust-migrations")]
async fn private_rules_are_user_scoped_and_authentication_is_required(pool: PgPool) {
    let (oidc, api, client) = server(pool).await;
    let user_a = token(&oidc.issuer, "user-a");
    let user_b = token(&oidc.issuer, "user-b");

    let put = client
        .put(format!("{}/api/rules", api.base_url))
        .header("host", "127.0.0.1")
        .bearer_auth(&user_a)
        .json(&rules())
        .send()
        .await
        .unwrap();
    assert_eq!(put.status(), reqwest::StatusCode::OK);

    let other_user = client
        .get(format!("{}/api/rules", api.base_url))
        .header("host", "127.0.0.1")
        .bearer_auth(&user_b)
        .send()
        .await
        .unwrap();
    assert_eq!(other_user.status(), reqwest::StatusCode::OK);
    let other_body: serde_json::Value = other_user.json().await.unwrap();
    assert!(other_body["private"].as_array().unwrap().is_empty());

    let missing = client
        .get(format!("{}/api/rules", api.base_url))
        .header("host", "127.0.0.1")
        .send()
        .await
        .unwrap();
    assert_eq!(missing.status(), reqwest::StatusCode::UNAUTHORIZED);
    assert_eq!(missing.headers()["www-authenticate"], "Bearer");
}

#[sqlx::test(migrations = "./db/rust-migrations")]
async fn invalid_private_replacement_is_visible_and_preserves_previous_data(pool: PgPool) {
    let (oidc, api, client) = server(pool).await;
    let bearer = token(&oidc.issuer, "user-a");
    let url = format!("{}/api/rules", api.base_url);

    let put = client
        .put(&url)
        .header("host", "127.0.0.1")
        .bearer_auth(&bearer)
        .json(&rules())
        .send()
        .await
        .unwrap();
    assert_eq!(put.status(), reqwest::StatusCode::OK);

    let invalid = client
        .put(&url)
        .header("host", "127.0.0.1")
        .bearer_auth(&bearer)
        .json(&json!({"rules": [{"keyword": "x", "category": "broken", "column": "recipient"}]}))
        .send()
        .await
        .unwrap();
    assert_eq!(invalid.status(), reqwest::StatusCode::UNPROCESSABLE_ENTITY);
    let error: serde_json::Value = invalid.json().await.unwrap();
    assert!(error["detail"].as_str().unwrap().contains("keyword"));

    let get = client
        .get(&url)
        .header("host", "127.0.0.1")
        .bearer_auth(&bearer)
        .send()
        .await
        .unwrap();
    let body: serde_json::Value = get.json().await.unwrap();
    assert_eq!(body["private"].as_array().unwrap().len(), 2);
}

#[sqlx::test(migrations = "./db/rust-migrations")]
async fn community_rules_are_shared_and_contributor_scoped(pool: PgPool) {
    let (oidc, api, client) = server(pool).await;
    let alice = token(&oidc.issuer, "alice");
    let bob = token(&oidc.issuer, "bob");
    let url = format!("{}/api/community/rules", api.base_url);
    let shared = json!({
        "rules": [{"keyword": "REWE", "category": "groceries", "column": "recipient", "confidence": 0.9}]
    });

    let add_alice = client
        .post(&url)
        .header("host", "127.0.0.1")
        .bearer_auth(&alice)
        .json(&shared)
        .send()
        .await
        .unwrap();
    assert_eq!(add_alice.status(), reqwest::StatusCode::OK);

    let add_bob = client
        .post(&url)
        .header("host", "127.0.0.1")
        .bearer_auth(&bob)
        .json(&shared)
        .send()
        .await
        .unwrap();
    assert_eq!(add_bob.status(), reqwest::StatusCode::OK);

    let default_get = client
        .get(format!("{}/api/rules", api.base_url))
        .header("host", "127.0.0.1")
        .bearer_auth(&alice)
        .send()
        .await
        .unwrap();
    let default_body: serde_json::Value = default_get.json().await.unwrap();
    assert!(default_body["community"].as_array().unwrap().is_empty());

    let shared_get = client
        .get(format!("{}/api/rules?include_community=true", api.base_url))
        .header("host", "127.0.0.1")
        .bearer_auth(&alice)
        .send()
        .await
        .unwrap();
    let shared_body: serde_json::Value = shared_get.json().await.unwrap();
    assert_eq!(shared_body["community"].as_array().unwrap().len(), 1);

    let remove_alice = client
        .delete(&url)
        .header("host", "127.0.0.1")
        .bearer_auth(&alice)
        .send()
        .await
        .unwrap();
    assert_eq!(remove_alice.status(), reqwest::StatusCode::OK);
    assert_eq!(api.store.community().await.unwrap().len(), 1);

    let custom = client
        .post(&url)
        .header("host", "127.0.0.1")
        .bearer_auth(&bob)
        .json(&json!({
            "rules": [{"keyword": "PRIVATE", "category": "custom", "column": "recipient"}]
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(custom.status(), reqwest::StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(api.store.community().await.unwrap().len(), 1);

    let remove_bob = client
        .delete(&url)
        .header("host", "127.0.0.1")
        .bearer_auth(&bob)
        .send()
        .await
        .unwrap();
    assert_eq!(remove_bob.status(), reqwest::StatusCode::OK);
    assert!(api.store.community().await.unwrap().is_empty());
}

#[sqlx::test(migrations = "./db/rust-migrations")]
async fn public_contracts_and_security_headers_are_explicit(pool: PgPool) {
    let (oidc, api, client) = server(pool).await;

    let health = client
        .get(format!("{}/healthz", api.base_url))
        .header("host", "127.0.0.1")
        .header("x-forwarded-proto", "https")
        .send()
        .await
        .unwrap();
    assert_eq!(health.status(), reqwest::StatusCode::OK);
    assert_eq!(health.headers()["x-content-type-options"], "nosniff");
    assert_eq!(health.headers()["x-frame-options"], "DENY");
    assert!(
        health.headers()["content-security-policy"]
            .to_str()
            .unwrap()
            .contains(&oidc.issuer)
    );
    assert_eq!(
        health.headers()["strict-transport-security"],
        "max-age=31536000; includeSubDomains"
    );
    assert_eq!(
        health.json::<serde_json::Value>().await.unwrap(),
        json!({"status": "ok"})
    );

    let ready = client
        .get(format!("{}/readyz", api.base_url))
        .header("host", "127.0.0.1")
        .send()
        .await
        .unwrap();
    assert_eq!(ready.status(), reqwest::StatusCode::OK);
    assert_eq!(
        ready.json::<serde_json::Value>().await.unwrap(),
        json!({"status": "ready"})
    );

    let config = client
        .get(format!("{}/config.js", api.base_url))
        .header("host", "127.0.0.1")
        .send()
        .await
        .unwrap();
    assert_eq!(config.status(), reqwest::StatusCode::OK);
    assert_eq!(config.headers()["content-type"], "application/javascript");
    assert_eq!(config.headers()["cache-control"], "no-store");
    let config_body = config.text().await.unwrap();
    assert!(config_body.contains(&oidc.issuer));
    assert!(config_body.contains("integration-test-client"));
    assert!(!config_body.contains("GEMINI_API_KEY"));
}

#[sqlx::test(migrations = "./db/rust-migrations")]
async fn malformed_requests_and_invalid_hosts_fail_without_authentication(pool: PgPool) {
    let (oidc, api, client) = server(pool).await;
    let bearer = token(&oidc.issuer, "user-a");
    let url = format!("{}/api/rules", api.base_url);

    let malformed_json = client
        .put(&url)
        .header("host", "127.0.0.1")
        .bearer_auth(&bearer)
        .header("content-type", "application/json")
        .body("{not-json")
        .send()
        .await
        .unwrap();
    assert_eq!(malformed_json.status(), reqwest::StatusCode::BAD_REQUEST);

    let malformed_query = client
        .get(format!(
            "{}/api/rules?include_community=maybe",
            api.base_url
        ))
        .header("host", "127.0.0.1")
        .bearer_auth(&bearer)
        .send()
        .await
        .unwrap();
    assert_eq!(malformed_query.status(), reqwest::StatusCode::BAD_REQUEST);

    let invalid_host = client
        .get(format!("{}/healthz", api.base_url))
        .header("host", "attacker.invalid")
        .send()
        .await
        .unwrap();
    assert_eq!(invalid_host.status(), reqwest::StatusCode::BAD_REQUEST);
}

#[sqlx::test(migrations = "./db/rust-migrations")]
async fn invalid_tokens_are_rejected_without_writing_private_rules(pool: PgPool) {
    let (oidc, api, client) = server(pool).await;
    let url = format!("{}/api/rules", api.base_url);
    let cases = [
        "malformed.token.value".to_owned(),
        token_variant(
            &oidc.issuer,
            "user-a",
            -120,
            "integration-test-client",
            "integration-test-key",
        ),
        token_variant(
            &oidc.issuer,
            "user-a",
            3600,
            "wrong-client",
            "integration-test-key",
        ),
        token_variant(
            &oidc.issuer,
            "user-a",
            3600,
            "integration-test-client",
            "unknown-key",
        ),
        tampered_token(&oidc.issuer, "user-a"),
    ];

    for bearer in cases {
        let response = client
            .put(&url)
            .header("host", "127.0.0.1")
            .bearer_auth(bearer)
            .json(&rules())
            .send()
            .await
            .unwrap();
        assert_eq!(response.status(), reqwest::StatusCode::UNAUTHORIZED);
    }
    assert!(api.store.private("user-a").await.unwrap().is_empty());
}

fn classification_request() -> serde_json::Value {
    json!({
        "transactions": [
            {
                "id": "tx-1",
                "recipient": "REWE Markt",
                "purpose": "Lebensmittel",
                "amount": -12.50,
                "date": "2026-01-01",
                "account": "synthetic-account-marker"
            },
            {
                "id": "tx-2",
                "recipient": "UNKNOWN SHOP",
                "purpose": "Sonstiges",
                "amount": -8.00,
                "date": "2026-01-02",
                "account": "synthetic-account-marker"
            }
        ],
        "categories": ["groceries", "items"],
        "confidence_threshold": 0.7
    })
}

#[sqlx::test(migrations = "./db/rust-migrations")]
async fn classification_reaches_provider_with_only_permitted_fields(pool: PgPool) {
    let oidc = OidcStub::start().await;
    let provider = ProviderStub::start().await;
    let api = start_api_with_provider(pool, oidc.issuer.clone(), &provider).await;
    let response = reqwest::Client::new()
        .post(format!("{}/api/classify", api.base_url))
        .header("host", "127.0.0.1")
        .bearer_auth(token(&oidc.issuer, "classifier-user"))
        .json(&classification_request())
        .send()
        .await
        .unwrap();

    assert_eq!(response.status(), reqwest::StatusCode::OK);
    let body: serde_json::Value = response.json().await.unwrap();
    assert_eq!(body["rules"].as_array().unwrap().len(), 1);
    assert_eq!(body["rules"][0]["keyword"], "REWE Markt");

    let requests = provider.requests();
    assert_eq!(requests.len(), 1);
    assert_eq!(
        requests[0].api_key.as_deref(),
        Some("integration-test-provider-key")
    );
    let prompt = requests[0].body["contents"][0]["parts"][0]["text"]
        .as_str()
        .unwrap();
    assert!(prompt.contains("REWE Markt"));
    assert!(prompt.contains("Lebensmittel"));
    assert!(prompt.contains("groceries"));
    assert!(prompt.contains("0.7"));
    assert!(!prompt.contains("\"amount\""));
    assert!(!prompt.contains("\"date\""));
    assert!(!prompt.contains("\"account\""));
}

#[sqlx::test(migrations = "./db/rust-migrations")]
async fn classification_provider_faults_are_safe_and_recoverable(pool: PgPool) {
    let oidc = OidcStub::start().await;
    let provider = ProviderStub::start().await;
    let api = start_api_with_provider(pool, oidc.issuer.clone(), &provider).await;
    let client = reqwest::Client::new();
    let url = format!("{}/api/classify", api.base_url);
    let bearer = token(&oidc.issuer, "classifier-user");

    for mode in [
        ProviderMode::Status(reqwest::StatusCode::BAD_REQUEST),
        ProviderMode::Status(reqwest::StatusCode::UNAUTHORIZED),
        ProviderMode::Status(reqwest::StatusCode::TOO_MANY_REQUESTS),
        ProviderMode::Status(reqwest::StatusCode::INTERNAL_SERVER_ERROR),
        ProviderMode::MalformedJson,
        ProviderMode::EmptyCandidates,
        ProviderMode::MissingText,
        ProviderMode::Text("not a JSON array".into()),
    ] {
        provider.set_mode(mode);
        let response = client
            .post(&url)
            .header("host", "127.0.0.1")
            .bearer_auth(&bearer)
            .json(&classification_request())
            .send()
            .await
            .unwrap();
        assert_eq!(response.status(), reqwest::StatusCode::BAD_GATEWAY);
    }

    provider.set_mode(ProviderMode::Valid);
    let recovered = client
        .post(&url)
        .header("host", "127.0.0.1")
        .bearer_auth(bearer)
        .json(&classification_request())
        .send()
        .await
        .unwrap();
    assert_eq!(recovered.status(), reqwest::StatusCode::OK);
    assert_eq!(
        recovered.json::<serde_json::Value>().await.unwrap()["rules"]
            .as_array()
            .unwrap()
            .len(),
        1
    );
}

#[sqlx::test(migrations = "./db/rust-migrations")]
async fn classification_configuration_validation_and_rate_limits_are_enforced(pool: PgPool) {
    let oidc = OidcStub::start().await;
    let provider = ProviderStub::start().await;
    let api = start_api_with_options(
        pool,
        oidc.issuer.clone(),
        provider.base_url.clone(),
        Some("integration-test-provider-key".into()),
        1,
        4_096,
        1,
    )
    .await;
    let client = reqwest::Client::new();
    let url = format!("{}/api/classify", api.base_url);
    let user_a = token(&oidc.issuer, "classifier-user-a");

    let empty = client
        .post(&url)
        .header("host", "127.0.0.1")
        .bearer_auth(&user_a)
        .json(&json!({
            "transactions": [],
            "categories": ["groceries"],
            "confidence_threshold": 0.7
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(empty.status(), reqwest::StatusCode::UNPROCESSABLE_ENTITY);

    let too_many = client
        .post(&url)
        .header("host", "127.0.0.1")
        .bearer_auth(&user_a)
        .json(&classification_request())
        .send()
        .await
        .unwrap();
    assert_eq!(too_many.status(), reqwest::StatusCode::UNPROCESSABLE_ENTITY);
    assert!(provider.requests().is_empty());

    let too_large = client
        .post(&url)
        .header("host", "127.0.0.1")
        .header("content-length", "4097")
        .bearer_auth(&user_a)
        .body("{}")
        .send()
        .await
        .unwrap();
    assert_eq!(too_large.status(), reqwest::StatusCode::PAYLOAD_TOO_LARGE);
    assert!(provider.requests().is_empty());

    let first = client
        .post(&url)
        .header("host", "127.0.0.1")
        .bearer_auth(&user_a)
        .json(&json!({
            "transactions": [{"id": "tx-1", "recipient": "REWE Markt", "purpose": "Lebensmittel"}],
            "categories": ["groceries", "items"],
            "confidence_threshold": 0.7
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(first.status(), reqwest::StatusCode::OK);

    let limited = client
        .post(&url)
        .header("host", "127.0.0.1")
        .bearer_auth(&user_a)
        .json(&json!({
            "transactions": [{"id": "tx-1", "recipient": "REWE Markt", "purpose": "Lebensmittel"}],
            "categories": ["groceries", "items"],
            "confidence_threshold": 0.7
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(limited.status(), reqwest::StatusCode::TOO_MANY_REQUESTS);
    assert_eq!(limited.headers()["retry-after"], "60");

    let other_user = client
        .post(&url)
        .header("host", "127.0.0.1")
        .bearer_auth(token(&oidc.issuer, "classifier-user-b"))
        .json(&json!({
            "transactions": [{"id": "tx-1", "recipient": "REWE Markt", "purpose": "Lebensmittel"}],
            "categories": ["groceries", "items"],
            "confidence_threshold": 0.7
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(other_user.status(), reqwest::StatusCode::OK);
    assert_eq!(provider.requests().len(), 2);
}

#[sqlx::test(migrations = "./db/rust-migrations")]
async fn missing_provider_configuration_is_reported_without_an_upstream_call(pool: PgPool) {
    let oidc = OidcStub::start().await;
    let provider = ProviderStub::start().await;
    let api = start_api_with_options(
        pool,
        oidc.issuer.clone(),
        provider.base_url.clone(),
        None,
        500,
        262_144,
        10,
    )
    .await;
    let response = reqwest::Client::new()
        .post(format!("{}/api/classify", api.base_url))
        .header("host", "127.0.0.1")
        .bearer_auth(token(&oidc.issuer, "classifier-user"))
        .json(&classification_request())
        .send()
        .await
        .unwrap();

    assert_eq!(response.status(), reqwest::StatusCode::SERVICE_UNAVAILABLE);
    assert!(provider.requests().is_empty());
}
