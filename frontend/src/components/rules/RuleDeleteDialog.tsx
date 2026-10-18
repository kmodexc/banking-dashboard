import type { ReactElement } from 'react';

export function RuleDeleteDialog({
  confirmation,
  onConfirmationChange,
  onCancel,
  onConfirm,
}: {
  confirmation: string;
  onConfirmationChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}): ReactElement {
  return (
    <div className="modal-backdrop">
      <section
        className="details-modal rule-confirmation"
        role="dialog"
        aria-modal="true"
        aria-labelledby="remove-all-rules-title"
      >
        <h2 id="remove-all-rules-title">Remove all rules?</h2>
        <p>
          This removes all personal rules from this browser and, when enabled, from the private
          server copy.
        </p>
        <label htmlFor="remove-all-rules-confirmation">
          Type <code>delete</code> to confirm
          <input
            id="remove-all-rules-confirmation"
            value={confirmation}
            onChange={(event) => onConfirmationChange(event.currentTarget.value)}
            autoFocus
          />
        </label>
        <div className="category-actions">
          <button className="button secondary" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="button remove-all-rules-button"
            type="button"
            disabled={confirmation !== 'delete'}
            onClick={onConfirm}
          >
            OK
          </button>
        </div>
      </section>
    </div>
  );
}
