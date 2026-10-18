import type { ReactElement } from 'react';
import type { CategoryEntry } from '../../data/categories';

export function CategoryList({
  entries,
  drafts,
  onDraftChange,
  onRename,
  onDelete,
}: {
  entries: CategoryEntry[];
  drafts: Record<string, string>;
  onDraftChange: (entry: CategoryEntry, value: string) => void;
  onRename: (entry: CategoryEntry) => void;
  onDelete: (entry: CategoryEntry) => void;
}): ReactElement {
  return (
    <div className="category-list" aria-label="Category list">
      {entries.map((entry) => (
        <div className="category-row" key={entry.key}>
          <div>
            <span className="category-source">Personal</span>
            <input
              aria-label={`${entry.name} category name`}
              maxLength={80}
              value={drafts[entry.key] ?? entry.name}
              onChange={(event) => onDraftChange(entry, event.currentTarget.value)}
            />
          </div>
          <div className="category-row-actions">
            <button className="button secondary" type="button" onClick={() => onRename(entry)}>
              Rename
            </button>
            <button
              className="button secondary danger-button"
              type="button"
              onClick={() => onDelete(entry)}
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
