import type { ReactElement } from 'react';
import type { CategoryRule, ManagedRule, RuleCategoryOption } from '../../types';
import { ruleKey } from '../../data/rules';
import { RuleEditor } from './RuleEditor';

export function RuleList({
  rules,
  categories,
  editingKey,
  draft,
  onStartEditing,
  onDraftChange,
  onSave,
  onCancel,
  onDelete,
}: {
  rules: ManagedRule[];
  categories: RuleCategoryOption[];
  editingKey: string | null;
  draft: CategoryRule | null;
  onStartEditing: (entry: ManagedRule) => void;
  onDraftChange: (rule: CategoryRule) => void;
  onSave: (rule: CategoryRule) => void;
  onCancel: () => void;
  onDelete: (rule: CategoryRule) => void;
}): ReactElement {
  return (
    <ol className="rule-list" aria-label="Categorization rule list">
      {rules.map((entry) => {
        const key = ruleKey(entry.rule);
        const editingDraft = editingKey === key ? draft : null;
        return (
          <li className="rule-row" key={`${entry.source}:${key}`}>
            {editingDraft ? (
              <RuleEditor
                draft={editingDraft}
                categories={categories}
                onChange={onDraftChange}
                onSave={() => onSave(entry.rule)}
                onCancel={onCancel}
              />
            ) : (
              <>
                <div className="rule-row-content">
                  <strong>{entry.rule.keyword}</strong>
                  <span className="rule-row-category">{entry.categoryLabel}</span>
                  <span className="rule-row-column">Searches {entry.rule.column}</span>
                </div>
                <div className="category-row-actions">
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => onStartEditing(entry)}
                  >
                    Edit
                  </button>
                  <button
                    className="button secondary danger-button"
                    type="button"
                    onClick={() => onDelete(entry.rule)}
                  >
                    Delete
                  </button>
                </div>
              </>
            )}
          </li>
        );
      })}
    </ol>
  );
}
