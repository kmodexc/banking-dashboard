import type { ReactElement } from 'react';
import type { DeleteTarget } from './types';

const deleteCopy: Record<Exclude<DeleteTarget, null>, { title: string; message: string }> = {
  budgets: {
    title: 'Delete private budgets?',
    message: 'This removes the server copy. Your local browser budgets will remain available.',
  },
  rules: {
    title: 'Delete private categories and rules?',
    message:
      'This removes the private server copy of your categories and categorization rules. Local browser copies will remain available.',
  },
  community: {
    title: 'Remove community contributions?',
    message: 'This removes rules you contributed to the shared community collection.',
  },
  transactions: {
    title: 'Clear imported transactions?',
    message: 'This removes the imported transaction file from this browser session only.',
  },
};

export function DangerZone({
  canManageAccount,
  transactionCount,
  deleteTarget,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
}: {
  canManageAccount: boolean;
  transactionCount: number;
  deleteTarget: DeleteTarget;
  onRequestDelete: (target: DeleteTarget) => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}): ReactElement {
  return (
    <article className="panel account-danger-panel">
      <div className="panel-heading">
        <div>
          <h2>Delete data</h2>
          <p className="muted">
            Server deletions require sign-in and do not remove local browser copies. Confirm each
            action before it runs.
          </p>
        </div>
      </div>
      <div className="account-danger-actions">
        <button
          className="button secondary danger-button"
          type="button"
          disabled={!canManageAccount}
          onClick={() => onRequestDelete('budgets')}
        >
          Delete private budgets
        </button>
        <button
          className="button secondary danger-button"
          type="button"
          disabled={!canManageAccount}
          onClick={() => onRequestDelete('rules')}
        >
          Delete private categories and rules
        </button>
        <button
          className="button secondary danger-button"
          type="button"
          disabled={!canManageAccount}
          onClick={() => onRequestDelete('community')}
        >
          Remove community contributions
        </button>
        <button
          className="button secondary danger-button"
          type="button"
          disabled={!transactionCount}
          onClick={() => onRequestDelete('transactions')}
        >
          Clear imported transactions
        </button>
      </div>
      {deleteTarget && (
        <div className="account-confirmation" role="alertdialog" aria-modal="false">
          <strong>{deleteCopy[deleteTarget].title}</strong>
          <p>{deleteCopy[deleteTarget].message}</p>
          <div className="account-confirmation-actions">
            <button className="button secondary" type="button" onClick={onCancelDelete}>
              Cancel
            </button>
            <button
              className="button remove-all-rules-button"
              type="button"
              onClick={onConfirmDelete}
            >
              Confirm delete
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
