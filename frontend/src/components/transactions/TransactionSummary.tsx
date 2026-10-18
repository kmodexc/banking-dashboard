import type { ReactElement } from 'react';
import type { Transaction } from '../../types';
import { formatDate, formatPeriod, money } from '../../utils/format';
import styles from './TransactionSummary.module.css';

export function TransactionSummary({ transaction }: { transaction: Transaction }): ReactElement {
  const isIncome = transaction.amount >= 0;

  return (
    <div className={styles.summary}>
      <div className={styles.header}>
        <div className={styles.identity}>
          <span className={styles.kicker}>Transaction</span>
          <strong className={styles.recipient}>
            {transaction.recipient || 'Unnamed transaction'}
          </strong>
          <span className={styles.purpose}>{transaction.purpose || 'No purpose recorded'}</span>
        </div>
        <div className={`${styles.amount} ${isIncome ? styles.income : styles.expense}`}>
          <span className={styles.amountLabel}>{isIncome ? 'Received' : 'Spent'}</span>
          <strong className={styles.amountValue}>{money(transaction.amount)}</strong>
        </div>
      </div>
      <div className={styles.meta} aria-label="Transaction overview">
        <span className={styles.metaItem}>
          <span className={styles.metaLabel}>Type</span>
          <span>{transaction.type === 'Eingang' ? 'Income' : 'Expense'}</span>
        </span>
        <span className={styles.metaItem}>
          <span className={styles.metaLabel}>Date</span>
          <time dateTime={transaction.date}>{formatDate(transaction.date)}</time>
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
