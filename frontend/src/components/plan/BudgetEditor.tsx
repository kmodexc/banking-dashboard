import type { ReactElement } from 'react';
import type { BudgetPlan } from '../../data/budgets';
import { clearMonthlyBudget, updateBudgetValue } from '../../data/budgets';
import { formatPeriod } from '../../utils/format';
import { BudgetCategoryGrid } from './budgets/BudgetCategoryGrid';
import { BudgetScopeSwitch } from './budgets/BudgetScopeSwitch';
import { BudgetTotal } from './budgets/BudgetTotal';
import type { BudgetMode } from './budgetTypes';

export type { BudgetMode } from './budgetTypes';

export function BudgetEditor({
  budgets,
  categories,
  period,
  mode,
  onModeChange,
  onBudgetsChange,
}: {
  budgets: BudgetPlan;
  categories: string[];
  period: string;
  mode: BudgetMode;
  onModeChange: (next: BudgetMode) => void;
  onBudgetsChange: (next: BudgetPlan) => void;
}): ReactElement {
  const monthlyBudgets = budgets.monthly[period] ?? {};
  const editorBudgets = mode === 'default' ? budgets.defaults : monthlyBudgets;
  const budgetEditorTotal = categories.reduce(
    (sum, category) =>
      sum +
      (mode === 'default'
        ? (budgets.defaults[category] ?? 0)
        : (monthlyBudgets[category] ?? budgets.defaults[category] ?? 0)),
    0,
  );

  function changeBudget(category: string, value: string): void {
    const trimmed = value.trim();
    if (!trimmed) {
      onBudgetsChange(updateBudgetValue(budgets, mode, period, category, null));
      return;
    }
    const amount = Number(trimmed);
    if (Number.isFinite(amount) && amount >= 0) {
      onBudgetsChange(updateBudgetValue(budgets, mode, period, category, amount));
    }
  }

  return (
    <article className="panel plan-editor-panel">
      <div className="budget-editor-header">
        <div className="budget-editor-title">
          <span className="budget-editor-kicker">Budget setup</span>
          <h2>
            {mode === 'default' ? 'Default monthly budgets' : `${formatPeriod(period)} budgets`}
          </h2>
          <p className="muted">
            {mode === 'default'
              ? 'These amounts apply to every month unless you set a month-specific budget.'
              : 'Leave a field empty to use the default budget for this category.'}
          </p>
        </div>
        <BudgetScopeSwitch
          mode={mode}
          period={period}
          hasMonthlyBudgets={Boolean(Object.keys(monthlyBudgets).length)}
          onModeChange={onModeChange}
          onResetMonthly={() => onBudgetsChange(clearMonthlyBudget(budgets, period))}
        />
      </div>
      <BudgetCategoryGrid
        categories={categories}
        mode={mode}
        monthlyBudgets={monthlyBudgets}
        defaultBudgets={budgets.defaults}
        editorBudgets={editorBudgets}
        onChange={changeBudget}
      />
      {!categories.length && <p className="muted empty-copy">No categories available yet.</p>}
      <BudgetTotal mode={mode} period={period} total={budgetEditorTotal} />
    </article>
  );
}
