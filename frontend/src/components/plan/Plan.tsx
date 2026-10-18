import { useState, type ReactElement } from 'react';
import type { BudgetPlan } from '../../data/budgets';
import type { BudgetPreferences } from '../../data/preferences';
import type { AuthSnapshot, Transaction } from '../../types';
import { usePlanData } from '../../hooks/usePlanData';
import { BudgetEditor, type BudgetMode } from './BudgetEditor';
import { BudgetStorageSettings } from './BudgetStorageSettings';
import { PeriodHeader } from '../shared/PeriodHeader';
import { PlanProgressPanel } from './PlanProgressPanel';
import type { PlanView } from './planViewTypes';

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
  const [mode, setMode] = useState<BudgetMode>('monthly');
  const [view, setView] = useState<PlanView>('list');
  const {
    period,
    setPeriod,
    rows,
    visibleCategories,
    budgetRows,
    totalSpent,
    totalBudget,
    remaining,
  } = usePlanData(transactions, categories, budgets, initialPeriod);

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

      <PlanProgressPanel
        period={period}
        visibleCategories={visibleCategories.length}
        budgetRows={budgetRows}
        totalSpent={totalSpent}
        totalBudget={totalBudget}
        remaining={remaining}
        view={view}
        onViewChange={setView}
      />

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

function shiftPeriod(period: string, offset: number): string {
  const [year, month] = period.split('-').map(Number);
  if (!year || !month) return period;
  const date = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}
