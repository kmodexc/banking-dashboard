import type { ChangeEvent, ReactElement, RefObject } from 'react';

export function RuleManagerToolbar({
  fileInput,
  filter,
  canRemoveAll,
  onFilterChange,
  onExport,
  onImport,
  onRemoveAll,
}: {
  fileInput: RefObject<HTMLInputElement | null>;
  filter: string;
  canRemoveAll: boolean;
  onFilterChange: (value: string) => void;
  onExport: () => void;
  onImport: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemoveAll: () => void;
}): ReactElement {
  return (
    <>
      <div className="category-actions">
        <button className="button secondary" type="button" onClick={onExport}>
          Export rules
        </button>
        <label className="button secondary">
          Import rules
          <input
            ref={fileInput}
            className="file-picker-input"
            type="file"
            accept="application/json,.json"
            onChange={onImport}
          />
        </label>
        <button
          className="button remove-all-rules-button"
          type="button"
          disabled={!canRemoveAll}
          onClick={onRemoveAll}
        >
          Remove all rules
        </button>
      </div>
      <p className="muted small">
        Importing replaces your editable rules. Read-only shared rules stay unchanged.
      </p>
      <label className="rule-filter">
        Filter rules
        <input
          type="search"
          aria-label="Filter rules"
          placeholder="Keyword, category, or source"
          value={filter}
          onChange={(event) => onFilterChange(event.currentTarget.value)}
        />
      </label>
    </>
  );
}
