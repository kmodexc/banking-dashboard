import type { ChangeEvent, ReactElement, RefObject } from 'react';

export function CategoryActions({
  fileInput,
  onExport,
  onImport,
}: {
  fileInput: RefObject<HTMLInputElement | null>;
  onExport: () => void;
  onImport: (event: ChangeEvent<HTMLInputElement>) => void;
}): ReactElement {
  return (
    <div className="category-actions">
      <button className="button secondary" type="button" onClick={onExport}>
        Export categories
      </button>
      <label className="button secondary">
        Import categories
        <input
          ref={fileInput}
          className="file-picker-input"
          type="file"
          accept="application/json,.json"
          onChange={onImport}
        />
      </label>
    </div>
  );
}
