import { useMemo, useRef, useState, type ChangeEvent, type ReactElement } from 'react';
import { CategoryRuleSchema } from '../types';
import type { CategoryRule, ManagedRule, RuleCategoryOption } from '../types';
import { parseImportedRules, ruleKey, serializeRules } from '../data/rules';
import { RuleDeleteDialog } from './rules/RuleDeleteDialog';
import { RuleList } from './rules/RuleList';

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
  const fileInput = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState('');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<CategoryRule | null>(null);
  const [message, setMessage] = useState('');
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const normalizedFilter = filter.trim().toLocaleLowerCase();
  const visibleRules = useMemo(
    () =>
      rules.filter((entry) => {
        if (!normalizedFilter) return true;
        return [entry.rule.keyword, entry.categoryLabel]
          .join(' ')
          .toLocaleLowerCase()
          .includes(normalizedFilter);
      }),
    [normalizedFilter, rules],
  );

  function startEditing(entry: ManagedRule): void {
    setEditingKey(ruleKey(entry.rule));
    setDraft({ ...entry.rule });
    setMessage('');
  }

  function cancelEditing(): void {
    setEditingKey(null);
    setDraft(null);
    setMessage('');
  }

  function saveEditing(previous: CategoryRule): void {
    if (!draft) return;
    const result = CategoryRuleSchema.safeParse({
      ...draft,
      keyword: draft.keyword.trim(),
      category: draft.category.trim(),
    });
    if (!result.success) {
      setMessage('Rules need a keyword, category, and valid search column.');
      return;
    }
    const nextKey = ruleKey(result.data);
    if (
      nextKey !== ruleKey(previous) &&
      rules.some((entry) => entry.source === 'user' && ruleKey(entry.rule) === nextKey)
    ) {
      setMessage('A user rule with the same keyword, category, and search column already exists.');
      return;
    }
    onUpdate(previous, result.data);
    cancelEditing();
  }

  function deleteRule(rule: CategoryRule): void {
    onDelete(rule);
    if (editingKey === ruleKey(rule)) cancelEditing();
  }

  function exportRules(): void {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(
      new Blob([serializeRules(rulesToExport)], { type: 'application/json' }),
    );
    link.download = 'finance-dashboard-rules.json';
    link.click();
    URL.revokeObjectURL(link.href);
    setMessage('Rules exported.');
  }

  function openDeleteAllConfirmation(): void {
    setDeleteConfirmation('');
    setDeleteAllOpen(true);
  }

  function cancelDeleteAll(): void {
    setDeleteConfirmation('');
    setDeleteAllOpen(false);
  }

  function removeAllRules(): void {
    if (deleteConfirmation !== 'delete') return;
    onRemoveAll();
    cancelDeleteAll();
  }

  async function importRules(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    const imported = parseImportedRules(await file.text());
    if (!imported) {
      setMessage('The rules file is invalid.');
      return;
    }
    onImport(imported);
    setMessage('Rules imported.');
  }

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
          Showing {visibleRules.length} of {rules.length}
        </span>
      </div>
      <div className="category-actions">
        <button className="button secondary" type="button" onClick={exportRules}>
          Export rules
        </button>
        <label className="button secondary">
          Import rules
          <input
            ref={fileInput}
            className="file-picker-input"
            type="file"
            accept="application/json,.json"
            onChange={(event) => void importRules(event)}
          />
        </label>
        <button
          className="button remove-all-rules-button"
          type="button"
          disabled={!rulesToExport.length}
          onClick={openDeleteAllConfirmation}
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
          onChange={(event) => setFilter(event.currentTarget.value)}
        />
      </label>
      {message && <p className="notice category-auth-notice">{message}</p>}
      <RuleList
        rules={visibleRules}
        categories={categories}
        editingKey={editingKey}
        draft={draft}
        onStartEditing={startEditing}
        onDraftChange={setDraft}
        onSave={saveEditing}
        onCancel={cancelEditing}
        onDelete={deleteRule}
      />
      {!visibleRules.length && <p className="muted">No rules match this filter.</p>}
      {deleteAllOpen && (
        <RuleDeleteDialog
          confirmation={deleteConfirmation}
          onConfirmationChange={setDeleteConfirmation}
          onCancel={cancelDeleteAll}
          onConfirm={removeAllRules}
        />
      )}
    </article>
  );
}
