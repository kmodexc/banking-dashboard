import type { ReactElement } from 'react';
import type { CategoryRule, ManagedRule, RuleCategoryOption } from '../types';
import { useRuleManager } from '../hooks/useRuleManager';
import { RuleDeleteDialog } from './rules/RuleDeleteDialog';
import { RuleList } from './rules/RuleList';
import { RuleManagerToolbar } from './rules/RuleManagerToolbar';

export type { ManagedRule, RuleCategoryOption } from '../types';

export function RuleManager({
  rules,
  categories,
  rulesToExport,
  onImport,
  onUpdate,
  onDelete,
  onRemoveAll,
}: {
  rules: ManagedRule[];
  categories: RuleCategoryOption[];
  rulesToExport: CategoryRule[];
  onImport: (rules: CategoryRule[]) => void;
  onUpdate: (previous: CategoryRule, next: CategoryRule) => void;
  onDelete: (rule: CategoryRule) => void;
  onRemoveAll: () => void;
}): ReactElement {
  const manager = useRuleManager({
    rules,
    rulesToExport,
    onImport,
    onUpdate,
    onDelete,
    onRemoveAll,
  });

  return (
    <article className="panel rule-manager-panel">
      <div className="panel-heading">
        <div>
          <h2>Categorization rules</h2>
          <p className="muted">
            All rules are personal and can be changed or deleted. Newest rules are shown first.
          </p>
        </div>
        <span className="muted small">
          Showing {manager.visibleRules.length} of {rules.length}
        </span>
      </div>
      <RuleManagerToolbar
        fileInput={manager.fileInput}
        filter={manager.filter}
        canRemoveAll={Boolean(rulesToExport.length)}
        onFilterChange={manager.setFilter}
        onExport={manager.exportRules}
        onImport={(event) => void manager.importRules(event)}
        onRemoveAll={manager.openDeleteAllConfirmation}
      />
      {manager.message && <p className="notice category-auth-notice">{manager.message}</p>}
      <RuleList
        rules={manager.visibleRules}
        categories={categories}
        editingKey={manager.editingKey}
        draft={manager.draft}
        onStartEditing={manager.startEditing}
        onDraftChange={manager.setDraft}
        onSave={manager.saveEditing}
        onCancel={manager.cancelEditing}
        onDelete={manager.deleteRule}
      />
      {!manager.visibleRules.length && <p className="muted">No rules match this filter.</p>}
      {manager.deleteAllOpen && (
        <RuleDeleteDialog
          confirmation={manager.deleteConfirmation}
          onConfirmationChange={manager.setDeleteConfirmation}
          onCancel={manager.cancelDeleteAll}
          onConfirm={manager.removeAllRules}
        />
      )}
    </article>
  );
}
