import type { ReactElement } from 'react';
import type { Transaction } from '../../types';
import type { RulesController } from '../rules/ruleTypes';
import { DashboardHeader } from './DashboardHeader';
import { ExpenseCategoryPanel } from './ExpenseCategoryPanel';
import { MetricGrid } from './MetricGrid';
import { MonthlyExpensesChart } from './MonthlyExpensesChart';
import { TransactionDetailsModal } from '../transactions/TransactionDetailsModal';
import { TransactionFilters } from '../transactions/TransactionFilters';
import { TransactionTable } from '../transactions/TransactionTable';
import { useDashboardData } from './useDashboardData';

export function Dashboard({
  transactions,
  period,
  onPeriodChange,
  categories,
  selectedCategories,
  onCategoryFilterChange,
  onCategoryChange,
  rulesController,
}: {
  transactions: Transaction[];
  period: string;
  onPeriodChange: (period: string) => void;
  categories: string[];
  selectedCategories: string[] | null;
  onCategoryFilterChange: (categories: string[] | null) => void;
  onCategoryChange: (transactionId: string, category: string) => void;
  rulesController?: RulesController;
}): ReactElement {
  const {
    periods,
    periodIndex,
    incomeRows,
    outgoingRows,
    displayedRows,
    income,
    expenses,
    byCategory,
    expenseTotal,
    selectedTransaction,
    setSelectedId,
    typeFilter,
    setTypeFilter,
  } = useDashboardData({ transactions, period, categories, selectedCategories });

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
          transactions={transactions}
          rulesController={rulesController}
          onClose={() => setSelectedId(null)}
          onCategoryChange={onCategoryChange}
        />
      )}
    </section>
  );
}
