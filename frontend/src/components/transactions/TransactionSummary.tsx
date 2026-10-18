import type { ReactElement } from 'react';
import type { Transaction } from '../../types';
import { formatDate, formatPeriod, money } from '../../utils/format';
import styles from './TransactionSummary.module.css';

export function TransactionSummary({ transaction }: { transaction: Transaction }): ReactElement {
  return (
    <div className={styles.summary}>
      <div className={styles.main}>
        <strong>{transaction.recipient || 'Unnamed transaction'}</strong>
        <span>{transaction.purpose || 'No purpose recorded'}</span>
      </div>
      <div className={styles.meta}>
        <span>{transaction.type === 'Eingang' ? 'Income' : 'Expense'}</span>
        <time dateTime={transaction.date}>{formatDate(transaction.date)}</time>
        <span
          className={`${styles.amount} ${transaction.amount < 0 ? 'expense-text' : 'income-text'}`}
        >
          {money(transaction.amount)}
        </span>
      </div>
      <dl className={styles.details}>
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
