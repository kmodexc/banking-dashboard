import type { ReactElement } from 'react';
import type { BudgetPlan } from '../../data/budgets';
import type { BudgetPreferences } from '../../data/preferences';
import type { AuthSnapshot, RulePreferences } from '../../types';

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

export function StorageOverview({
  auth,
  transactionCount,
  budgets,
  budgetPreferences,
  serverHasBudgets,
  localRuleCount,
  localCategoryCount,
  rulePreferences,
  serverRuleCount,
  serverCategoryCount,
}: {
  auth: AuthSnapshot;
  transactionCount: number;
  budgets: BudgetPlan;
  budgetPreferences: BudgetPreferences;
  serverHasBudgets: boolean | null;
  localRuleCount: number;
  localCategoryCount: number;
  rulePreferences: RulePreferences;
  serverRuleCount: number | null;
  serverCategoryCount: number | null;
}): ReactElement {
  const budgetTotal = budgetCounts(budgets);
  const canManageAccount = Boolean(auth.token);

  return (
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
  );
}
