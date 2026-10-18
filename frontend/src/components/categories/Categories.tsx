import type { ReactElement, ReactNode } from 'react';
import type { CategoryEntry, UserCategoryState } from '../../data/categories';
import { CategoryEditor } from './CategoryEditor';

export function Categories({
  entries,
  state,
  onAdd,
  onRename,
  onDelete,
  onImport,
  children,
}: {
  entries: CategoryEntry[];
  state: UserCategoryState;
  onAdd: (name: string) => void;
  onRename: (entry: CategoryEntry, name: string) => void;
  onDelete: (entry: CategoryEntry) => void;
  onImport: (next: UserCategoryState) => void;
  children?: ReactNode;
}): ReactElement {
  return (
    <section id="categories-tab" className="tab-panel">
      <CategoryEditor
        entries={entries}
        state={state}
        onAdd={onAdd}
        onRename={onRename}
        onDelete={onDelete}
        onImport={onImport}
      />
      {children}
    </section>
  );
}
