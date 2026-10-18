import type { ReactElement } from 'react';
import type { BudgetPreferences } from '../data/preferences';
import type { AuthSnapshot } from '../types';

export function BudgetStorageSettings({
  auth,
  budgetPreferences,
  budgetSyncStatus,
  onBudgetPreferencesChange,
  onDeleteServerBudgets,
}: {
  auth: AuthSnapshot;
  budgetPreferences: BudgetPreferences;
  budgetSyncStatus: string;
  onBudgetPreferencesChange: (next: BudgetPreferences) => void;
  onDeleteServerBudgets: () => void;
}): ReactElement {
  return (
    <article className="panel budget-storage-panel">
      <div className="panel-heading">
        <div>
          <h2>Private budget storage</h2>
          <p className="muted">
            Keep your planned budgets available across devices in your private account copy.
            Transaction data is never uploaded by this feature.
          </p>
        </div>
      </div>
      <fieldset className="budget-preferences" disabled={!auth.token}>
        <legend>Online storage</legend>
        <label className="preference-choice">
          <input
            type="checkbox"
            checked={budgetPreferences.storePrivateBudgets}
            onChange={(event) =>
              onBudgetPreferencesChange({
                ...budgetPreferences,
                storePrivateBudgets: event.currentTarget.checked,
              })
            }
          />
          <span>
            <strong>Save my budgets privately on the server</strong>
            <small>
              Enabled by default after sign-in. Turn it off to keep future budget changes only in
              this browser.
            </small>
          </span>
        </label>
      </fieldset>
      {!auth.token && (
        <p className="notice category-auth-notice">
          Sign in above to enable private online budget storage. Until then, budgets remain local to
          this browser.
        </p>
      )}
      {auth.token && (
        <div className="category-actions rule-storage-actions">
          <button
            className="button secondary danger-button"
            type="button"
            onClick={onDeleteServerBudgets}
          >
            Delete private server budgets
          </button>
        </div>
      )}
      {budgetSyncStatus && (
        <p
          className={`rule-sync-status${budgetSyncStatus.startsWith('Could not ') ? ' rule-sync-status-error' : ''}`}
          role="status"
          aria-live="polite"
        >
          {budgetSyncStatus.startsWith('Could not ') && <strong>Warning: </strong>}
          {budgetSyncStatus}
        </p>
      )}
    </article>
  );
}
