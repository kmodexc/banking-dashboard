import type { ReactElement } from 'react';
import type { Transaction } from '../../types';
import { formatDate, formatPeriod, money } from '../../utils/format';
import styles from './TransactionSummary.module.css';

function formatCurrencyAmount(value: number, currency?: string): string {
  if (!currency || currency === 'EUR') return money(value);
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

export function TransactionSummary({ transaction }: { transaction: Transaction }): ReactElement {
  const isIncome = transaction.counterpartyRole === 'payer' || transaction.amount >= 0;
  const counterpartyName = transaction.counterpartyName || transaction.recipient;
  const hasDifferentValueDate = Boolean(
    transaction.valueDate && transaction.valueDate !== transaction.date,
  );
  const hasCurrencyConversion = Boolean(
    transaction.originalAmount !== undefined &&
    transaction.originalCurrency &&
    transaction.originalCurrency !== transaction.currency,
  );

  return (
    <div className={styles.summary}>
      <div className={styles.header}>
        <div className={styles.identity}>
          <span className={styles.kicker}>{isIncome ? 'From' : 'To'}</span>
          <strong className={styles.recipient}>
            {counterpartyName || (isIncome ? 'Unnamed payer' : 'Unnamed recipient')}
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
        {hasDifferentValueDate && transaction.valueDate && (
          <span className={styles.metaItem}>
            <span className={styles.metaLabel}>Value date</span>
            <time dateTime={transaction.valueDate}>{formatDate(transaction.valueDate)}</time>
          </span>
        )}
        {transaction.status && (
          <span className={styles.metaItem}>
            <span className={styles.metaLabel}>Status</span>
            <span>{transaction.status}</span>
          </span>
        )}
        {transaction.paymentMethod && (
          <span className={styles.metaItem}>
            <span className={styles.metaLabel}>Method</span>
            <span>{transaction.paymentMethod}</span>
          </span>
        )}
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
        {transaction.currency && (
          <div>
            <dt>Currency</dt>
            <dd>{transaction.currency}</dd>
          </div>
        )}
        {hasCurrencyConversion && transaction.originalAmount !== undefined && (
          <div>
            <dt>Original amount</dt>
            <dd>
              {formatCurrencyAmount(transaction.originalAmount, transaction.originalCurrency)}
            </dd>
          </div>
        )}
        {hasCurrencyConversion && transaction.exchangeRate !== undefined && (
          <div>
            <dt>Exchange rate</dt>
            <dd>{transaction.exchangeRate}</dd>
          </div>
        )}
        {transaction.bankReference && (
          <div>
            <dt>Bank reference</dt>
            <dd>{transaction.bankReference}</dd>
          </div>
        )}
        {transaction.balanceAfter !== undefined && (
          <div>
            <dt>Balance after</dt>
            <dd>{formatCurrencyAmount(transaction.balanceAfter, transaction.currency)}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
