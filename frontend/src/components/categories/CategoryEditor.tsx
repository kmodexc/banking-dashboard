import { useRef, useState, type ChangeEvent, type ReactElement } from 'react';
import {
  parseImportedCategoryState,
  serializeUserCategoryState,
  type CategoryEntry,
} from '../../data/categories';
import { CategoryActions } from './CategoryActions';
import { CategoryList } from './CategoryList';
import type { CategoriesController } from './categoryTypes';

export function CategoryEditor({
  categoriesController,
}: {
  categoriesController: CategoriesController;
}): ReactElement {
  const { entries, state, actions } = categoriesController;
  const fileInput = useRef<HTMLInputElement>(null);
  const [newName, setNewName] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');

  function exportCategories(): void {
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
    const imported = parseImportedCategoryState(await file.text());
    if (!imported) {
      setMessage('The category file is invalid.');
      return;
    }
    actions.importCategories(imported);
    setMessage('Categories imported.');
  }

  function addCategory(): void {
    const normalized = newName.trim();
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
    actions.addCategory(normalized);
    setNewName('');
    setMessage('Category added.');
  }

  function renameCategory(entry: CategoryEntry): void {
    const name = (drafts[entry.key] ?? entry.name).trim();
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
    actions.renameCategory(entry, name);
    setMessage('Category renamed.');
  }

  function deleteCategory(entry: CategoryEntry): void {
    actions.deleteCategory(entry);
    setMessage('Category deleted for this user.');
  }

  return (
    <article className="panel">
      <div className="panel-heading">
        <div>
          <h2>Categories</h2>
          <p className="muted">
            All categories are personal. Your changes apply only to you and stay in this browser.
            Configure private synchronization on the Account page.
          </p>
        </div>
        <CategoryActions
          fileInput={fileInput}
          onExport={exportCategories}
          onImport={(event) => void importCategories(event)}
        />
      </div>
      <div className="category-add-row">
        <input
          aria-label="New category name"
          maxLength={80}
          placeholder="New category name"
          value={newName}
          onChange={(event) => setNewName(event.currentTarget.value)}
        />
        <button className="button primary" type="button" onClick={addCategory}>
          Add category
        </button>
      </div>
      <CategoryList
        entries={entries}
        drafts={drafts}
        onDraftChange={(entry, value) =>
          setDrafts((current) => ({ ...current, [entry.key]: value }))
        }
        onRename={renameCategory}
        onDelete={deleteCategory}
      />
      {message && <p className="muted small">{message}</p>}
    </article>
  );
}
