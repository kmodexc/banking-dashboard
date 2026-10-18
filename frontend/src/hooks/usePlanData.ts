import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import type { BudgetPlan } from '../data/budgets';
import type { Transaction } from '../types';
import type { PlanBudgetRow } from '../components/planViewTypes';

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

export function usePlanData(
  transactions: Transaction[],
  categories: string[],
  budgets: BudgetPlan,
  initialPeriod: string,
): {
  period: string;
  setPeriod: Dispatch<SetStateAction<string>>;
  rows: Transaction[];
  visibleCategories: string[];
  budgetRows: PlanBudgetRow[];
  totalSpent: number;
  totalBudget: number;
  remaining: number;
} {
  const [period, setPeriod] = useState(initialPeriod || currentPeriod());
  const monthlyBudgets = budgets.monthly[period] ?? {};
  const rows = useMemo(
    () =>
      transactions.filter(
        (transaction) => transaction.period === period && transaction.type === 'Ausgang',
      ),
    [period, transactions],
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

  return {
    period,
    setPeriod,
    rows,
    visibleCategories,
    budgetRows,
    totalSpent,
    totalBudget,
    remaining: totalBudget - totalSpent,
  };
}
