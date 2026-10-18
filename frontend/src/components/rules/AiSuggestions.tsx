import { useState, type ReactElement } from 'react';
import { classifyTransactions } from '../../api';
import { OidcClient } from '../../auth';
import { getAppConfig } from '../../config';
import type { AuthSnapshot, ClassificationRule, Transaction } from '../../types';

const config = getAppConfig();

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected error';
}

export function AiSuggestions({
  transactions,
  categories,
  auth,
  client,
  onAddRules,
}: {
  transactions: Transaction[];
  categories: string[];
  auth: AuthSnapshot;
  client: OidcClient;
  onAddRules: (rules: ClassificationRule[]) => void;
}): ReactElement {
  const [confidence, setConfidence] = useState(0.7);
  const [status, setStatus] = useState('');

  async function classify(): Promise<void> {
    if (!auth.token) {
      setStatus('Sign in before requesting AI suggestions.');
      return;
    }
    if (!transactions.length) {
      setStatus('There are no unknown outgoing transactions.');
      return;
    }
    setStatus('Asking the classification service…');
    try {
      const token = await client.token();
      const suggestions = await classifyTransactions(config, token, {
        transactions: transactions
          .slice(0, 500)
          .map((row) => ({ id: row.id, recipient: row.recipient, purpose: row.purpose })),
        categories,
        confidence_threshold: confidence,
      });
      onAddRules(suggestions);
      setStatus(`${suggestions.length} rules accepted.`);
    } catch (error: unknown) {
      setStatus(errorMessage(error));
    }
  }

  return (
    <>
      <hr />
      <h2>AI suggestions</h2>
      <label>
        Confidence threshold
        <input
          id="confidence"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={confidence}
          onChange={(event) => setConfidence(Number(event.currentTarget.value))}
        />
        <output id="confidence-value">{confidence.toFixed(2)}</output>
      </label>
      <button
        id="classify-button"
        className="button primary"
        type="button"
        disabled={!auth.token}
        onClick={() => void classify()}
      >
        Classify unknown transactions
      </button>
      <p id="classify-status" className="muted small">
        {status}
      </p>
    </>
  );
}
