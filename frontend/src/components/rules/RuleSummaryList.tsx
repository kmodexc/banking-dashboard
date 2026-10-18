import { useMemo, useRef, useState, type ChangeEvent, type ReactElement } from 'react';
import { parseImportedRules, ruleKey, serializeRules } from '../../data/rules';
import { CategoryRuleSchema } from '../../types';
import type { CategoryRule, ManagedRule, RuleCategoryOption } from '../../types';
import { RuleDeleteDialog } from './RuleDeleteDialog';
import { RuleDetailsModal } from './RuleDetailsModal';

type RuleEntry = CategoryRule | ManagedRule;
type RuleSort = 'time' | 'name' | 'category';

function getRule(entry: RuleEntry): CategoryRule {
  return 'rule' in entry ? entry.rule : entry;
}

function getCategoryLabel(entry: RuleEntry): string {
  return 'categoryLabel' in entry ? entry.categoryLabel : entry.category;
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

export function RuleSummaryList({
  rules,
  categories,
  title = 'Recently added rules',
  description = 'Select a rule to view its details.',
  listLabel = 'Recently added rules',
  emptyMessage = 'No rules added yet.',
  rulesToExport,
  onImport,
  onUpdate,
  onDelete,
  onRemoveAll,
}: {
  rules: RuleEntry[];
  categories?: RuleCategoryOption[];
  title?: string;
  description?: string;
  listLabel?: string;
  emptyMessage?: string;
  rulesToExport?: CategoryRule[];
  onImport?: (rules: CategoryRule[]) => void;
  onUpdate?: (previous: CategoryRule, next: CategoryRule) => void;
  onDelete?: (rule: CategoryRule) => void;
  onRemoveAll?: () => void;
}): ReactElement {
  const fileInput = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState('');
  const [message, setMessage] = useState('');
  const [sort, setSort] = useState<RuleSort>('time');
  const [selectedEntry, setSelectedEntry] = useState<RuleEntry | null>(null);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const isManageable = rulesToExport !== undefined;
  const normalizedFilter = filter.trim().toLocaleLowerCase();
  const visibleRules = useMemo(
    () =>
      rules.filter((entry) => {
        if (!isManageable || !normalizedFilter) return true;
        return [getRule(entry).keyword, getCategoryLabel(entry)]
          .join(' ')
          .toLocaleLowerCase()
          .includes(normalizedFilter);
      }),
    [isManageable, normalizedFilter, rules],
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
    if (!onUpdate) return null;
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
    onUpdate(previous, result.data);
    setMessage('');
    return null;
  }

  function exportRules(): void {
    if (!rulesToExport) return;
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
    if (!file || !onImport) return;
    const imported = parseImportedRules(await file.text());
    if (!imported) {
      setMessage('The rules file is invalid.');
      return;
    }
    onImport(imported);
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
    if (deleteConfirmation !== 'delete' || !onRemoveAll) return;
    onRemoveAll();
    cancelDeleteAll();
  }

  return (
    <section className="recent-rules panel" aria-labelledby="recent-rules-heading">
      <div className="recent-rules-heading">
        <div>
          <h2 id="recent-rules-heading">{title}</h2>
          <p className="muted small">{description}</p>
        </div>
        <div className="recent-rules-header-controls">
          <label className="rule-sort">
            Sort by
            <select
              aria-label={`${listLabel} sort order`}
              value={sort}
              onChange={(event) => setSort(event.currentTarget.value as RuleSort)}
            >
              <option value="time">Time added</option>
              <option value="name">Name</option>
              <option value="category">Category</option>
            </select>
          </label>
        </div>
      </div>
      {isManageable && (
        <div className="rule-management-content">
          <div className="rule-management-heading">
            <strong>Manage rules</strong>
            <span className="muted small">
              {visibleRules.length} of {rules.length} shown
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
              placeholder="Keyword or category"
              value={filter}
              onChange={(event) => setFilter(event.currentTarget.value)}
            />
          </label>
          {message && <p className="notice category-auth-notice">{message}</p>}
        </div>
      )}
      {sortedRules.length ? (
        <ol className="recent-rule-list" aria-label={listLabel}>
          {sortedRules.map((entry) => {
            const rule = getRule(entry);
            const key = ruleKey(rule);
            return (
              <li
                className="recent-rule rule-row"
                key={`${'source' in entry ? entry.source : 'user'}:${key}`}
              >
                <button
                  className="rule-summary-trigger"
                  type="button"
                  onClick={() => setSelectedEntry(entry)}
                >
                  <strong>{rule.keyword}</strong>
                  <span className="recent-rule-category">{getCategoryLabel(entry)}</span>
                  <span className="recent-rule-column">Searches {rule.column}</span>
                  <time dateTime={rule.createdAt} className="recent-rule-time">
                    {addedAtLabel(rule)}
                  </time>
                </button>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="muted">{emptyMessage}</p>
      )}
      {selectedEntry && (
        <RuleDetailsModal
          rule={getRule(selectedEntry)}
          categoryLabel={getCategoryLabel(selectedEntry)}
          categories={categories}
          onSave={onUpdate ? (next) => saveRule(getRule(selectedEntry), next) : undefined}
          onDelete={onDelete ? () => onDelete(getRule(selectedEntry)) : undefined}
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
