import { useMemo, useState, type ReactElement } from 'react';
import type { BudgetPlan } from '../data/budgets';
import { clearMonthlyBudget, updateBudgetValue } from '../data/budgets';
import type { BudgetPreferences } from '../data/preferences';
import type { AuthSnapshot } from '../types';
import type { Transaction } from '../types';
import { formatPeriod, money } from '../utils/format';
import { PlanBarChart } from './PlanBarChart';
import { PlanBoxPlot } from './PlanBoxPlot';
import { BudgetStorageSettings } from './BudgetStorageSettings';
import { PeriodHeader } from './PeriodHeader';
import { PlanProgressList } from './PlanProgressList';
import type { PlanBudgetRow } from './planViewTypes';

type BudgetMode = 'default' | 'monthly';
type PlanView = 'list' | 'chart' | 'boxplot';

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

function percentile(sortedValues: number[], fraction: number): number {
  const position = (sortedValues.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sortedValues[lower] ?? 0;
  const weight = position - lower;
  return (sortedValues[lower] ?? 0) * (1 - weight) + (sortedValues[upper] ?? 0) * weight;
}

function summarizeHistory(values: number[]) {
  if (!values.length) return null;
  const sortedValues = [...values].sort((left, right) => left - right);
  const total = sortedValues.reduce((sum, value) => sum + value, 0);
  return {
    months: sortedValues.length,
    min: sortedValues[0] ?? 0,
    q1: percentile(sortedValues, 0.25),
    median: percentile(sortedValues, 0.5),
    average: total / sortedValues.length,
    q3: percentile(sortedValues, 0.75),
    max: sortedValues[sortedValues.length - 1] ?? 0,
  };
}

export function Plan({
  transactions,
  categories,
  initialPeriod,
  auth,
  budgets,
  budgetPreferences,
  budgetSyncStatus,
  onBudgetsChange,
  onBudgetPreferencesChange,
  onDeleteServerBudgets,
}: {
  transactions: Transaction[];
  categories: string[];
  initialPeriod: string;
  auth: AuthSnapshot;
  budgets: BudgetPlan;
  budgetPreferences: BudgetPreferences;
  budgetSyncStatus: string;
  onBudgetsChange: (next: BudgetPlan) => void;
  onBudgetPreferencesChange: (next: BudgetPreferences) => void;
  onDeleteServerBudgets: () => void;
}): ReactElement {
  const [period, setPeriod] = useState(initialPeriod || currentPeriod());
  const [mode, setMode] = useState<BudgetMode>('monthly');
  const [view, setView] = useState<PlanView>('list');
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
  const historicalPeriods = useMemo(
    () =>
      [
        ...new Set(
          transactions
            .filter(
              (transaction) => transaction.type === 'Ausgang' && transaction.period !== period,
            )
            .map((transaction) => transaction.period),
        ),
      ].sort(),
    [period, transactions],
  );
  const historicalSpent = useMemo(() => {
    const totals = new Map<string, Record<string, number>>();
    historicalPeriods.forEach((historicalPeriod) => totals.set(historicalPeriod, {}));
    transactions.forEach((transaction) => {
      if (transaction.type !== 'Ausgang' || transaction.period === period) return;
      const monthTotals = totals.get(transaction.period);
      if (!monthTotals) return;
      monthTotals[transaction.category] =
        (monthTotals[transaction.category] ?? 0) + Math.abs(transaction.amount);
    });
    return totals;
  }, [historicalPeriods, period, transactions]);
  const budgetRows: PlanBudgetRow[] = visibleCategories.map((category) => {
    const spent = spentByCategory[category] ?? 0;
    const hasMonthlyBudget = hasValue(monthlyBudgets, category);
    const budget = hasMonthlyBudget ? monthlyBudgets[category]! : (budgets.defaults[category] ?? 0);
    const percentage = budget > 0 ? Math.round((spent / budget) * 100) : null;
    const historyValues = historicalPeriods.map(
      (historicalPeriod) => historicalSpent.get(historicalPeriod)?.[category] ?? 0,
    );
    return {
      category,
      spent,
      budget,
      hasMonthlyBudget,
      percentage,
      history: summarizeHistory(historyValues),
    };
  });
  const totalSpent = budgetRows.reduce((sum, row) => sum + row.spent, 0);
  const totalBudget = budgetRows.reduce((sum, row) => sum + row.budget, 0);
  const remaining = totalBudget - totalSpent;
  const editorBudgets = mode === 'default' ? budgets.defaults : monthlyBudgets;
  const budgetEditorTotal = visibleCategories.reduce(
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
    <section id="plan-tab" className="tab-panel">
      <PeriodHeader
        eyebrow="Plan"
        period={period}
        subtitle={`${rows.length} outgoing ${rows.length === 1 ? 'transaction' : 'transactions'} in this month`}
        navigationLabel="Navigate between plan months"
        previousLabel="Previous plan month"
        nextLabel="Next plan month"
        onPrevious={() => setPeriod((current) => shiftPeriod(current, -1))}
        onNext={() => setPeriod((current) => shiftPeriod(current, 1))}
      />

      <article className="panel plan-progress-panel">
        <div className="panel-heading">
          <div>
            <h2>Spending vs budget</h2>
            <p className="muted">{formatPeriod(period)} · expenses grouped by category</p>
          </div>
          <span className="panel-total">{money(totalSpent)} spent</span>
        </div>
        <div className="plan-progress-legend" aria-label="Budget bar legend">
          <span>
            <i className="plan-budget-marker" /> 100% budget
          </span>
          <span>Bars show spending up to 150%</span>
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
        <div className="plan-view-switch plan-mode-switch" role="tablist" aria-label="Budget view">
          <button
            className={`plan-mode-button${view === 'list' ? ' active' : ''}`}
            type="button"
            role="tab"
            aria-selected={view === 'list'}
            onClick={() => setView('list')}
          >
            Category bars
          </button>
          <button
            className={`plan-mode-button${view === 'chart' ? ' active' : ''}`}
            type="button"
            role="tab"
            aria-selected={view === 'chart'}
            onClick={() => setView('chart')}
          >
            Bar chart
          </button>
          <button
            className={`plan-mode-button${view === 'boxplot' ? ' active' : ''}`}
            type="button"
            role="tab"
            aria-selected={view === 'boxplot'}
            onClick={() => setView('boxplot')}
          >
            History box plot
          </button>
        </div>
        {view === 'list' ? (
          <PlanProgressList rows={budgetRows} />
        ) : view === 'chart' ? (
          <PlanBarChart rows={budgetRows} />
        ) : (
          <PlanBoxPlot rows={budgetRows} />
        )}
      </article>

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
        <div className="budget-editor-total">
          <span>
            {mode === 'default'
              ? 'Total default budget'
              : `Total planned for ${formatPeriod(period)}`}
          </span>
          <strong>{money(budgetEditorTotal)} / month</strong>
        </div>
      </article>

      <BudgetStorageSettings
        auth={auth}
        budgetPreferences={budgetPreferences}
        budgetSyncStatus={budgetSyncStatus}
        onBudgetPreferencesChange={onBudgetPreferencesChange}
        onDeleteServerBudgets={onDeleteServerBudgets}
      />
    </section>
  );
}
