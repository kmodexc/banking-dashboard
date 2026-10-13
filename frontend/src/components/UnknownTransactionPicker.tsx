import type { ReactElement } from 'react';
import type { Transaction } from '../types';
import { money } from '../utils/format';
import { SearchPreview } from './SearchPreview';

export function UnknownTransactionPicker({
  transactions,
  selected,
  onSelect,
}: {
  transactions: Transaction[];
  selected: Transaction | undefined;
  onSelect: (transaction: Transaction | undefined) => void;
}): ReactElement {
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
      <div id="unknown-details" className="details">
        {selected ? (
          <>
            <strong>{selected.recipient}</strong>
            <br />
            {selected.purpose}
            <br />
            <span className="muted">
              {selected.date} · {money(selected.amount)}
            </span>
          </>
        ) : (
          <span className="muted">No unknown outgoing transactions.</span>
        )}
      </div>
      {selected && <SearchPreview recipient={selected.recipient} purpose={selected.purpose} />}
    </article>
  );
}
