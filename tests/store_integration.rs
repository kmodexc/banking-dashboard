use dkb_dashboard_api::{models::Rule, rules::RuleStore};
use sqlx::PgPool;

fn rule(keyword: &str, category: &str, column: &str, confidence: Option<f64>) -> Rule {
    Rule {
        keyword: keyword.into(),
        category: category.into(),
        rule_column: column.into(),
        confidence,
    }
}

#[sqlx::test(migrations = "./db/rust-migrations")]
async fn private_replacement_is_case_insensitive_atomic_and_user_scoped(pool: PgPool) {
    let store = RuleStore::from_pool(pool);
    let first = rule("Market", "Groceries", "recipient", Some(0.5));
    let duplicate = rule("MARKET", "groceries", "recipient", Some(0.9));

    store
        .replace_private("user-a", std::slice::from_ref(&first))
        .await
        .unwrap();
    store
        .replace_private("user-b", &[first.clone(), duplicate])
        .await
        .unwrap();

    assert_eq!(
        store.private("user-b").await.unwrap(),
        vec![rule("Market", "Groceries", "recipient", Some(0.9))]
    );
    assert_eq!(store.private("user-a").await.unwrap(), vec![first.clone()]);

    // A database constraint failure occurs after DELETE. The transaction must
    // keep the previously committed collection intact.
    let invalid = rule("", "Groceries", "recipient", Some(0.2));
    assert!(store.replace_private("user-b", &[invalid]).await.is_err());
    assert_eq!(
        store.private("user-b").await.unwrap(),
        vec![rule("Market", "Groceries", "recipient", Some(0.9))]
    );

    store.replace_private("user-b", &[]).await.unwrap();
    assert!(store.private("user-b").await.unwrap().is_empty());
    assert_eq!(store.private("user-a").await.unwrap(), vec![first]);
}

#[sqlx::test(migrations = "./db/rust-migrations")]
async fn concurrent_replacements_for_one_user_commit_one_complete_collection(pool: PgPool) {
    let store = RuleStore::from_pool(pool);
    let left = vec![
        rule("ALDI", "groceries", "recipient", Some(0.8)),
        rule("BAKERY", "groceries", "purpose", None),
    ];
    let right = vec![
        rule("TRAIN", "mobility", "recipient", Some(0.7)),
        rule("HOTEL", "vacation", "both", Some(1.0)),
    ];

    let (left_result, right_result) = tokio::join!(
        store.replace_private("same-user", &left),
        store.replace_private("same-user", &right),
    );
    left_result.unwrap();
    right_result.unwrap();

    let saved = store.private("same-user").await.unwrap();
    assert!(
        saved == left || saved == right,
        "replacement mixed two collections: {saved:?}"
    );
}

#[sqlx::test(migrations = "./db/rust-migrations")]
async fn community_rules_are_idempotent_and_preserve_shared_contributors(pool: PgPool) {
    let store = RuleStore::from_pool(pool);
    let shared = rule("REWE", "groceries", "recipient", Some(0.9));

    store
        .add_community("alice", std::slice::from_ref(&shared))
        .await
        .unwrap();
    store
        .add_community("alice", std::slice::from_ref(&shared))
        .await
        .unwrap();
    store
        .add_community("bob", std::slice::from_ref(&shared))
        .await
        .unwrap();

    assert_eq!(store.community().await.unwrap(), vec![shared.clone()]);
    store.remove_community("alice").await.unwrap();
    assert_eq!(store.community().await.unwrap(), vec![shared.clone()]);
    store.remove_community("bob").await.unwrap();
    assert!(store.community().await.unwrap().is_empty());
}

#[sqlx::test(migrations = "./db/rust-migrations")]
async fn community_failure_rolls_back_all_rules(pool: PgPool) {
    let store = RuleStore::from_pool(pool);
    let valid = rule("REWE", "groceries", "recipient", Some(0.9));
    let invalid_category = rule("PRIVATE", "custom-only", "recipient", Some(0.7));

    // The store deliberately owns SQL persistence; handler-level validation
    // is tested separately. A foreign-key failure must not leave the first
    // rule or contributor behind.
    assert!(
        store
            .add_community("alice", &[valid, invalid_category])
            .await
            .is_err()
    );
    assert!(store.community().await.unwrap().is_empty());
}
