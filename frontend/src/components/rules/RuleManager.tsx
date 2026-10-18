import type { ReactElement } from 'react';
import type { CategoryRule, ManagedRule, RuleCategoryOption } from '../../types';
import { useRuleManager } from '../../hooks/useRuleManager';
import { RuleDeleteDialog } from './RuleDeleteDialog';
import { RuleManagerToolbar } from './RuleManagerToolbar';
import { RuleSummaryList } from './RuleSummaryList';

export type { ManagedRule, RuleCategoryOption } from '../../types';

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
          <p className="muted">All rules are personal and can be changed or deleted.</p>
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
      <RuleSummaryList
        rules={manager.visibleRules}
        categories={categories}
        listLabel="Categorization rule list"
        emptyMessage="No rules match this filter."
        embedded
        editingKey={manager.editingKey}
        draft={manager.draft}
        onStartEditing={manager.startEditing}
        onDraftChange={manager.setDraft}
        onSave={manager.saveEditing}
        onCancel={manager.cancelEditing}
        onDelete={manager.deleteRule}
      />
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
