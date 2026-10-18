import type { ReactElement } from 'react';
import type { CategoryRule } from '../../types';

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
  onClose,
}: {
  rule: CategoryRule;
  categoryLabel: string;
  onClose: () => void;
}): ReactElement {
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
            <h2 id="rule-details-title">{rule.keyword}</h2>
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
      </section>
    </div>
  );
}
