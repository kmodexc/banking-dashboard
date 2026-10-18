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
    <>
      <details className="rule-management-tools">
        <summary>Manage rules</summary>
        <div className="rule-management-content">
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
        </div>
      </details>
      <RuleSummaryList
        rules={manager.visibleRules}
        categories={categories}
        title="Categorization rules"
        listLabel="Categorization rule list"
        emptyMessage="No rules match this filter."
        onSave={(previous, next) => manager.saveEditing(previous, next)}
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
    </>
  );
}
