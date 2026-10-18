import type { ReactElement } from 'react';
import type { BudgetPreferences } from '../../data/preferences';
import type { RulePreferences } from '../../types';

function syncTime(timestamp: string | null): string {
  if (!timestamp) return 'No successful sync recorded yet.';
  return `Last successful sync: ${new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(timestamp))}`;
}

function uploadState(
  canManageAccount: boolean,
  canSync: boolean,
  hasUnsyncedChanges: boolean,
): string {
  if (!canManageAccount) return 'Sign in to determine upload status.';
  if (!canSync) return 'Synchronization is disabled; changes stay in this browser.';
  return hasUnsyncedChanges ? 'Changes waiting to upload.' : 'Everything is uploaded.';
}

export function SyncPreferences({
  canManageAccount,
  budgetPreferences,
  rulePreferences,
  budgetSyncStatus,
  ruleSyncStatus,
  budgetLastSyncedAt,
  budgetHasUnsyncedChanges,
  ruleLastSyncedAt,
  ruleHasUnsyncedChanges,
  onBudgetPreferencesChange,
  onSyncBudgets,
  onRulePreferencesChange,
  onSyncRules,
}: {
  canManageAccount: boolean;
  budgetPreferences: BudgetPreferences;
  rulePreferences: RulePreferences;
  budgetSyncStatus: string;
  ruleSyncStatus: string;
  budgetLastSyncedAt: string | null;
  budgetHasUnsyncedChanges: boolean;
  ruleLastSyncedAt: string | null;
  ruleHasUnsyncedChanges: boolean;
  onBudgetPreferencesChange: (next: BudgetPreferences) => void;
  onSyncBudgets: () => void;
  onRulePreferencesChange: (next: RulePreferences) => void;
  onSyncRules: () => void;
}): ReactElement {
  return (
    <article className="panel account-sync-panel">
      <div className="panel-heading">
        <div>
          <h2>Synchronization settings</h2>
          <p className="muted">
            Turn private storage on or off independently for budgets, categories, and rules.
          </p>
        </div>
      </div>
      <fieldset className="account-preferences" disabled={!canManageAccount}>
        <legend>Online synchronization</legend>
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
            <strong>Synchronize budgets privately</strong>
            <small>Save default and month-specific budgets to your account.</small>
          </span>
        </label>
        <label className="preference-choice">
          <input
            type="checkbox"
            checked={rulePreferences.storePrivateRules}
            onChange={(event) =>
              onRulePreferencesChange({
                ...rulePreferences,
                storePrivateRules: event.currentTarget.checked,
              })
            }
          />
          <span>
            <strong>Synchronize categories and rules privately</strong>
            <small>Keep your personal category and categorization-rule copy across devices.</small>
          </span>
        </label>
        <label className="preference-choice">
          <input
            type="checkbox"
            checked={rulePreferences.useCommunityRules}
            onChange={(event) =>
              onRulePreferencesChange({
                ...rulePreferences,
                useCommunityRules: event.currentTarget.checked,
              })
            }
          />
          <span>
            <strong>Use shared community rules</strong>
            <small>Load read-only rules shared by other users.</small>
          </span>
        </label>
        <label className="preference-choice">
          <input
            type="checkbox"
            checked={rulePreferences.contributeRules}
            onChange={(event) =>
              onRulePreferencesChange({
                ...rulePreferences,
                contributeRules: event.currentTarget.checked,
              })
            }
          />
          <span>
            <strong>Share eligible rules with the community</strong>
            <small>Only rules using built-in categories are eligible to be shared.</small>
          </span>
        </label>
      </fieldset>
      {!canManageAccount && (
        <p className="notice category-auth-notice">
          Sign in above to manage synchronization settings. Your local data remains available.
        </p>
      )}
      <div className="account-status-grid">
        <div className="account-status" role="status">
          <div className="account-status-heading">
            <strong>Budget synchronization</strong>
            <button
              className="button secondary"
              type="button"
              disabled={!canManageAccount || !budgetPreferences.storePrivateBudgets}
              onClick={onSyncBudgets}
            >
              Sync budgets now
            </button>
          </div>
          <span>{budgetSyncStatus}</span>
          <small>{syncTime(budgetLastSyncedAt)}</small>
          <small>
            {uploadState(
              canManageAccount,
              budgetPreferences.storePrivateBudgets,
              budgetHasUnsyncedChanges,
            )}
          </small>
        </div>
        <div className="account-status" role="status">
          <div className="account-status-heading">
            <strong>Category and rule synchronization</strong>
            <button
              className="button secondary"
              type="button"
              disabled={
                !canManageAccount ||
                (!rulePreferences.storePrivateRules && !rulePreferences.contributeRules)
              }
              onClick={onSyncRules}
            >
              Sync categories and rules now
            </button>
          </div>
          <span>{ruleSyncStatus || 'No synchronization activity yet.'}</span>
          <small>{syncTime(ruleLastSyncedAt)}</small>
          <small>
            {uploadState(
              canManageAccount,
              rulePreferences.storePrivateRules || rulePreferences.contributeRules,
              ruleHasUnsyncedChanges,
            )}
          </small>
        </div>
      </div>
    </article>
  );
}
