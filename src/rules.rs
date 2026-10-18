use anyhow::{Context, Result};
use sqlx::{PgPool, Row};
use sqlx::types::chrono::{DateTime, Utc};

use crate::models::{BudgetPlan, CategoryState, GLOBAL_CATEGORIES, Rule};

static MIGRATOR: sqlx::migrate::Migrator = sqlx::migrate!("./db/rust-migrations");

#[derive(Clone)]
pub struct RuleStore {
    pool: PgPool,
    legacy_path: Option<std::path::PathBuf>,
}

#[derive(sqlx::FromRow)]
struct DbRule {
    keyword: String,
    category: String,
    rule_column: String,
    confidence: Option<f64>,
    created_at: DateTime<Utc>,
}

impl RuleStore {
    /// Construct a store around an already-provisioned pool.
    ///
    /// Integration tests use SQLx's real PostgreSQL test pool while
    /// production continues to use `connect`, which owns connection and
    /// migration setup.
    pub fn from_pool(pool: PgPool) -> Self {
        Self {
            pool,
            legacy_path: None,
        }
    }

    pub async fn connect(
        database_url: &str,
        legacy_path: Option<std::path::PathBuf>,
    ) -> Result<Self> {
        let pool = sqlx::postgres::PgPoolOptions::new()
            .max_connections(10)
            .connect(database_url)
            .await
            .context("could not connect to PostgreSQL")?;
        let store = Self { pool, legacy_path };
        store.initialize().await?;
        Ok(store)
    }

    async fn initialize(&self) -> Result<()> {
        MIGRATOR
            .run(&self.pool)
            .await
            .context("database migrations failed")?;
        for category in GLOBAL_CATEGORIES {
            sqlx::query(
                "INSERT INTO global_categories (name) VALUES ($1) ON CONFLICT (name) DO NOTHING",
            )
            .bind(category)
            .execute(&self.pool)
            .await?;
        }
        self.import_legacy_json().await
    }

    pub async fn private(&self, subject: &str) -> Result<Vec<Rule>, sqlx::Error> {
        let rows = sqlx::query_as::<_, DbRule>(
            "SELECT keyword, category, rule_column, confidence, created_at
             FROM private_rules WHERE subject = $1 ORDER BY created_at DESC, id DESC",
        )
        .bind(subject)
        .fetch_all(&self.pool)
        .await?;
        Ok(rows.into_iter().map(Into::into).collect())
    }

    pub async fn ping(&self) -> Result<(), sqlx::Error> {
        sqlx::query("SELECT 1")
            .execute(&self.pool)
            .await
            .map(|_| ())
    }

