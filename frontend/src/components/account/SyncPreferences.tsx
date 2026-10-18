import type { ReactElement } from 'react';
import type { BudgetPreferences } from '../../data/preferences';
import type { RulePreferences } from '../../types';

export function SyncPreferences({
  canManageAccount,
  budgetPreferences,
  rulePreferences,
  budgetSyncStatus,
  ruleSyncStatus,
  onBudgetPreferencesChange,
  onRulePreferencesChange,
}: {
  canManageAccount: boolean;
  budgetPreferences: BudgetPreferences;
  rulePreferences: RulePreferences;
  budgetSyncStatus: string;
  ruleSyncStatus: string;
  onBudgetPreferencesChange: (next: BudgetPreferences) => void;
  onRulePreferencesChange: (next: RulePreferences) => void;
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
        <p className="account-status" role="status">
          <strong>Budget status</strong>
          <span>{budgetSyncStatus}</span>
        </p>
        <p className="account-status" role="status">
          <strong>Category and rule status</strong>
          <span>{ruleSyncStatus || 'No synchronization activity yet.'}</span>
        </p>
      </div>
    </article>
  );
}
