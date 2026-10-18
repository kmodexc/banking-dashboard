import { useMemo, useState, type ReactElement } from 'react';
import type { BudgetPlan } from '../data/budgets';
import type { BudgetPreferences } from '../data/preferences';
import type { AuthSnapshot } from '../types';
import type { Transaction } from '../types';
import { formatPeriod, money } from '../utils/format';
import { PlanBarChart } from './PlanBarChart';
import { PlanBoxPlot } from './PlanBoxPlot';
import { BudgetEditor, type BudgetMode } from './BudgetEditor';
import { BudgetStorageSettings } from './BudgetStorageSettings';
import { PeriodHeader } from './PeriodHeader';
import { PlanProgressList } from './PlanProgressList';
import type { PlanBudgetRow } from './planViewTypes';

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

      <BudgetEditor
        budgets={budgets}
        categories={visibleCategories}
        period={period}
        mode={mode}
        onModeChange={setMode}
        onBudgetsChange={onBudgetsChange}
      />

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
