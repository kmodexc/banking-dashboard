import { useMemo, useState, type ReactElement, type ReactNode } from 'react';
import { ruleKey } from '../../data/rules';
import type { CategoryRule, ManagedRule, RuleCategoryOption } from '../../types';
import { RuleDetailsModal } from './RuleDetailsModal';
import { RuleEditor } from './RuleEditor';

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
  headerMeta,
  toolbar,
  listLabel = 'Recently added rules',
  emptyMessage = 'No rules added yet.',
  editingKey,
  draft,
  onStartEditing,
  onDraftChange,
  onSave,
  onCancel,
  onDelete,
}: {
  rules: RuleEntry[];
  categories?: RuleCategoryOption[];
  title?: string;
  description?: string;
  headerMeta?: ReactNode;
  toolbar?: ReactNode;
  listLabel?: string;
  emptyMessage?: string;
  editingKey?: string | null;
  draft?: CategoryRule | null;
  onStartEditing?: (entry: ManagedRule) => void;
  onDraftChange?: (rule: CategoryRule) => void;
  onSave?: (previous: CategoryRule, next: CategoryRule) => string | null;
  onCancel?: () => void;
  onDelete?: (rule: CategoryRule) => void;
}): ReactElement {
  const [sort, setSort] = useState<RuleSort>('time');
  const [selectedEntry, setSelectedEntry] = useState<RuleEntry | null>(null);
  const canManage = Boolean(onStartEditing || onDelete);
  const sortedRules = useMemo(() => {
    const next = [...rules];
    next.sort((left, right) => {
      const leftRule = getRule(left);
      const rightRule = getRule(right);
      if (sort === 'name') return leftRule.keyword.localeCompare(rightRule.keyword);
      if (sort === 'category') return getCategoryLabel(left).localeCompare(getCategoryLabel(right));
      return addedAtValue(rightRule) - addedAtValue(leftRule);
    });
    return next;
  }, [rules, sort]);

  return (
    <section className="recent-rules panel" aria-labelledby="recent-rules-heading">
      <div className="recent-rules-heading">
        <div>
          <h2 id="recent-rules-heading">{title}</h2>
          <p className="muted small">{description}</p>
        </div>
        <div className="recent-rules-header-controls">
          {headerMeta}
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
      {toolbar && <div className="rule-summary-toolbar">{toolbar}</div>}
      {sortedRules.length ? (
        <ol className="recent-rule-list" aria-label={listLabel}>
          {sortedRules.map((entry) => {
            const rule = getRule(entry);
            const key = ruleKey(rule);
            const editingDraft = editingKey === key ? draft : null;
            return (
              <li
                className="recent-rule rule-row"
                key={`${'source' in entry ? entry.source : 'user'}:${key}`}
              >
                {editingDraft && onDraftChange && onSave && onCancel && categories ? (
                  <RuleEditor
                    draft={editingDraft}
                    categories={categories}
                    onChange={onDraftChange}
                    onSave={() => onSave(rule, editingDraft)}
                    onCancel={onCancel}
                  />
                ) : (
                  <>
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
                    {canManage && (
                      <div className="category-row-actions">
                        {onStartEditing && 'rule' in entry && (
                          <button
                            className="button secondary"
                            type="button"
                            onClick={() => onStartEditing(entry)}
                          >
                            Edit
                          </button>
                        )}
                        {onDelete && (
                          <button
                            className="button secondary danger-button"
                            type="button"
                            onClick={() => onDelete(rule)}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    )}
                  </>
                )}
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
          onSave={onSave ? (next) => onSave(getRule(selectedEntry), next) : undefined}
          onDelete={onDelete ? () => onDelete(getRule(selectedEntry)) : undefined}
          onClose={() => setSelectedEntry(null)}
        />
      )}
    </section>
  );
}
