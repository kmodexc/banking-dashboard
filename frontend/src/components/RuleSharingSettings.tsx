import type { ReactElement } from 'react';
import type { AuthSnapshot, RulePreferences } from '../types';

export function RuleSharingSettings({
  auth,
  rulePreferences,
  onRulePreferencesChange,
  onSyncRules,
  onDeleteServerRules,
  ruleSyncStatus,
}: {
  auth: AuthSnapshot;
  rulePreferences: RulePreferences;
  onRulePreferencesChange: (preferences: RulePreferences) => void;
  onSyncRules: () => void;
  onDeleteServerRules: () => void;
  ruleSyncStatus: string;
}): ReactElement {
  const canEdit = Boolean(auth.token);
  const syncFailed = ruleSyncStatus.startsWith('Could not ');

  return (
    <article className="panel rule-sharing-panel">
      <div className="panel-heading">
        <div>
          <h2>Private category and rule storage</h2>
          <p className="muted">
            Categories and rules are personal. They stay local before sign-in and can be saved
            privately to your account after sign-in. They are never shared with other users.
          </p>
        </div>
        <button
          className="button secondary"
          type="button"
          disabled={!canEdit || !rulePreferences.storePrivateRules}
          onClick={onSyncRules}
        >
          Sync privately now
        </button>
      </div>
      <fieldset className="rule-preferences" disabled={!canEdit}>
        <legend>Private online storage</legend>
        <label className="preference-choice">
          <input
            type="checkbox"
            aria-describedby="private-rules-help"
            checked={rulePreferences.storePrivateRules}
            onChange={(event) =>
              onRulePreferencesChange({
                ...rulePreferences,
                storePrivateRules: event.currentTarget.checked,
              })
            }
          />
          <span>
            <strong>Save my categories and rules privately online</strong>
            <small id="private-rules-help">
              Only your account can read this copy. Turning this off keeps future changes local; use
              “Delete private server copy” to remove the existing copy.
            </small>
          </span>
        </label>
      </fieldset>
      {!canEdit && (
        <p className="notice category-auth-notice">
          Sign in above to enable private online storage. Until then, categories and rules remain
          local to this browser.
        </p>
      )}
      {canEdit && (
        <div className="category-actions rule-storage-actions">
          <button
            className="button secondary danger-button"
            type="button"
            onClick={onDeleteServerRules}
          >
            Delete private server copy
          </button>
        </div>
      )}
      {ruleSyncStatus && (
        <p
          className={`rule-sync-status${syncFailed ? ' rule-sync-status-error' : ''}`}
          role="status"
          aria-live="polite"
        >
          {syncFailed && <strong>Warning: </strong>}
          {ruleSyncStatus}
        </p>
      )}
    </article>
  );
}
