import { type FormEvent, type ReactElement } from 'react';
import { CategoryRuleSchema, RuleColumnSchema } from '../../types';
import type { CategoryRule, RuleColumn } from '../../types';

export function LocalRuleForm({
  keyword,
  category,
  column,
  categories,
  onKeywordChange,
  onCategoryChange,
  onColumnChange,
  onAddRule,
}: {
  keyword: string;
  category: string;
  column: RuleColumn;
  categories: string[];
  onKeywordChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onColumnChange: (value: RuleColumn) => void;
  onAddRule: (rule: CategoryRule) => void;
}): ReactElement {
  function submitRule(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const result = CategoryRuleSchema.safeParse({ keyword, category, column });
    if (result.success) onAddRule({ ...result.data, createdAt: new Date().toISOString() });
  }

  return (
    <>
      <h2>Add a local rule</h2>
      <p className="muted">
        Rules are saved in this browser and applied before requesting AI suggestions.
      </p>
      <form id="rule-form" onSubmit={submitRule}>
        <label>
          Keyword
          <input
            id="rule-keyword"
            required
            maxLength={200}
            value={keyword}
            onChange={(event) => onKeywordChange(event.currentTarget.value)}
          />
        </label>
        <label>
          Search in
          <select
            id="rule-column"
            value={column}
            onChange={(event) => onColumnChange(RuleColumnSchema.parse(event.currentTarget.value))}
          >
            <option value="recipient">Recipient</option>
            <option value="purpose">Purpose</option>
            <option value="both">Both</option>
          </select>
        </label>
        <div className="category-editor rule-category-editor">
          <span className="category-editor-label">Category</span>
          <input
            id="rule-category"
            className="visually-hidden-input"
            aria-label="Category"
            maxLength={80}
            value={category}
            onChange={(event) => onCategoryChange(event.currentTarget.value)}
            tabIndex={-1}
          />
          <div className="category-buttons" role="radiogroup" aria-label="Choose rule category">
            {categories.map((value) => (
              <label className="category-choice" key={value}>
                <input
                  type="radio"
                  name="rule-category-choice"
                  value={value}
                  checked={category === value}
                  onChange={() => onCategoryChange(value)}
                />
                <span>{value}</span>
              </label>
            ))}
          </div>
        </div>
        <button className="button primary" type="submit">
          Save rule
        </button>
      </form>
    </>
  );
}
