import { useMemo, useRef, useState, type ChangeEvent, type ReactElement } from 'react';
import { parseImportedRules, ruleKey, serializeRules } from '../../data/rules';
import { CategoryRuleSchema } from '../../types';
import type { CategoryRule, ManagedRule } from '../../types';
import { RuleDeleteDialog } from './RuleDeleteDialog';
import { RuleForm } from './RuleForm';
import type { RulesController } from './ruleTypes';

type RuleSort = 'time' | 'name' | 'category';

function getRule(entry: ManagedRule): CategoryRule {
  return entry.rule;
}

function getCategoryLabel(entry: ManagedRule): string {
  return entry.categoryLabel;
}

function addedAtValue(rule: CategoryRule): number {
  if (!rule.createdAt) return 0;
  const value = Date.parse(rule.createdAt);
  return Number.isNaN(value) ? 0 : value;
}

function addedAtLabel(rule: CategoryRule): string {
  if (!rule.createdAt || Number.isNaN(Date.parse(rule.createdAt))) {
    return 'Date not recorded';
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(rule.createdAt));
}

export function RuleList({ rulesController }: { rulesController: RulesController }): ReactElement {
  const { rules, categories, editableRules, actions } = rulesController;
  const fileInput = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState('');
  const [message, setMessage] = useState('');
  const [sort, setSort] = useState<RuleSort>('time');
  const [selectedEntry, setSelectedEntry] = useState<ManagedRule | null>(null);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const normalizedFilter = filter.trim().toLocaleLowerCase();
  const visibleRules = useMemo(
    () =>
      rules.filter((entry) => {
        if (!normalizedFilter) return true;
        return [getRule(entry).keyword, getCategoryLabel(entry)]
          .join(' ')
          .toLocaleLowerCase()
          .includes(normalizedFilter);
      }),
    [normalizedFilter, rules],
  );
  const sortedRules = useMemo(() => {
    const next = [...visibleRules];
    next.sort((left, right) => {
      const leftRule = getRule(left);
      const rightRule = getRule(right);
      if (sort === 'name') return leftRule.keyword.localeCompare(rightRule.keyword);
      if (sort === 'category') return getCategoryLabel(left).localeCompare(getCategoryLabel(right));
      return addedAtValue(rightRule) - addedAtValue(leftRule);
    });
    return next;
  }, [sort, visibleRules]);

  function saveRule(previous: CategoryRule, nextRule: CategoryRule): string | null {
    const result = CategoryRuleSchema.safeParse({
      ...nextRule,
      keyword: nextRule.keyword.trim(),
      category: nextRule.category.trim(),
    });
    if (!result.success) {
      const nextMessage = 'Rules need a keyword, category, and valid search column.';
      setMessage(nextMessage);
      return nextMessage;
    }
    const nextKey = ruleKey(result.data);
    if (
      nextKey !== ruleKey(previous) &&
      rules.some((entry) => ruleKey(getRule(entry)) === nextKey)
    ) {
      const nextMessage =
        'A rule with the same keyword, category, and search column already exists.';
      setMessage(nextMessage);
      return nextMessage;
    }
    actions.updateRule(previous, result.data);
    setMessage('');
    return null;
  }

  function exportRules(): void {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(
      new Blob([serializeRules(editableRules)], { type: 'application/json' }),
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
    actions.importRules(imported);
    setMessage('Rules imported.');
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
    actions.removeAllRules();
    cancelDeleteAll();
  }

  return (
    <section className="recent-rules rule-list-panel panel" aria-labelledby="rules-heading">
      <div className="rule-list-heading">
        <div>
          <p className="eyebrow accent-eyebrow">Personal automation</p>
          <h2 id="rules-heading">Categorization rules</h2>
          <p className="muted small">Search, sort, and select a rule to edit its details.</p>
        </div>
        <div className="rule-list-header-right">
          <div className="rule-list-total" aria-label={`${rules.length} total rules`}>
            <strong>{rules.length}</strong>
            <span>total rules</span>
          </div>
          <div className="category-actions rule-list-header-actions">
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
              disabled={!editableRules.length}
              onClick={openDeleteAllConfirmation}
            >
              Remove all rules
            </button>
          </div>
        </div>
      </div>
      <div className="rule-list-toolbar">
        <label className="rule-filter">
          <span>Search rules</span>
          <input
            type="search"
            aria-label="Filter rules"
            placeholder="Keyword or category"
            value={filter}
            onChange={(event) => setFilter(event.currentTarget.value)}
          />
        </label>
        <label className="rule-sort">
          Sort by
          <select
            aria-label="Categorization rules sort order"
            value={sort}
            onChange={(event) => setSort(event.currentTarget.value as RuleSort)}
          >
            <option value="time">Time added</option>
            <option value="name">Name</option>
            <option value="category">Category</option>
          </select>
        </label>
      </div>
      <div className="rule-list-status">
        <span className="rule-list-results">
          {visibleRules.length} of {rules.length} shown
        </span>
        <span className="muted small">
          Import replaces editable rules; shared rules stay unchanged.
        </span>
      </div>
      {message && <p className="notice category-auth-notice rule-list-message">{message}</p>}
      {sortedRules.length ? (
        <ul className="recent-rule-list rule-list" aria-label="Categorization rule list">
          {sortedRules.map((entry) => {
            const rule = getRule(entry);
            const key = ruleKey(rule);
            return (
              <li
                className="recent-rule rule-list-item rule-row"
                key={`${'source' in entry ? entry.source : 'user'}:${key}`}
              >
                <button
                  className="rule-summary-trigger"
                  type="button"
                  onClick={() => setSelectedEntry(entry)}
                >
                  <span className="rule-list-main">
                    <strong>{rule.keyword}</strong>
                    <span className="rule-list-category">{getCategoryLabel(entry)}</span>
                  </span>
                  <span className="rule-list-meta">
                    <span className="rule-list-chip">Searches {rule.column}</span>
                    <time dateTime={rule.createdAt} className="rule-list-time">
                      {addedAtLabel(rule)}
                    </time>
                    <span className="rule-list-arrow" aria-hidden="true">
                      →
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="rule-list-empty">
          <strong>No rules match this filter.</strong>
          <span className="muted small">Try another keyword or category.</span>
        </div>
      )}
      {selectedEntry && (
        <RuleForm
          rule={getRule(selectedEntry)}
          categories={categories}
          onSave={(next) => saveRule(getRule(selectedEntry), next)}
          onDelete={() => actions.deleteRule(getRule(selectedEntry))}
          onClose={() => setSelectedEntry(null)}
        />
      )}
      {deleteAllOpen && (
        <RuleDeleteDialog
          confirmation={deleteConfirmation}
          onConfirmationChange={setDeleteConfirmation}
          onCancel={cancelDeleteAll}
          onConfirm={removeAllRules}
        />
      )}
    </section>
  );
}
