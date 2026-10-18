import { useState, type ReactElement } from 'react';
import { matchesRule, ruleKey } from '../../data/rules';
import type { CategoryRule, Transaction } from '../../types';
import { formatDate, formatPeriod, money } from '../../utils/format';
import { RuleForm } from '../rules/RuleForm';
import type { RulesController } from '../rules/ruleTypes';
import { SearchPreview } from '../shared/SearchPreview';

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
            <div className="detail-amount">
              <span className={transaction.amount < 0 ? 'expense-text' : 'income-text'}>
                {money(transaction.amount)}
              </span>
              <span className="muted">{transaction.type === 'Eingang' ? 'Income' : 'Expense'}</span>
            </div>
            <dl className="detail-list">
              <div>
                <dt>Date</dt>
                <dd>{formatDate(transaction.date)}</dd>
              </div>
              <div>
                <dt>Period</dt>
                <dd>{formatPeriod(transaction.period)}</dd>
              </div>
              <div>
                <dt>Recipient</dt>
                <dd>{transaction.recipient || '—'}</dd>
              </div>
              <div>
                <dt>Purpose</dt>
                <dd>{transaction.purpose || '—'}</dd>
              </div>
              <div>
                <dt>Transaction ID</dt>
                <dd>{transaction.id}</dd>
              </div>
            </dl>
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
          <SearchPreview recipient={transaction.recipient} purpose={transaction.purpose} />
        </div>
      </section>
    </div>
  );
}