    pub async fn replace_private(&self, subject: &str, rules: &[Rule]) -> Result<(), sqlx::Error> {
        let mut transaction = self.pool.begin().await?;
        // Serialize replacement requests for one user. Without this lock, two
        // concurrent DELETE + INSERT transactions can both delete the old
        // rows and then collide on the unique rule index.
        sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))")
            .bind(subject)
            .execute(&mut *transaction)
            .await?;
        sqlx::query("DELETE FROM private_rules WHERE subject = $1")
            .bind(subject)
            .execute(&mut *transaction)
            .await?;
        for rule in rules {
            sqlx::query(
                "INSERT INTO private_rules
                (subject, keyword, category, rule_column, confidence, created_at)
                 VALUES ($1, $2, $3, $4, $5, COALESCE($6, now()))
                 ON CONFLICT (subject, lower(keyword), lower(category), rule_column)
                 DO UPDATE SET confidence = EXCLUDED.confidence",
            )
            .bind(subject)
            .bind(&rule.keyword)
            .bind(&rule.category)
            .bind(&rule.rule_column)
            .bind(rule.confidence)
            .bind(rule.created_at)
            .execute(&mut *transaction)
            .await?;
        }
        transaction.commit().await
    }

    pub async fn private_categories(
        &self,
        subject: &str,
    ) -> Result<Option<CategoryState>, sqlx::Error> {
        let value = sqlx::query_scalar::<_, serde_json::Value>(
            "SELECT categories FROM private_categories WHERE subject = $1",
        )
        .bind(subject)
        .fetch_optional(&self.pool)
        .await?;
        value
            .map(|value| {
                serde_json::from_value(value).map_err(|error| sqlx::Error::Decode(Box::new(error)))
            })
            .transpose()
    }

    pub async fn replace_private_categories(
        &self,
        subject: &str,
        categories: &CategoryState,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            "INSERT INTO private_categories (subject, categories)
             VALUES ($1, $2)
             ON CONFLICT (subject) DO UPDATE
             SET categories = EXCLUDED.categories, updated_at = now()",
        )
        .bind(subject)
        .bind(serde_json::to_value(categories).expect("category state serializes"))
        .execute(&self.pool)
        .await
        .map(|_| ())
    }

    pub async fn delete_private_categories(&self, subject: &str) -> Result<(), sqlx::Error> {
        sqlx::query("DELETE FROM private_categories WHERE subject = $1")
            .bind(subject)
            .execute(&self.pool)
            .await
            .map(|_| ())
    }

    pub async fn private_budgets(
        &self,
        subject: &str,
    ) -> Result<Option<BudgetPlan>, sqlx::Error> {
        let value = sqlx::query_scalar::<_, serde_json::Value>(
            "SELECT budgets FROM private_budgets WHERE subject = $1",
        )
        .bind(subject)
        .fetch_optional(&self.pool)
        .await?;
        value
            .map(|value| {
                serde_json::from_value(value).map_err(|error| sqlx::Error::Decode(Box::new(error)))
            })
            .transpose()
    }

    pub async fn replace_private_budgets(
        &self,
        subject: &str,
        budgets: &BudgetPlan,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            "INSERT INTO private_budgets (subject, budgets)
             VALUES ($1, $2)
             ON CONFLICT (subject) DO UPDATE
             SET budgets = EXCLUDED.budgets, updated_at = now()",
        )
        .bind(subject)
        .bind(serde_json::to_value(budgets).expect("budget plan serializes"))
        .execute(&self.pool)
        .await
        .map(|_| ())
    }

    pub async fn delete_private_budgets(&self, subject: &str) -> Result<(), sqlx::Error> {
        sqlx::query("DELETE FROM private_budgets WHERE subject = $1")
            .bind(subject)
            .execute(&self.pool)
            .await
            .map(|_| ())
    }

    pub async fn community(&self) -> Result<Vec<Rule>, sqlx::Error> {
        let rows = sqlx::query_as::<_, DbRule>(
            "SELECT keyword, category, rule_column, confidence, created_at
             FROM community_rules ORDER BY created_at DESC, id DESC",
        )
        .fetch_all(&self.pool)
        .await?;
        Ok(rows.into_iter().map(Into::into).collect())
    }

    pub async fn add_community(
        &self,
        contributor: &str,
        rules: &[Rule],
    ) -> Result<Vec<Rule>, sqlx::Error> {
        let mut transaction = self.pool.begin().await?;
        for rule in rules {
            let inserted = sqlx::query(
                "INSERT INTO community_rules
                 (keyword, category, rule_column, confidence, created_at)
                 VALUES ($1, $2, $3, $4, COALESCE($5, now()))
                 ON CONFLICT DO NOTHING RETURNING id",
            )
            .bind(&rule.keyword)
            .bind(&rule.category)
            .bind(&rule.rule_column)
            .bind(rule.confidence)
            .bind(rule.created_at)
            .fetch_optional(&mut *transaction)
            .await?;
            let rule_id = match inserted {
                Some(row) => row.get::<i64, _>("id"),
                None => sqlx::query(
                    "SELECT id FROM community_rules
                     WHERE lower(keyword) = lower($1)
                       AND lower(category) = lower($2)
                       AND rule_column = $3",
                )
                .bind(&rule.keyword)
                .bind(&rule.category)
                .bind(&rule.rule_column)
                .fetch_one(&mut *transaction)
                .await?
                .get::<i64, _>("id"),
            };
            sqlx::query(
                "INSERT INTO community_rule_contributors (rule_id, contributor)
                 VALUES ($1, $2) ON CONFLICT DO NOTHING",
            )
            .bind(rule_id)
            .bind(contributor)
            .execute(&mut *transaction)
            .await?;
        }
        transaction.commit().await?;
        self.community().await
    }

    pub async fn remove_community(&self, contributor: &str) -> Result<(), sqlx::Error> {
        let mut transaction = self.pool.begin().await?;
        sqlx::query("DELETE FROM community_rule_contributors WHERE contributor = $1")
            .bind(contributor)
            .execute(&mut *transaction)
            .await?;
        sqlx::query(
            "DELETE FROM community_rules rules
             WHERE NOT EXISTS (
                 SELECT 1 FROM community_rule_contributors contributors
                 WHERE contributors.rule_id = rules.id
             )",
        )
        .execute(&mut *transaction)
        .await?;
        transaction.commit().await
    }

    async fn import_legacy_json(&self) -> Result<()> {
        let Some(path) = self.legacy_path.as_deref() else {
            return Ok(());
        };
        if !path.exists() {
            return Ok(());
        }

        let already_imported = sqlx::query_scalar::<_, i64>(
            "SELECT count(*) FROM rule_store_migrations WHERE name = 'legacy-json-rules-v1'",
        )
        .fetch_one(&self.pool)
        .await?;
        if already_imported > 0 {
            return Ok(());
        }

        let content = tokio::fs::read_to_string(path)
            .await
            .context("legacy rule store could not be read safely")?;
        let payload: serde_json::Value =
            serde_json::from_str(&content).context("legacy rule store is not valid JSON")?;
        let object = payload
            .as_object()
            .context("legacy rule store must contain a JSON object")?;
        let mut transaction = self.pool.begin().await?;

        if let Some(private) = object.get("private").and_then(serde_json::Value::as_object) {
            for (subject, raw_rules) in private {
                if subject.chars().count() > 255 {
                    continue;
                }
                let Some(raw_rules) = raw_rules.as_array() else {
                    continue;
                };
                for raw_rule in raw_rules {
                    let Ok(rule) = serde_json::from_value::<Rule>(raw_rule.clone()) else {
                        continue;
                    };
                    if rule.validate().is_err() {
                        continue;
                    }
                    sqlx::query(
                        "INSERT INTO private_rules
                         (subject, keyword, category, rule_column, confidence, created_at)
                         VALUES ($1, $2, $3, $4, $5, COALESCE($6, now())) ON CONFLICT DO NOTHING",
                    )
                    .bind(subject)
                    .bind(&rule.keyword)
                    .bind(&rule.category)
                    .bind(&rule.rule_column)
                    .bind(rule.confidence)
                    .bind(rule.created_at)
                    .execute(&mut *transaction)
                    .await?;
                }
            }
        }

        if let Some(community) = object
            .get("community")
            .and_then(serde_json::Value::as_array)
        {
            for raw_rule in community {
                let Ok(rule) = serde_json::from_value::<Rule>(raw_rule.clone()) else {
                    continue;
                };
                if rule.validate().is_err() || !GLOBAL_CATEGORIES.contains(&rule.category.as_str())
                {
                    continue;
                }
                let inserted = sqlx::query(
                    "INSERT INTO community_rules
                     (keyword, category, rule_column, confidence, created_at)
                     VALUES ($1, $2, $3, $4, COALESCE($5, now())) ON CONFLICT DO NOTHING RETURNING id",
                )
                .bind(&rule.keyword)
                .bind(&rule.category)
                .bind(&rule.rule_column)
                .bind(rule.confidence)
                .bind(rule.created_at)
                .fetch_optional(&mut *transaction)
                .await?;
                let rule_id = match inserted {
                    Some(row) => row.get::<i64, _>("id"),
                    None => sqlx::query(
                        "SELECT id FROM community_rules
                         WHERE lower(keyword) = lower($1)
                           AND lower(category) = lower($2)
                           AND rule_column = $3",
                    )
                    .bind(&rule.keyword)
                    .bind(&rule.category)
                    .bind(&rule.rule_column)
                    .fetch_one(&mut *transaction)
                    .await?
                    .get::<i64, _>("id"),
                };
                let contributor = raw_rule
                    .get("contributor")
                    .and_then(serde_json::Value::as_str)
                    .filter(|value| value.chars().count() <= 255)
                    .unwrap_or("legacy-json-import");
                sqlx::query(
                    "INSERT INTO community_rule_contributors (rule_id, contributor)
                     VALUES ($1, $2) ON CONFLICT DO NOTHING",
                )
                .bind(rule_id)
                .bind(contributor)
                .execute(&mut *transaction)
                .await?;
            }
        }
        sqlx::query("INSERT INTO rule_store_migrations (name) VALUES ('legacy-json-rules-v1')")
            .execute(&mut *transaction)
            .await?;
        transaction
            .commit()
            .await
            .context("legacy rule import transaction failed")?;
        tracing::info!(path = %path.display(), "imported legacy JSON rules");
        Ok(())
    }
}

impl From<DbRule> for Rule {
    fn from(value: DbRule) -> Self {
        Self {
            keyword: value.keyword,
            category: value.category,
            rule_column: value.rule_column,
            confidence: value.confidence,
            created_at: Some(value.created_at),
        }
    }
}
