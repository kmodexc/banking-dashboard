import type { ReactElement } from 'react';
import type { Transaction } from '../../types';
import { money } from '../../utils/format';
import { SearchPreview } from '../shared/SearchPreview';
import { TransactionSummary } from '../transactions/TransactionSummary';

export function UnknownTransactionPicker({
  transactions,
  selected,
  onSelect,
}: {
  transactions: Transaction[];
  selected: Transaction | undefined;
  onSelect: (transaction: Transaction | undefined) => void;
}): ReactElement {
  const selectedIndex = selected
    ? transactions.findIndex((transaction) => transaction.id === selected.id)
    : -1;

  function moveSelection(offset: -1 | 1): void {
    const nextIndex = selectedIndex + offset;
    const nextTransaction = transactions[nextIndex];
    if (nextTransaction) onSelect(nextTransaction);
  }

  return (
    <article className="panel">
      <div className="panel-heading">
        <h2>Unknown outgoing transactions</h2>
        <span id="unknown-count" className="muted">
          {transactions.length} rows
        </span>
      </div>
      <select
        id="unknown-select"
        className="full-width"
        aria-label="Unknown transaction"
        value={selected?.id ?? ''}
        onChange={(event) =>
          onSelect(transactions.find((row) => row.id === event.currentTarget.value))
        }
      >
        {transactions.map((row) => (
          <option value={row.id} key={row.id}>
            {row.recipient} · {money(row.amount)} · {row.date}
          </option>
        ))}
      </select>
      <div className="unknown-navigation" aria-label="Unknown transaction navigation">
        <button
          className="button secondary"
          type="button"
          aria-label="Previous unknown transaction"
          disabled={selectedIndex <= 0}
          onClick={() => moveSelection(-1)}
        >
          Previous
        </button>
        <button
          className="button secondary"
          type="button"
          aria-label="Next unknown transaction"
          disabled={selectedIndex < 0 || selectedIndex >= transactions.length - 1}
          onClick={() => moveSelection(1)}
        >
          Next
        </button>
      </div>
      <div id="unknown-details" className="details">
        {selected ? (
          <TransactionSummary transaction={selected} />
        ) : (
          <span className="muted">No unknown outgoing transactions.</span>
        )}
      </div>
      {selected && <SearchPreview recipient={selected.recipient} purpose={selected.purpose} />}
    </article>
  );
}
