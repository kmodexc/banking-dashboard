import { useState, type ReactElement } from 'react';
import type { Transaction } from '../types';
import { formatDate, money, sortRows, type SortKey } from '../utils/format';

export function TransactionTable({
  rows,
  onSelect,
}: {
  rows: Transaction[];
  onSelect: (transactionId: string) => void;
}): ReactElement {
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const sortedRows = sortRows(rows, sortKey, sortDirection);

  function updateSort(nextKey: SortKey): void {
    if (nextKey === sortKey) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(nextKey);
      setSortDirection(nextKey === 'date' ? 'desc' : 'asc');
    }
  }

  function renderSortHeader(label: string, key: SortKey): ReactElement {
    const active = sortKey === key;
    return (
      <button
        className={`sort-button${active ? ' active' : ''}`}
        type="button"
        aria-label={`Sort by ${label}`}
        aria-sort={active ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
        onClick={() => updateSort(key)}
      >
        {label}
        <span aria-hidden="true">{active ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</span>
      </button>
    );
  }

  return (
    <>
      <div className="panel-heading">
        <div>
          <h2>Transactions</h2>
          <span id="transaction-count" className="muted">
            {rows.length} rows · click a row for details
          </span>
        </div>
        <span className="muted small">Sorted by {sortKey}</span>
      </div>
      <div className="table-wrap">
        <table id="transaction-table">
          <thead>
            <tr>
              <th>{renderSortHeader('Date', 'date')}</th>
              <th>{renderSortHeader('Recipient', 'recipient')}</th>
              <th className="amount-heading">{renderSortHeader('Amount', 'amount')}</th>
              <th>{renderSortHeader('Type', 'type')}</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.slice(0, 500).map((row) => (
              <tr
                key={row.id}
                className="transaction-row"
                tabIndex={0}
                onClick={() => onSelect(row.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') onSelect(row.id);
                }}
              >
                <td>{formatDate(row.date)}</td>
                <td className="recipient-cell">
                  <span>{row.recipient}</span>
                  <span className="category-badge">{row.category}</span>
                </td>
                <td className="amount">{money(row.amount)}</td>
                <td>
                  <span className={`type-badge ${row.type === 'Eingang' ? 'income' : 'expense'}`}>
                    {row.type === 'Eingang' ? 'Income' : 'Expense'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <p className="muted empty-table">No transactions match the selected categories.</p>
        )}
      </div>
    </>
  );
}
