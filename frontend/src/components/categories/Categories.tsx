import type { ReactElement } from 'react';
import type { CategoryEntry, UserCategoryState } from '../../data/categories';
import { RuleList } from '../rules/RuleList';
import type { RulesController } from '../rules/ruleTypes';
import { CategoryEditor } from './CategoryEditor';

export function Categories({
  entries,
  state,
  onAdd,
  onRename,
  onDelete,
  onImport,
  rulesController,
}: {
  entries: CategoryEntry[];
  state: UserCategoryState;
  onAdd: (name: string) => void;
  onRename: (entry: CategoryEntry, name: string) => void;
  onDelete: (entry: CategoryEntry) => void;
  onImport: (next: UserCategoryState) => void;
  rulesController: RulesController;
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
      <RuleList rulesController={rulesController} />
    </section>
  );
}
