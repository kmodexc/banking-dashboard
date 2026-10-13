import { useMemo, useRef, useState, type ChangeEvent, type ReactElement } from 'react';
import { CategoryRuleSchema, RuleColumnSchema } from '../types';
import type { CategoryRule } from '../types';
import { parseImportedRules, ruleKey, serializeRules } from '../data/rules';

export type ManagedRuleSource = 'user' | 'community' | 'global';

export interface ManagedRule {
  rule: CategoryRule;
  categoryLabel: string;
  source: ManagedRuleSource;
}

export interface RuleCategoryOption {
  value: string;
  label: string;
}

const sourceLabels: Record<ManagedRuleSource, string> = {
  user: 'Your rule',
  community: 'Community',
  global: 'Global',
};

export function RuleManager({
  rules,
  categories,
  rulesToExport,
  onImport,
  onUpdate,
  onDelete,
}: {
  rules: ManagedRule[];
  categories: RuleCategoryOption[];
  rulesToExport: CategoryRule[];
  onImport: (rules: CategoryRule[]) => void;
  onUpdate: (previous: CategoryRule, next: CategoryRule) => void;
  onDelete: (rule: CategoryRule) => void;
}): ReactElement {
  const fileInput = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState('');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<CategoryRule | null>(null);
  const [message, setMessage] = useState('');
  const normalizedFilter = filter.trim().toLocaleLowerCase();
  const visibleRules = useMemo(
    () =>
      rules.filter((entry) => {
        if (!normalizedFilter) return true;
        return [entry.rule.keyword, entry.categoryLabel, sourceLabels[entry.source]]
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
            Your rules can be changed or deleted. Global and community rules are available for
            reference and remain read-only.
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
      <div className="rule-list" aria-label="Categorization rule list">
        {visibleRules.map((entry) => {
          const key = ruleKey(entry.rule);
          const isEditing = editingKey === key && draft;
          return (
            <div className="rule-row" key={`${entry.source}:${key}`}>
              {isEditing ? (
                <RuleEditor
                  draft={draft}
                  categories={categories}
                  onChange={setDraft}
                  onSave={() => saveEditing(entry.rule)}
                  onCancel={cancelEditing}
                />
              ) : (
                <>
                  <div className="rule-row-content">
                    <strong>{entry.rule.keyword}</strong>
                    <span className="rule-row-category">{entry.categoryLabel}</span>
                    <span className="rule-row-column">Searches {entry.rule.column}</span>
                    <span className={`rule-source rule-source-${entry.source}`}>
                      {sourceLabels[entry.source]}
                    </span>
                  </div>
                  {entry.source === 'user' && (
                    <div className="category-row-actions">
                      <button
                        className="button secondary"
                        type="button"
                        onClick={() => startEditing(entry)}
                      >
                        Edit
                      </button>
                      <button
                        className="button secondary danger-button"
                        type="button"
                        onClick={() => deleteRule(entry.rule)}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
      {!visibleRules.length && <p className="muted">No rules match this filter.</p>}
    </article>
  );
}

function RuleEditor({
  draft,
  categories,
  onChange,
  onSave,
  onCancel,
}: {
  draft: CategoryRule;
  categories: RuleCategoryOption[];
  onChange: (rule: CategoryRule) => void;
  onSave: () => void;
  onCancel: () => void;
}): ReactElement {
  function changeColumn(value: string): void {
    onChange({ ...draft, column: RuleColumnSchema.parse(value) });
  }

  return (
    <div className="rule-editor">
      <label>
        Keyword
        <input
          aria-label="Edit rule keyword"
          maxLength={200}
          value={draft.keyword}
          onChange={(event) => onChange({ ...draft, keyword: event.currentTarget.value })}
        />
      </label>
      <label>
        Search in
        <select value={draft.column} onChange={(event) => changeColumn(event.currentTarget.value)}>
          <option value="recipient">Recipient</option>
          <option value="purpose">Purpose</option>
          <option value="both">Both</option>
        </select>
      </label>
      <div className="rule-category-editor category-editor">
        <span className="category-editor-label">Category</span>
        <div className="category-buttons" role="radiogroup" aria-label="Edit rule category">
          {categories.map((category) => (
            <label className="category-choice" key={category.value}>
              <input
                type="radio"
                name="edit-rule-category"
                value={category.value}
                checked={draft.category === category.value}
                onChange={() => onChange({ ...draft, category: category.value })}
              />
              <span>{category.label}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="category-row-actions">
        <button className="button primary" type="button" onClick={onSave}>
          Save rule
        </button>
        <button className="button secondary" type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
