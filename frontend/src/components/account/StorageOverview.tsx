import type { ReactElement } from 'react';
import { summarizeBudgetPlan, type BudgetPlan, type BudgetPlanSummary } from '../../data/budgets';
import type { BudgetPreferences } from '../../data/preferences';
import type { AuthSnapshot, RulePreferences } from '../../types';

function syncAvailability(auth: AuthSnapshot, enabled: boolean): string | null {
  if (!auth.token) return 'Not synchronized — sign in required';
  if (!enabled) return 'Not synchronized — disabled in Account settings';
  return null;
}

function countLabel(count: number, singular: string, plural: string = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function budgetSummaryLines(summary: BudgetPlanSummary): ReactElement {
  return (
    <div className="account-table-summary">
      <span>{countLabel(summary.categories, 'budget category', 'budget categories')}</span>
      <span>{countLabel(summary.monthlyOverrides, 'monthly override')}</span>
      <span>{countLabel(summary.months, 'month with overrides', 'months with overrides')}</span>
    </div>
  );
}

export function StorageOverview({
  auth,
  transactionCount,
  budgets,
  budgetPreferences,
  serverHasBudgets,
  serverBudgetSummary,
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
  serverBudgetSummary: BudgetPlanSummary | null;
  localRuleCount: number;
  localCategoryCount: number;
  rulePreferences: RulePreferences;
  serverRuleCount: number | null;
  serverCategoryCount: number | null;
}): ReactElement {
  const localBudgetSummary = summarizeBudgetPlan(budgets);
  const unavailableBudgetServer = syncAvailability(auth, budgetPreferences.storePrivateBudgets);
  const unavailableRulesServer = syncAvailability(auth, rulePreferences.storePrivateRules);

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
              <td>{countLabel(transactionCount, 'imported transaction')}</td>
              <td>0 transactions — never uploaded</td>
            </tr>
            <tr>
              <th scope="row">Budgets</th>
              <td>{budgetSummaryLines(localBudgetSummary)}</td>
              <td>
                {unavailableBudgetServer
                  ? unavailableBudgetServer
                  : serverHasBudgets === null
                    ? 'Checking…'
                    : serverBudgetSummary
                      ? budgetSummaryLines(serverBudgetSummary)
                      : '0 budget categories · 0 monthly overrides · no plan stored'}
              </td>
            </tr>
            <tr>
              <th scope="row">Categories and rules</th>
              <td>
                <div className="account-table-summary">
                  <span>{countLabel(localCategoryCount, 'category', 'categories')}</span>
                  <span>{countLabel(localRuleCount, 'rule')}</span>
                </div>
              </td>
              <td>
                {unavailableRulesServer ? (
                  unavailableRulesServer
                ) : serverRuleCount === null || serverCategoryCount === null ? (
                  'Checking…'
                ) : (
                  <div className="account-table-summary">
                    <span>{countLabel(serverCategoryCount, 'private category')}</span>
                    <span>{countLabel(serverRuleCount, 'private rule')}</span>
                  </div>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </article>
  );
}
