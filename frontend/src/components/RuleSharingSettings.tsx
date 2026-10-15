import type { ReactElement } from 'react';
import type { AuthSnapshot, RulePreferences } from '../types';

export function RuleSharingSettings({
  auth,
  rulePreferences,
  onRulePreferencesChange,
  onSyncRules,
  onDeleteServerRules,
  onDeleteCommunityRules,
  ruleSyncStatus,
}: {
  auth: AuthSnapshot;
  rulePreferences: RulePreferences;
  onRulePreferencesChange: (preferences: RulePreferences) => void;
  onSyncRules: () => void;
  onDeleteServerRules: () => void;
  onDeleteCommunityRules: () => void;
  ruleSyncStatus: string;
}): ReactElement {
  const canEdit = Boolean(auth.token);
  const syncFailed = ruleSyncStatus.startsWith('Could not ');

  return (
    <article className="panel rule-sharing-panel">
      <div className="panel-heading">
        <div>
          <h2>Where your rules are stored and shared</h2>
          <p className="muted">
            Transactions always stay in this browser. Before sign-in, rules are local; after sign-in
            new users default to private storage, community use, and eligible community sharing. The
            options below control which rule data may be read from or written to the server. Changes
            are synced automatically.
          </p>
        </div>
        <button
          className="button secondary"
          type="button"
          disabled={
            !canEdit || (!rulePreferences.storePrivateRules && !rulePreferences.contributeRules)
          }
          onClick={onSyncRules}
        >
          Sync selected rules now
        </button>
      </div>
      <div className="rule-privacy-summary">
        <p>
          <strong>Always local:</strong> transaction files and manual category overrides stay in
          this browser. Rules stay local before sign-in or when all server options are disabled.
        </p>
        <p>
          <strong>Login required:</strong> server options, syncing, importing/exporting
          user-specific categories, and server deletion are available only after sign-in.
        </p>
      </div>
      <fieldset className="rule-preferences" disabled={!canEdit}>
        <legend>Optional server actions</legend>
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
            <strong>Save a private copy to my account</strong>
            <small id="private-rules-help">
              Enabling this uploads your current browser rules immediately and repeats after later
              changes. Only you can read the copy. Turning this off stops using it, but does not
              delete an existing copy; use “Delete private server copy” below for that.
            </small>
          </span>
        </label>
        <label className="preference-choice">
          <input
            type="checkbox"
            aria-describedby="community-use-help"
            checked={rulePreferences.useCommunityRules}
            onChange={(event) =>
              onRulePreferencesChange({
                ...rulePreferences,
                useCommunityRules: event.currentTarget.checked,
              })
            }
          />
          <span>
            <strong>Use rules from the community</strong>
            <small id="community-use-help">
              Enabling this downloads accepted community and global rules immediately and uses them
              after your local and private rules. Your rules are not uploaded by this option.
            </small>
          </span>
        </label>
        <label className="preference-choice">
          <input
            type="checkbox"
            aria-describedby="community-share-help"
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
            <small id="community-share-help">
              Enabling this immediately contributes only rules using global categories. Changes are
              contributed automatically. Custom-category rules stay private and transaction data is
              never uploaded; other users may use eligible contributions.
            </small>
          </span>
        </label>
      </fieldset>
      {!canEdit && (
        <p className="notice category-auth-notice">
          Sign in above to enable server options. Until then, all rules remain local to this
          browser.
        </p>
      )}
      <div className="rule-sync-flow">
        <h3>What happens when you sync</h3>
        <ol>
          <li>Your current browser rules are the source for every upload.</li>
          <li>
            The private option saves all of them to your account; the community option shares only
            eligible global-category rules.
          </li>
          <li>
            Community and global rules are downloaded together when “Use rules from the community”
            is enabled and are applied after your own rules.
          </li>
        </ol>
        <p className="muted small">
          Use “Sync selected rules now” to repeat an enabled upload. Turning off an option stops
          future use or uploads; it does not erase server data until you use the delete buttons.
        </p>
      </div>
      {canEdit && (
        <div className="category-actions rule-storage-actions">
          <button
            className="button secondary danger-button"
            type="button"
            onClick={onDeleteServerRules}
          >
            Delete private server copy
          </button>
          <button
            className="button secondary danger-button"
            type="button"
            onClick={onDeleteCommunityRules}
          >
            Remove my community contributions
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
