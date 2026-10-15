import type { ReactElement } from 'react';
import type { AuthSnapshot, RulePreferences } from '../types';
import type { CategoryEntry, UserCategoryState } from '../data/categories';
import { CategoryEditor } from './CategoryEditor';
import { RuleSharingSettings } from './RuleSharingSettings';

export function Categories({
  auth,
  entries,
  state,
  onAdd,
  onRename,
  onDelete,
  onImport,
  rulePreferences,
  onRulePreferencesChange,
  onSyncRules,
  onDeleteServerRules,
  ruleSyncStatus,
}: {
  auth: AuthSnapshot;
  entries: CategoryEntry[];
  state: UserCategoryState;
  onAdd: (name: string) => void;
  onRename: (entry: CategoryEntry, name: string) => void;
  onDelete: (entry: CategoryEntry) => void;
  onImport: (next: UserCategoryState) => void;
  rulePreferences: RulePreferences;
  onRulePreferencesChange: (preferences: RulePreferences) => void;
  onSyncRules: () => void;
  onDeleteServerRules: () => void;
  ruleSyncStatus: string;
}): ReactElement {
  return (
    <section id="categories-tab" className="tab-panel">
      <CategoryEditor
        auth={auth}
        entries={entries}
        state={state}
        onAdd={onAdd}
        onRename={onRename}
        onDelete={onDelete}
        onImport={onImport}
      />
      <RuleSharingSettings
        auth={auth}
        rulePreferences={rulePreferences}
        onRulePreferencesChange={onRulePreferencesChange}
        onSyncRules={onSyncRules}
        onDeleteServerRules={onDeleteServerRules}
        ruleSyncStatus={ruleSyncStatus}
      />
    </section>
  );
}
