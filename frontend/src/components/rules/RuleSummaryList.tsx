import { useMemo, useState, type ReactElement } from 'react';
import { ruleKey } from '../../data/rules';
import type { CategoryRule, ManagedRule, RuleCategoryOption } from '../../types';
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
  onSave,
  onDelete,
}: {
  rules: RuleEntry[];
  categories?: RuleCategoryOption[];
  title?: string;
  description?: string;
  listLabel?: string;
  emptyMessage?: string;
  onSave?: (previous: CategoryRule, next: CategoryRule) => string | null;
  onDelete?: (rule: CategoryRule) => void;
}): ReactElement {
  const [sort, setSort] = useState<RuleSort>('time');
  const [selectedEntry, setSelectedEntry] = useState<RuleEntry | null>(null);
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
          onSave={onSave ? (next) => onSave(getRule(selectedEntry), next) : undefined}
          onDelete={onDelete ? () => onDelete(getRule(selectedEntry)) : undefined}
          onClose={() => setSelectedEntry(null)}
        />
      )}
    </section>
  );
}
