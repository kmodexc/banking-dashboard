import type { ReactElement } from 'react';
import type { Transaction } from '../types';
import { formatDate, formatPeriod, money } from '../utils/format';
import { SearchPreview } from './SearchPreview';

export function TransactionDetailsModal({
  transaction,
  categories,
  onClose,
  onCategoryChange,
}: {
  transaction: Transaction;
  categories: string[];
  onClose: () => void;
  onCategoryChange: (transactionId: string, category: string) => void;
}): ReactElement {
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
          </div>
          <SearchPreview recipient={transaction.recipient} purpose={transaction.purpose} />
        </div>
      </section>
    </div>
  );
}
