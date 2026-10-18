import { useState, type ReactElement } from 'react';
import { matchesRule, ruleKey } from '../../data/rules';
import type { CategoryRule, Transaction } from '../../types';
import { RuleForm } from '../rules/RuleForm';
import type { RulesController } from '../rules/ruleTypes';
import { SearchPreview } from '../shared/SearchPreview';
import { TransactionSummary } from './TransactionSummary';

export function TransactionDetailsModal({
  transaction,
  categories,
  transactions,
  rulesController,
  onClose,
  onCategoryChange,
}: {
  transaction: Transaction;
  categories: string[];
  transactions: Transaction[];
  rulesController?: RulesController | undefined;
  onClose: () => void;
  onCategoryChange: (transactionId: string, category: string) => void;
}): ReactElement {
  const [selectedRule, setSelectedRule] = useState<CategoryRule | null>(null);
  const matchingRule =
    rulesController?.rules
      .map((entry) => entry.rule)
      .find((rule) => transaction.type === 'Ausgang' && matchesRule(transaction, rule)) ?? null;

  function saveRule(nextRule: CategoryRule): string | null {
    if (!selectedRule || !rulesController) return null;
    const nextKey = ruleKey(nextRule);
    const duplicate = rulesController.rules.some(
      (entry) => ruleKey(entry.rule) === nextKey && ruleKey(entry.rule) !== ruleKey(selectedRule),
    );
    if (duplicate) {
      return 'A rule with the same keyword, category, and search column already exists.';
    }
    rulesController.actions.updateRule(selectedRule, nextRule);
    return null;
  }

  if (selectedRule && rulesController) {
    return (
      <RuleForm
        rule={selectedRule}
        categories={rulesController.categories}
        transactions={transactions}
        onSave={saveRule}
        onClose={() => setSelectedRule(null)}
      />
    );
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        className="details-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="transaction-details-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <span className="eyebrow accent-eyebrow">Transaction details</span>
            <h2 id="transaction-details-title">{transaction.recipient || 'Transaction'}</h2>
          </div>
          <button
            className="icon-button close-button"
            type="button"
            aria-label="Close transaction details"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="detail-grid">
          <div className="detail-column">
            <TransactionSummary transaction={transaction} />
            {transaction.type === 'Ausgang' ? (
              <div className="category-editor">
                <span className="category-editor-label">Category</span>
                <div className="category-buttons" role="radiogroup" aria-label="Choose category">
                  {categories.map((category) => (
                    <label className="category-choice" key={category}>
                      <input
                        type="radio"
                        name={`category-${transaction.id}`}
                        value={category}
                        checked={transaction.category === category}
                        onChange={() => onCategoryChange(transaction.id, category)}
                      />
                      <span>{category}</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : (
              <p className="muted">Income is not categorized.</p>
            )}
          </div>
          <div className="detail-side">
            <SearchPreview recipient={transaction.recipient} purpose={transaction.purpose} />
            {transaction.type === 'Ausgang' && rulesController && (
              <div className="transaction-rule-match">
                <span className="category-editor-label">Categorization rule</span>
                {matchingRule ? (
                  <button
                    className="transaction-rule-link"
                    type="button"
                    onClick={() => setSelectedRule(matchingRule)}
                  >
                    <strong>{matchingRule.keyword}</strong>
                    <span>→ {matchingRule.category}</span>
                  </button>
                ) : (
                  <p className="muted small">No current rule matches this transaction.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
