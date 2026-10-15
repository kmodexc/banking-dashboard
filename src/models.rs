use serde::{Deserialize, Serialize};

pub const GLOBAL_CATEGORIES: [&str; 10] = [
    "groceries",
    "restaurant",
    "paypal",
    "vacation",
    "items",
    "entertainment",
    "rent/insurance/elec/mobility",
    "bargeld",
    "umbuchung",
    "mix",
];

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Rule {
    pub keyword: String,
    pub category: String,
    #[serde(rename = "column")]
    pub rule_column: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub confidence: Option<f64>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
pub struct Category {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub aliases: Vec<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
pub struct CategoryState {
    #[serde(default)]
    pub categories: Vec<Category>,
    #[serde(rename = "deletedIds", default)]
    pub deleted_ids: Vec<String>,
}

impl Rule {
    pub fn validate(&self) -> Result<(), &'static str> {
        if !(3..=200).contains(&self.keyword.trim().chars().count()) {
            return Err("keyword must contain between 3 and 200 characters");
        }
        if !(1..=80).contains(&self.category.trim().chars().count()) {
            return Err("category must contain between 1 and 80 characters");
        }
        if !matches!(self.rule_column.as_str(), "recipient" | "purpose" | "both") {
            return Err("column must be recipient, purpose, or both");
        }
        if let Some(confidence) = self.confidence
            && !(0.0..=1.0).contains(&confidence)
        {
            return Err("confidence must be between 0 and 1");
        }
        Ok(())
    }
}

#[derive(Debug, Deserialize)]
pub struct Transaction {
    pub id: Option<serde_json::Value>,
    #[serde(default)]
    pub recipient: String,
    #[serde(default)]
    pub purpose: String,
}

#[derive(Debug, Deserialize)]
pub struct ClassificationRequest {
    pub transactions: Vec<Transaction>,
    pub categories: Vec<String>,
    pub confidence_threshold: f64,
}

impl ClassificationRequest {
    pub fn validate(&self, max_transactions: usize) -> Result<(), String> {
        if self.transactions.is_empty() || self.transactions.len() > max_transactions {
            return Err(format!(
                "transactions must contain between 1 and {max_transactions} entries"
            ));
        }
        if self.categories.is_empty() || self.categories.len() > 50 {
            return Err("categories must contain between 1 and 50 entries".into());
        }
        if self
            .categories
            .iter()
            .any(|category| category.trim().is_empty() || category.chars().count() > 80)
        {
            return Err("categories must contain 1 to 80 characters".into());
        }
        if !(0.0..=1.0).contains(&self.confidence_threshold) {
            return Err("confidence_threshold must be between 0 and 1".into());
        }
        if self.transactions.iter().any(|transaction| {
            transaction.recipient.chars().count() > 500
                || transaction.purpose.chars().count() > 2000
        }) {
            return Err("transaction fields exceed their maximum length".into());
        }
        Ok(())
    }
}

#[derive(Debug, Serialize)]
pub struct ClassificationResponse {
    pub rules: Vec<ClassificationRule>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ClassificationRule {
    pub keyword: String,
    pub category: String,
    #[serde(rename = "column")]
    pub rule_column: String,
    pub confidence: f64,
}

impl ClassificationRule {
    pub fn validate(&self, categories: &[String]) -> Result<(), &'static str> {
        let rule = Rule {
            keyword: self.keyword.clone(),
            category: self.category.clone(),
            rule_column: self.rule_column.clone(),
            confidence: Some(self.confidence),
        };
        rule.validate()?;
        if !categories.iter().any(|category| category == &self.category) {
            return Err("category is not in the request category list");
        }
        Ok(())
    }
}

#[derive(Debug, Deserialize)]
pub struct RuleCollection {
    #[serde(default)]
    pub rules: Vec<Rule>,
    #[serde(default)]
    pub categories: Option<CategoryState>,
}

impl RuleCollection {
    pub fn validate(&self) -> Result<(), String> {
        if self.rules.len() > 500 {
            return Err("rules must contain at most 500 entries".into());
        }
        for rule in &self.rules {
            rule.validate().map_err(str::to_owned)?;
        }
        if let Some(categories) = &self.categories {
            if categories.categories.len() > 100 {
                return Err("categories must contain at most 100 entries".into());
            }
            if categories
                .categories
                .iter()
                .any(|category| category.id.trim().is_empty() || category.id.chars().count() > 160)
            {
                return Err("category ids must contain 1 to 160 characters".into());
            }
            if categories.categories.iter().any(|category| {
                category.name.trim().is_empty() || category.name.chars().count() > 80
            }) {
                return Err("category names must contain 1 to 80 characters".into());
            }
        }
        Ok(())
    }
}

#[derive(Debug, Serialize)]
pub struct RuleCollectionResponse {
    pub private: Vec<Rule>,
    pub community: Vec<Rule>,
    pub categories: Option<CategoryState>,
}

#[derive(Debug, Serialize)]
pub struct ConfigResponse {
    #[serde(rename = "keycloakIssuer")]
    pub keycloak_issuer: String,
    #[serde(rename = "keycloakClientId")]
    pub keycloak_client_id: String,
    #[serde(rename = "apiBaseUrl")]
    pub api_base_url: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rule() -> Rule {
        Rule {
            keyword: "REWE".into(),
            category: "groceries".into(),
            rule_column: "recipient".into(),
            confidence: Some(0.9),
        }
    }

    #[test]
    fn rules_validate_and_use_the_frontend_column_name() {
        let value = rule();
        assert!(value.validate().is_ok());
        let json = serde_json::to_value(value).expect("rule serializes");
        assert_eq!(json["column"], "recipient");
        assert!(json.get("rule_column").is_none());
    }

    #[test]
    fn rules_reject_invalid_columns_and_confidence() {
        let mut value = rule();
        value.rule_column = "amount".into();
        assert!(value.validate().is_err());
        value.rule_column = "recipient".into();
        value.confidence = Some(1.1);
        assert!(value.validate().is_err());
    }

    #[test]
    fn classification_request_rejects_empty_or_oversized_fields() {
        let request = ClassificationRequest {
            transactions: Vec::new(),
            categories: vec!["groceries".into()],
            confidence_threshold: 0.7,
        };
        assert!(request.validate(500).is_err());
    }
}
