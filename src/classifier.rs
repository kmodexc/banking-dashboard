use reqwest::Client;
use serde_json::json;

use crate::{
    error::AppError,
    models::{ClassificationRequest, ClassificationResponse, ClassificationRule},
};

pub async fn classify(
    client: &Client,
    api_key: Option<&str>,
    model: &str,
    request: &ClassificationRequest,
    max_transactions: usize,
) -> Result<ClassificationResponse, AppError> {
    let api_key = api_key.ok_or(AppError::ServiceUnavailable)?;
    let categories = serde_json::to_string(&request.categories)
        .map_err(|_| AppError::Internal(anyhow::anyhow!("could not encode categories")))?;
    let transactions = request
        .transactions
        .iter()
        .map(|transaction| {
            json!({
                "id": transaction.id,
                "recipient": transaction.recipient,
                "purpose": transaction.purpose,
            })
        })
        .collect::<Vec<_>>();
    let prompt = format!(
        r#"
Classify these bank transactions. Return a JSON array with at most one rule per
transaction. Each object must contain keyword, category, column, and confidence.
Use only these exact categories: {categories}.
column must be exactly recipient, purpose, or both. confidence must be between 0 and 1.
Choose short, specific merchant or purpose keywords that can be matched as a
case-insensitive substring. Do not include account numbers, names of private
individuals, or full transaction descriptions in keywords.

Transactions:
{transactions}
"#,
        transactions = serde_json::to_string(&transactions)
            .map_err(|_| AppError::Internal(anyhow::anyhow!("could not encode transactions")))?
    );

    let payload = json!({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"responseMimeType": "application/json"},
    });
    let response = client
        .post(format!(
            "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
        ))
        .query(&[("key", api_key)])
        .json(&payload)
        .timeout(std::time::Duration::from_secs(30))
        .send()
        .await
        .map_err(|error| {
            tracing::error!(error = ?error, "classification provider request failed");
            AppError::ProviderUnavailable
        })?
        .error_for_status()
        .map_err(|error| {
            tracing::error!(error = ?error, "classification provider returned an error");
            AppError::ProviderUnavailable
        })?
        .json::<serde_json::Value>()
        .await
        .map_err(|error| {
            tracing::error!(error = ?error, "classification provider response was invalid");
            AppError::ProviderInvalid
        })?;
    let text = response
        .get("candidates")
        .and_then(|value| value.as_array())
        .and_then(|candidates| candidates.first())
        .and_then(|candidate| candidate.get("content"))
        .and_then(|content| content.get("parts"))
        .and_then(|parts| parts.as_array())
        .and_then(|parts| parts.first())
        .and_then(|part| part.get("text"))
        .and_then(|text| text.as_str())
        .ok_or(AppError::ProviderInvalid)?;
    let raw_rules =
        serde_json::from_str::<serde_json::Value>(text).map_err(|_| AppError::ProviderInvalid)?;
    let raw_rules = raw_rules.as_array().ok_or(AppError::ProviderInvalid)?;
    let mut rules = Vec::new();
    for raw_rule in raw_rules
        .iter()
        .take(request.transactions.len().min(max_transactions))
    {
        let Ok(rule) = serde_json::from_value::<ClassificationRule>(raw_rule.clone()) else {
            continue;
        };
        if rule.confidence < request.confidence_threshold
            || rule.validate(&request.categories).is_err()
        {
            continue;
        }
        rules.push(rule);
    }
    Ok(ClassificationResponse { rules })
}
