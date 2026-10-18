import type { ReactElement } from 'react';
import type { Transaction } from '../../types';
import { formatDate, formatPeriod, money } from '../../utils/format';

export function TransactionSummary({ transaction }: { transaction: Transaction }): ReactElement {
  return (
    <div className="transaction-summary">
      <div className="transaction-summary-main">
        <strong>{transaction.recipient || 'Unnamed transaction'}</strong>
        <span>{transaction.purpose || 'No purpose recorded'}</span>
      </div>
      <div className="transaction-summary-meta">
        <span>{transaction.type === 'Eingang' ? 'Income' : 'Expense'}</span>
        <time dateTime={transaction.date}>{formatDate(transaction.date)}</time>
        <span
          className={`transaction-summary-amount ${
            transaction.amount < 0 ? 'expense-text' : 'income-text'
          }`}
        >
          {money(transaction.amount)}
        </span>
      </div>
      <dl className="transaction-summary-details">
        <div>
          <dt>Period</dt>
          <dd>{formatPeriod(transaction.period)}</dd>
        </div>
        <div>
          <dt>Transaction ID</dt>
          <dd>{transaction.id}</dd>
        </div>
      </dl>
    </div>
  );
}
