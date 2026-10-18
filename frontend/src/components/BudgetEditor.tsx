import type { ReactElement } from 'react';
import type { BudgetPlan } from '../data/budgets';
import { clearMonthlyBudget, updateBudgetValue } from '../data/budgets';
import { formatPeriod, money } from '../utils/format';

export type BudgetMode = 'default' | 'monthly';

function hasValue(map: Record<string, number>, category: string): boolean {
  return Object.prototype.hasOwnProperty.call(map, category);
}

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
      <div className="plan-mode-switch" role="tablist" aria-label="Budget mode">
        <button
          className={`plan-mode-button${mode === 'default' ? ' active' : ''}`}
          type="button"
          role="tab"
          aria-selected={mode === 'default'}
          onClick={() => onModeChange('default')}
        >
          Default budgets
        </button>
        <button
          className={`plan-mode-button${mode === 'monthly' ? ' active' : ''}`}
          type="button"
          role="tab"
          aria-selected={mode === 'monthly'}
          onClick={() => onModeChange('monthly')}
        >
          This month
        </button>
      </div>

      <div className="panel-heading">
        <div>
          <h2>
            {mode === 'default' ? 'Default monthly budgets' : `${formatPeriod(period)} budgets`}
          </h2>
          <p className="muted">
            {mode === 'default'
              ? 'These amounts apply to every month unless you set a month-specific budget.'
              : 'Leave a field empty to use the default budget for this category.'}
          </p>
        </div>
        {mode === 'monthly' && (
          <button
            className="button secondary danger-button"
            type="button"
            disabled={!Object.keys(monthlyBudgets).length}
            onClick={() => onBudgetsChange(clearMonthlyBudget(budgets, period))}
          >
            Reset month-specific budgets
          </button>
        )}
      </div>
      <div className="budget-editor-grid">
        {categories.map((category) => {
          const hasMonthlyBudget = hasValue(monthlyBudgets, category);
          const defaultBudget = budgets.defaults[category] ?? 0;
          return (
            <label className="budget-editor-row" key={category}>
              <span>{category}</span>
              <span className="budget-input-wrap">
                <span className="currency-prefix">€</span>
                <input
                  aria-label={`${category} ${mode === 'default' ? 'default' : 'monthly'} budget`}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder={
                    mode === 'monthly' && !hasMonthlyBudget ? String(defaultBudget) : '0.00'
                  }
                  value={editorBudgets[category] ?? ''}
                  onChange={(event) => changeBudget(category, event.currentTarget.value)}
                />
                <span className="budget-suffix">/ month</span>
              </span>
              {mode === 'monthly' && !hasMonthlyBudget && (
                <small className="budget-fallback">Using default: {money(defaultBudget)}</small>
              )}
            </label>
          );
        })}
      </div>
      {!categories.length && <p className="muted empty-copy">No categories available yet.</p>}
      <div className="budget-editor-total">
        <span>
          {mode === 'default'
            ? 'Total default budget'
            : `Total planned for ${formatPeriod(period)}`}
        </span>
        <strong>{money(budgetEditorTotal)} / month</strong>
      </div>
    </article>
  );
}
