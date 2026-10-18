import { useState, type ReactElement } from 'react';
import type { BudgetPlan } from '../data/budgets';
import type { BudgetPreferences } from '../data/preferences';
import type { AuthSnapshot, RulePreferences } from '../types';

type DeleteTarget = 'budgets' | 'rules' | 'community' | 'transactions' | null;

function accountLabel(auth: AuthSnapshot): string {
  return auth.user?.name || auth.user?.preferred_username || auth.user?.email || 'Signed in';
}

function budgetCounts(budgets: BudgetPlan): { categories: number; overrides: number } {
  const categories = new Set([
    ...Object.keys(budgets.defaults),
    ...Object.values(budgets.monthly).flatMap((month) => Object.keys(month)),
  ]);
  return {
    categories: categories.size,
    overrides: Object.values(budgets.monthly).reduce(
      (total, month) => total + Object.keys(month).length,
      0,
    ),
  };
}

function serverStorageLabel(
  enabled: boolean,
  auth: AuthSnapshot,
  count: number | null,
  emptyLabel: string,
): string {
  if (!auth.token) return 'Sign in required';
  if (!enabled) return 'Synchronization disabled';
  if (count === null) return 'Checking…';
  return count > 0 ? `${count} stored privately` : emptyLabel;
}

export function Account({
  auth,
  transactionCount,
  budgets,
  budgetPreferences,
  budgetSyncStatus,
  serverHasBudgets,
  localRuleCount,
  localCategoryCount,
  rulePreferences,
  ruleSyncStatus,
  serverRuleCount,
  serverCategoryCount,
  onBudgetPreferencesChange,
  onRulePreferencesChange,
  onDeleteServerBudgets,
  onDeleteServerRules,
  onDeleteCommunityRules,
  onClearLocalTransactions,
}: {
  auth: AuthSnapshot;
  transactionCount: number;
  budgets: BudgetPlan;
  budgetPreferences: BudgetPreferences;
  budgetSyncStatus: string;
  serverHasBudgets: boolean | null;
  localRuleCount: number;
  localCategoryCount: number;
  rulePreferences: RulePreferences;
  ruleSyncStatus: string;
  serverRuleCount: number | null;
  serverCategoryCount: number | null;
  onBudgetPreferencesChange: (next: BudgetPreferences) => void;
  onRulePreferencesChange: (next: RulePreferences) => void;
  onDeleteServerBudgets: () => void;
  onDeleteServerRules: () => void;
  onDeleteCommunityRules: () => void;
  onClearLocalTransactions: () => void;
}): ReactElement {
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const budgetTotal = budgetCounts(budgets);
  const canManageAccount = Boolean(auth.token);

  function requestDelete(target: DeleteTarget): void {
    setDeleteTarget(target);
  }

  function confirmDelete(): void {
    if (deleteTarget === 'budgets') onDeleteServerBudgets();
    if (deleteTarget === 'rules') onDeleteServerRules();
    if (deleteTarget === 'community') onDeleteCommunityRules();
    if (deleteTarget === 'transactions') onClearLocalTransactions();
    setDeleteTarget(null);
  }

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

  return (
    <section id="account-tab" className="tab-panel account-tab">
      <div className="account-heading">
        <div>
          <span className="eyebrow accent-eyebrow">Account</span>
          <h2>Account and data</h2>
          <p className="muted">
            Review where your dashboard data lives and control private synchronization.
          </p>
        </div>
        <div className={`account-identity${canManageAccount ? ' signed-in' : ''}`}>
          <span className="account-identity-dot" aria-hidden="true" />
          <div>
            <strong>{canManageAccount ? accountLabel(auth) : 'Not signed in'}</strong>
            <small>{canManageAccount ? 'Account connected' : 'Local browser mode'}</small>
          </div>
        </div>
      </div>

      <article className="panel account-storage-panel">
        <div className="panel-heading">
          <div>
            <h2>Where your data is stored</h2>
            <p className="muted">
              Imported transactions stay in this browser. Only the private copies below can be
              synchronized to your account.
            </p>
          </div>
        </div>
        <div className="account-data-table-wrap">
          <table className="account-data-table">
            <thead>
              <tr>
                <th scope="col">Data</th>
                <th scope="col">This browser</th>
                <th scope="col">Private server copy</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Imported transactions</th>
                <td>{transactionCount} loaded</td>
                <td>Never uploaded</td>
              </tr>
              <tr>
                <th scope="row">Budgets</th>
                <td>
                  {budgetTotal.categories} default categories · {budgetTotal.overrides} monthly
                  overrides
                </td>
                <td>
                  {canManageAccount && budgetPreferences.storePrivateBudgets && serverHasBudgets
                    ? 'Budgets stored privately'
                    : serverStorageLabel(
                        budgetPreferences.storePrivateBudgets,
                        auth,
                        serverHasBudgets === true ? 1 : serverHasBudgets === false ? 0 : null,
                        'No budgets stored',
                      )}
                </td>
              </tr>
              <tr>
                <th scope="row">Categories and rules</th>
                <td>
                  {localCategoryCount} categories · {localRuleCount} rules
                </td>
                <td>
                  {serverStorageLabel(
                    rulePreferences.storePrivateRules,
                    auth,
                    serverRuleCount,
                    'No private rules stored',
                  )}
                  {serverCategoryCount !== null && rulePreferences.storePrivateRules && (
                    <small className="account-table-detail">
                      {serverCategoryCount} categories stored
                    </small>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

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
              <small>
                Keep your personal category and categorization-rule copy across devices.
              </small>
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
            onClick={() => requestDelete('budgets')}
          >
            Delete private budgets
          </button>
          <button
            className="button secondary danger-button"
            type="button"
            disabled={!canManageAccount}
            onClick={() => requestDelete('rules')}
          >
            Delete private categories and rules
          </button>
          <button
            className="button secondary danger-button"
            type="button"
            disabled={!canManageAccount}
            onClick={() => requestDelete('community')}
          >
            Remove community contributions
          </button>
          <button
            className="button secondary danger-button"
            type="button"
            disabled={!transactionCount}
            onClick={() => requestDelete('transactions')}
          >
            Clear imported transactions
          </button>
        </div>
        {deleteTarget && (
          <div className="account-confirmation" role="alertdialog" aria-modal="false">
            <strong>{deleteCopy[deleteTarget].title}</strong>
            <p>{deleteCopy[deleteTarget].message}</p>
            <div className="account-confirmation-actions">
              <button
                className="button secondary"
                type="button"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
              <button
                className="button remove-all-rules-button"
                type="button"
                onClick={confirmDelete}
              >
                Confirm delete
              </button>
            </div>
          </div>
        )}
      </article>
    </section>
  );
}
