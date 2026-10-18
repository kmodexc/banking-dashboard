import { useState, type FormEvent, type ReactElement } from 'react';
import { CategoryRuleSchema, RuleColumnSchema } from '../../types';
import type { CategoryRule, RuleCategoryOption } from '../../types';

function addedAtLabel(createdAt: string | undefined): string {
  if (!createdAt) return 'Date not recorded';
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return 'Date not recorded';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function RuleForm({
  rule,
  initialValues,
  categories,
  onAdd,
  onSave,
  onClose,
}: {
  rule?: CategoryRule;
  initialValues?: Partial<Pick<CategoryRule, 'keyword' | 'category' | 'column'>>;
  categories: RuleCategoryOption[];
  onAdd?: (rule: CategoryRule) => void;
  onSave?: (rule: CategoryRule) => string | null;
  onClose?: () => void;
}): ReactElement {
  const isExistingRule = rule !== undefined;
  const [draft, setDraft] = useState<CategoryRule>(
    rule ?? {
      keyword: '',
      category: initialValues?.category ?? categories[0]?.value ?? '',
      column: initialValues?.column ?? 'recipient',
      ...initialValues,
    },
  );
  const [error, setError] = useState('');

  function updateDraft(next: Partial<CategoryRule>): void {
    setDraft((current) => ({ ...current, ...next }));
    setError('');
  }

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const result = CategoryRuleSchema.safeParse({
      ...draft,
      keyword: draft.keyword.trim(),
      category: draft.category.trim(),
    });
    if (!result.success) {
      setError('Rules need a keyword, category, and valid search column.');
      return;
    }

    if (isExistingRule) {
      const saveError = onSave?.(result.data) ?? null;
      if (saveError) {
        setError(saveError);
        return;
      }
      onClose?.();
      return;
    }

    onAdd?.({ ...result.data, createdAt: new Date().toISOString() });
    setDraft({ keyword: '', category: categories[0]?.value ?? '', column: 'recipient' });
  }

  const form = (
    <form className="rule-form" onSubmit={submit}>
      <div className="rule-form-heading">
        <div>
          <p className="eyebrow accent-eyebrow">Rule details</p>
          <h2>{isExistingRule ? 'Edit rule' : 'Add rule'}</h2>
        </div>
        {isExistingRule && (
          <p className="rule-form-created">
            <span>Added</span>
            <time dateTime={rule.createdAt}>{addedAtLabel(rule.createdAt)}</time>
          </p>
        )}
      </div>
      <label>
        Keyword
        <input
          id={isExistingRule ? 'edit-rule-keyword' : 'rule-keyword'}
          required
          maxLength={200}
          value={draft.keyword}
          onChange={(event) => updateDraft({ keyword: event.currentTarget.value })}
        />
      </label>
      <label>
        Search in
        <select
          value={draft.column}
          onChange={(event) =>
            updateDraft({ column: RuleColumnSchema.parse(event.currentTarget.value) })
          }
        >
          <option value="recipient">Recipient</option>
          <option value="purpose">Purpose</option>
          <option value="both">Both</option>
        </select>
      </label>
      <div className="category-editor rule-category-editor">
        <span className="category-editor-label">Category</span>
        {!isExistingRule && (
          <input
            id="rule-category"
            className="visually-hidden-input"
            aria-label="Category"
            maxLength={80}
            value={draft.category}
            onChange={(event) => updateDraft({ category: event.currentTarget.value })}
            tabIndex={-1}
          />
        )}
        <div className="category-buttons" role="radiogroup" aria-label="Choose rule category">
          {categories.map((category) => (
            <label className="category-choice" key={category.value}>
              <input
                type="radio"
                name="rule-category-choice"
                value={category.value}
                checked={draft.category === category.value}
                onChange={() => updateDraft({ category: category.value })}
              />
              <span>{category.label}</span>
            </label>
          ))}
        </div>
      </div>
      {error && <p className="notice category-auth-notice">{error}</p>}
      <div className="category-row-actions rule-form-actions">
        <button className="button primary" type="submit">
          Save rule
        </button>
        {onClose && (
          <button className="button secondary" type="button" onClick={onClose}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );

  if (!onClose) return form;

  return (
    <div className="modal-backdrop">
      <section
        className="details-modal rule-form-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Rule"
      >
        <div className="modal-header">
          <button
            className="button close-button"
            type="button"
            aria-label="Close rule details"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        {form}
      </section>
    </div>
  );
}
