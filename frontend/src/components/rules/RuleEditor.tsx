import type { ReactElement } from 'react';
import { RuleColumnSchema } from '../../types';
import type { CategoryRule, RuleCategoryOption } from '../../types';

export function RuleEditor({
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
