import { useMemo, useState, type ReactElement } from 'react';
import type { BudgetPlan } from '../data/budgets';
import { updateBudgetValue } from '../data/budgets';
import type { Transaction } from '../types';
import { formatPeriod, money } from '../utils/format';

type BudgetMode = 'default' | 'monthly';

function shiftPeriod(period: string, offset: number): string {
  const [year, month] = period.split('-').map(Number);
  if (!year || !month) return period;
  const date = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function hasValue(map: Record<string, number>, category: string): boolean {
  return Object.prototype.hasOwnProperty.call(map, category);
}

export function Plan({
  transactions,
  categories,
  initialPeriod,
  budgets,
  onBudgetsChange,
}: {
  transactions: Transaction[];
  categories: string[];
  initialPeriod: string;
  budgets: BudgetPlan;
  onBudgetsChange: (next: BudgetPlan) => void;
}): ReactElement {
  const [period, setPeriod] = useState(initialPeriod || currentPeriod());
  const [mode, setMode] = useState<BudgetMode>('monthly');
  const monthlyBudgets = budgets.monthly[period] ?? {};
  const rows = transactions.filter(
    (transaction) => transaction.period === period && transaction.type === 'Ausgang',
  );
  const spentByCategory = useMemo(
    () =>
      rows.reduce<Record<string, number>>((result, transaction) => {
        result[transaction.category] =
          (result[transaction.category] ?? 0) + Math.abs(transaction.amount);
        return result;
      }, {}),
    [rows],
  );
  const visibleCategories = useMemo(
    () =>
      [...new Set([...categories, ...Object.keys(spentByCategory)])].sort((left, right) =>
        left.localeCompare(right),
      ),
    [categories, spentByCategory],
  );
  const budgetRows = visibleCategories.map((category) => {
    const spent = spentByCategory[category] ?? 0;
    const hasMonthlyBudget = hasValue(monthlyBudgets, category);
    const budget = hasMonthlyBudget ? monthlyBudgets[category]! : (budgets.defaults[category] ?? 0);
    const percentage = budget > 0 ? Math.round((spent / budget) * 100) : null;
    return { category, spent, budget, hasMonthlyBudget, percentage };
  });
  const totalSpent = budgetRows.reduce((sum, row) => sum + row.spent, 0);
  const totalBudget = budgetRows.reduce((sum, row) => sum + row.budget, 0);
  const remaining = totalBudget - totalSpent;
  const editorBudgets = mode === 'default' ? budgets.defaults : monthlyBudgets;

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
    <section id="plan-tab" className="tab-panel">
      <div className="period-header plan-period-header">
        <div>
          <span className="eyebrow accent-eyebrow">Plan</span>
          <h2 className="period-title">{formatPeriod(period)}</h2>
          <p className="muted period-subtitle">
            {rows.length} outgoing {rows.length === 1 ? 'transaction' : 'transactions'} in this
            month
          </p>
        </div>
        <div className="period-nav" aria-label="Navigate between plan months">
          <button
            className="icon-button"
            type="button"
            aria-label="Previous plan month"
            onClick={() => setPeriod((current) => shiftPeriod(current, -1))}
          >
            ←
          </button>
          <span className="period-count">{formatPeriod(period)}</span>
          <button
            className="icon-button"
            type="button"
            aria-label="Next plan month"
            onClick={() => setPeriod((current) => shiftPeriod(current, 1))}
          >
            →
          </button>
        </div>
      </div>

      <div className="plan-mode-switch" role="tablist" aria-label="Budget mode">
        <button
          className={`plan-mode-button${mode === 'default' ? ' active' : ''}`}
          type="button"
          role="tab"
          aria-selected={mode === 'default'}
          onClick={() => setMode('default')}
        >
          Default budgets
        </button>
        <button
          className={`plan-mode-button${mode === 'monthly' ? ' active' : ''}`}
          type="button"
          role="tab"
          aria-selected={mode === 'monthly'}
          onClick={() => setMode('monthly')}
        >
          This month
        </button>
      </div>

      <article className="panel plan-editor-panel">
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
        </div>
        <div className="budget-editor-grid">
          {visibleCategories.map((category) => {
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
        {!visibleCategories.length && (
          <p className="muted empty-copy">No categories available yet.</p>
        )}
      </article>

      <article className="panel plan-progress-panel">
        <div className="panel-heading">
          <div>
            <h2>Spending vs budget</h2>
            <p className="muted">{formatPeriod(period)} · expenses grouped by category</p>
          </div>
          <span className="panel-total">{money(totalSpent)} spent</span>
        </div>
        <div className="plan-summary-grid">
          <div className="plan-summary-card">
            <span className="metric-label">Planned</span>
            <strong>{money(totalBudget)}</strong>
          </div>
          <div className="plan-summary-card">
            <span className="metric-label">Remaining</span>
            <strong className={remaining < 0 ? 'over-budget-text' : ''}>{money(remaining)}</strong>
          </div>
          <div className="plan-summary-card">
            <span className="metric-label">Categories</span>
            <strong>{visibleCategories.length}</strong>
          </div>
        </div>
        <div className="plan-progress-list">
          {budgetRows.map((row) => {
            const width = row.percentage === null ? 0 : Math.min(row.percentage, 100);
            const isOverBudget = row.percentage !== null && row.percentage > 100;
            return (
              <div className="plan-progress-row" key={row.category}>
                <div className="plan-progress-heading">
                  <strong>{row.category}</strong>
                  <span className={isOverBudget ? 'over-budget-text' : 'muted'}>
                    {row.percentage === null ? 'No budget' : `${row.percentage}%`}
                  </span>
                </div>
                <div
                  className={`plan-progress-track${isOverBudget ? ' over-budget' : ''}`}
                  role="progressbar"
                  aria-label={`${row.category} spending progress`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={row.percentage === null ? 0 : row.percentage}
                >
                  <span className="plan-progress-fill" style={{ width: `${width}%` }} />
                </div>
                <div className="plan-progress-details">
                  <span>{money(row.spent)} spent</span>
                  <span>
                    {row.budget ? `${money(row.budget)} planned` : 'Set a budget above'}
                    {row.hasMonthlyBudget && <em> · month-specific</em>}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        {!budgetRows.length && (
          <p className="muted empty-copy">Add categories to start planning.</p>
        )}
      </article>
    </section>
  );
}
