import { useState, type ReactElement } from 'react';
import type { CategoryRule, RuleCategoryOption } from '../../types';
import { RuleEditor } from './RuleEditor';

function addedAtLabel(createdAt: string | undefined): string {
  if (!createdAt) return 'Date not recorded for this older rule';
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return 'Date not recorded';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function RuleDetailsModal({
  rule,
  categoryLabel,
  categories,
  onSave,
  onDelete,
  onClose,
}: {
  rule: CategoryRule;
  categoryLabel: string;
  categories?: RuleCategoryOption[] | undefined;
  onSave?: ((rule: CategoryRule) => string | null) | undefined;
  onDelete?: (() => void) | undefined;
  onClose: () => void;
}): ReactElement {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<CategoryRule>(rule);
  const [saveError, setSaveError] = useState('');
  const canEdit = Boolean(categories && onSave);

  function startEditing(): void {
    setDraft(rule);
    setSaveError('');
    setEditing(true);
  }

  function cancelEditing(): void {
    setDraft(rule);
    setSaveError('');
    setEditing(false);
  }

  function saveEditing(): void {
    if (!onSave) return;
    const error = onSave(draft);
    if (error) {
      setSaveError(error);
      return;
    }
    onClose();
  }

  function deleteRule(): void {
    onDelete?.();
    onClose();
  }

  return (
    <div className="modal-backdrop">
      <section
        className="details-modal rule-details-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rule-details-title"
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">Rule details</p>
            <h2 id="rule-details-title">{editing ? 'Edit rule' : rule.keyword}</h2>
          </div>
          <button
            className="button secondary close-button"
            type="button"
            aria-label="Close rule details"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        {editing && categories ? (
          <>
            <RuleEditor
              draft={draft}
              categories={categories}
              onChange={setDraft}
              onSave={saveEditing}
              onCancel={cancelEditing}
            />
            {saveError && <p className="notice category-auth-notice">{saveError}</p>}
          </>
        ) : (
          <>
            <dl className="detail-list rule-details-list">
              <div>
                <dt>Category</dt>
                <dd>{categoryLabel}</dd>
              </div>
              <div>
                <dt>Searches</dt>
                <dd>{rule.column}</dd>
              </div>
              <div>
                <dt>Added</dt>
                <dd>{addedAtLabel(rule.createdAt)}</dd>
              </div>
              {rule.confidence !== undefined && (
                <div>
                  <dt>Confidence</dt>
                  <dd>{Math.round(rule.confidence * 100)}%</dd>
                </div>
              )}
            </dl>
            {(canEdit || onDelete) && (
              <div className="rule-details-actions">
                {canEdit && (
                  <button className="button primary" type="button" onClick={startEditing}>
                    Edit rule
                  </button>
                )}
                {onDelete && (
                  <button
                    className="button secondary danger-button"
                    type="button"
                    onClick={deleteRule}
                  >
                    Delete rule
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
