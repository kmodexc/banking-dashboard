import { useState, type ReactElement } from 'react';
import type { Transaction } from '../../types';
import { DashboardHeader } from './DashboardHeader';
import { ExpenseCategoryPanel } from './ExpenseCategoryPanel';
import { MetricGrid } from './MetricGrid';
import { MonthlyExpensesChart } from './MonthlyExpensesChart';
import { TransactionDetailsModal } from '../transactions/TransactionDetailsModal';
import { TransactionFilters, type TransactionTypeFilter } from '../transactions/TransactionFilters';
import { TransactionTable } from '../transactions/TransactionTable';

export function Dashboard({
  transactions,
  period,
  onPeriodChange,
  categories,
  selectedCategories,
  onCategoryFilterChange,
  onCategoryChange,
}: {
  transactions: Transaction[];
  period: string;
  onPeriodChange: (period: string) => void;
  categories: string[];
  selectedCategories: string[] | null;
  onCategoryFilterChange: (categories: string[] | null) => void;
  onCategoryChange: (transactionId: string, category: string) => void;
}): ReactElement {
  const rows = transactions.filter((transaction) => transaction.period === period);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<TransactionTypeFilter>('expenses');

  const activeCategories = selectedCategories ?? categories;
  const outgoingRows = rows.filter((row) => row.type === 'Ausgang');
  const incomeRows = rows.filter((row) => row.type === 'Eingang');
  const filteredRows = outgoingRows.filter((row) => activeCategories.includes(row.category));
  const displayedRows = typeFilter === 'income' ? incomeRows : filteredRows;
  const income = rows
    .filter((row) => row.type === 'Eingang')
    .reduce((sum, row) => sum + row.amount, 0);
  const expenses = Math.abs(
    filteredRows.filter((row) => row.type === 'Ausgang').reduce((sum, row) => sum + row.amount, 0),
  );
  const byCategory = Object.entries(
    filteredRows
      .filter((row) => row.type === 'Ausgang')
      .reduce<Record<string, number>>((result, row) => {
        result[row.category] = (result[row.category] ?? 0) + Math.abs(row.amount);
        return result;
      }, {}),
  ).sort((left, right) => right[1] - left[1]);
  const expenseTotal = byCategory.reduce((sum, [, value]) => sum + value, 0);
  const periods = [...new Set(transactions.map((transaction) => transaction.period))].sort();
  const periodIndex = periods.indexOf(period);
  const selectedTransaction = selectedId
    ? (rows.find((row) => row.id === selectedId) ?? null)
    : null;

  return (
    <section id="dashboard-tab" className="tab-panel">
      <DashboardHeader
        period={period}
        periods={periods}
        periodIndex={periodIndex}
        displayedCount={displayedRows.length}
        totalCount={typeFilter === 'income' ? incomeRows.length : outgoingRows.length}
        transactionLabel={typeFilter === 'income' ? 'income' : 'outgoing'}
        onPeriodChange={onPeriodChange}
      />
      <TransactionFilters
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        categories={categories}
        selectedCategories={selectedCategories}
        onCategoryFilterChange={onCategoryFilterChange}
      />
      <MetricGrid
        metrics={[
          ['Income', income],
          ['Expenses', expenses],
          ['Net', income - expenses],
        ]}
      />
      <MonthlyExpensesChart
        transactions={transactions}
        categories={categories}
        selectedCategories={selectedCategories}
      />
      <div className="content-grid dashboard-grid">
        <ExpenseCategoryPanel byCategory={byCategory} expenseTotal={expenseTotal} />
        <article className="panel transactions-panel">
          <TransactionTable rows={displayedRows} maxRows={500} onSelect={setSelectedId} />
        </article>
      </div>
      {selectedTransaction && (
        <TransactionDetailsModal
          transaction={selectedTransaction}
          categories={categories}
          onClose={() => setSelectedId(null)}
          onCategoryChange={onCategoryChange}
        />
      )}
    </section>
  );
}
