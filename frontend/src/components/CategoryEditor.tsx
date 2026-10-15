import { useRef, useState, type ChangeEvent, type ReactElement } from 'react';
import type { AuthSnapshot } from '../types';
import {
  parseImportedCategoryState,
  serializeUserCategoryState,
  type CategoryEntry,
  type UserCategoryState,
} from '../data/categories';

export function CategoryEditor({
  auth,
  entries,
  state,
  onAdd,
  onRename,
  onDelete,
  onImport,
}: {
  auth: AuthSnapshot;
  entries: CategoryEntry[];
  state: UserCategoryState;
  onAdd: (name: string) => void;
  onRename: (entry: CategoryEntry, name: string) => void;
  onDelete: (entry: CategoryEntry) => void;
  onImport: (next: UserCategoryState) => void;
}): ReactElement {
  const canEdit = Boolean(auth.token);
  const fileInput = useRef<HTMLInputElement>(null);
  const [newName, setNewName] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');

  function exportCategories(): void {
    if (!canEdit) {
      setMessage('Sign in to export user-specific categories.');
      return;
    }
    const link = document.createElement('a');
    link.href = URL.createObjectURL(
      new Blob([serializeUserCategoryState(state)], { type: 'application/json' }),
    );
    link.download = 'finance-dashboard-categories.json';
    link.click();
    URL.revokeObjectURL(link.href);
    setMessage('Categories exported.');
  }

  async function importCategories(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    if (!canEdit) {
      setMessage('Sign in to import user-specific categories.');
      return;
    }
    const imported = parseImportedCategoryState(await file.text());
    if (!imported) {
      setMessage('The category file is invalid.');
      return;
    }
    onImport(imported);
    setMessage('Categories imported.');
  }

  function addCategory(): void {
    const normalized = newName.trim();
    if (!canEdit) {
      setMessage('Sign in to add user-specific categories.');
      return;
    }
    if (normalized.length < 1 || normalized.length > 80) {
      setMessage('Category names must contain 1 to 80 characters.');
      return;
    }
    if (
      entries.some((entry) => entry.name.toLocaleLowerCase() === normalized.toLocaleLowerCase())
    ) {
      setMessage('That category already exists.');
      return;
    }
    onAdd(normalized);
    setNewName('');
    setMessage('Category added.');
  }

  function renameCategory(entry: CategoryEntry): void {
    const name = (drafts[entry.key] ?? entry.name).trim();
    if (!canEdit) {
      setMessage('Sign in to rename user-specific categories.');
      return;
    }
    if (!name || name.length > 80) {
      setMessage('Category names must contain 1 to 80 characters.');
      return;
    }
    if (
      entries.some(
        (candidate) =>
          candidate.key !== entry.key &&
          candidate.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
      )
    ) {
      setMessage('That category already exists.');
      return;
    }
    onRename(entry, name);
    setMessage('Category renamed.');
  }

  function deleteCategory(entry: CategoryEntry): void {
    if (!canEdit) {
      setMessage('Sign in to delete user-specific categories.');
      return;
    }
    onDelete(entry);
    setMessage('Category deleted for this user.');
  }

  return (
    <article className="panel">
      <div className="panel-heading">
        <div>
          <h2>Categories</h2>
          <p className="muted">
            All categories are personal. Your changes apply only to you and stay in this browser
            until you choose private online storage.
          </p>
        </div>
        <div className="category-actions">
          <button
            className="button secondary"
            type="button"
            disabled={!canEdit}
            onClick={exportCategories}
          >
            Export categories
          </button>
          <label className={`button secondary${!canEdit ? ' disabled' : ''}`}>
            Import categories
            <input
              ref={fileInput}
              className="file-picker-input"
              type="file"
              accept="application/json,.json"
              disabled={!canEdit}
              onChange={(event) => void importCategories(event)}
            />
          </label>
        </div>
      </div>
      {!canEdit && (
        <p className="notice category-auth-notice">
          Sign in to add, rename, delete, import, or export user-specific categories.
        </p>
      )}
      <div className="category-add-row">
        <input
          aria-label="New category name"
          maxLength={80}
          placeholder="New category name"
          value={newName}
          disabled={!canEdit}
          onChange={(event) => setNewName(event.currentTarget.value)}
        />
        <button className="button primary" type="button" disabled={!canEdit} onClick={addCategory}>
          Add category
        </button>
      </div>
      <div className="category-list" aria-label="Category list">
        {entries.map((entry) => (
          <div className="category-row" key={entry.key}>
            <div>
              <span className="category-source">Personal</span>
              <input
                aria-label={`${entry.name} category name`}
                maxLength={80}
                value={drafts[entry.key] ?? entry.name}
                disabled={!canEdit}
                onChange={(event) => {
                  const { value } = event.currentTarget;
                  setDrafts((current) => ({ ...current, [entry.key]: value }));
                }}
              />
            </div>
            <div className="category-row-actions">
              <button
                className="button secondary"
                type="button"
                disabled={!canEdit}
                onClick={() => renameCategory(entry)}
              >
                Rename
              </button>
              <button
                className="button secondary danger-button"
                type="button"
                disabled={!canEdit}
                onClick={() => deleteCategory(entry)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
      {message && <p className="muted small">{message}</p>}
    </article>
  );
}
