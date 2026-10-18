import type { ReactElement } from 'react';
import type { CategoryRule } from '../../types';

export function RuleDeleteDialog({
  rule,
  confirmation,
  onConfirmationChange,
  onCancel,
  onConfirm,
}: {
  rule?: CategoryRule;
  confirmation?: string;
  onConfirmationChange?: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}): ReactElement {
  const isSingleRule = rule !== undefined;
  return (
    <div className="modal-backdrop">
      <section
        className="details-modal rule-confirmation"
        role="dialog"
        aria-modal="true"
        aria-labelledby={isSingleRule ? 'delete-rule-title' : 'remove-all-rules-title'}
      >
        {isSingleRule ? (
          <>
            <h2 id="delete-rule-title">Delete rule?</h2>
            <p>
              Delete <strong>{rule.keyword}</strong>? This cannot be undone.
            </p>
          </>
        ) : (
          <>
            <h2 id="remove-all-rules-title">Remove all rules?</h2>
            <p>
              This removes all personal rules from this browser and, when enabled, from the private
              server copy.
            </p>
            <label htmlFor="remove-all-rules-confirmation">
              Type <code>delete</code> to confirm
              <input
                id="remove-all-rules-confirmation"
                value={confirmation ?? ''}
                onChange={(event) => onConfirmationChange?.(event.currentTarget.value)}
                autoFocus
              />
            </label>
          </>
        )}
        <div className="category-actions">
          <button className="button secondary" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="button remove-all-rules-button"
            type="button"
            disabled={!isSingleRule && confirmation !== 'delete'}
            onClick={onConfirm}
          >
            {isSingleRule ? 'Delete rule' : 'OK'}
          </button>
        </div>
      </section>
    </div>
  );
}
