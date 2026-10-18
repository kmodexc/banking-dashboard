import { useMemo, useState } from 'react';
import type { Transaction } from '../../types';
import type { TransactionTypeFilter } from '../transactions/TransactionFilters';

interface DashboardDataOptions {
  transactions: Transaction[];
  period: string;
  categories: string[];
  selectedCategories: string[] | null;
}

export function useDashboardData({
  transactions,
  period,
  categories,
  selectedCategories,
}: DashboardDataOptions) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<TransactionTypeFilter>('expenses');

  return useMemo(() => {
    const rows = transactions.filter((transaction) => transaction.period === period);
    const activeCategories = selectedCategories ?? categories;
    const outgoingRows = rows.filter((row) => row.type === 'Ausgang');
    const incomeRows = rows.filter((row) => row.type === 'Eingang');
    const filteredRows = outgoingRows.filter((row) => activeCategories.includes(row.category));
    const displayedRows = typeFilter === 'income' ? incomeRows : filteredRows;
    const income = incomeRows.reduce((sum, row) => sum + row.amount, 0);
    const expenses = Math.abs(filteredRows.reduce((sum, row) => sum + row.amount, 0));
    const byCategory = Object.entries(
      filteredRows.reduce<Record<string, number>>((result, row) => {
        result[row.category] = (result[row.category] ?? 0) + Math.abs(row.amount);
        return result;
      }, {}),
    ).sort((left, right) => right[1] - left[1]);
    const periods = [...new Set(transactions.map((transaction) => transaction.period))].sort();
    const selectedTransaction = selectedId
      ? (rows.find((row) => row.id === selectedId) ?? null)
      : null;

    return {
      rows,
      periods,
      periodIndex: periods.indexOf(period),
      incomeRows,
      outgoingRows,
      displayedRows,
      income,
      expenses,
      byCategory,
      expenseTotal: byCategory.reduce((sum, [, value]) => sum + value, 0),
      selectedTransaction,
      selectedId,
      setSelectedId,
      typeFilter,
      setTypeFilter,
    };
  }, [categories, period, selectedCategories, selectedId, transactions, typeFilter]);
}
