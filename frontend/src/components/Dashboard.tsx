import { useState, type ReactElement } from 'react';
import type { Transaction } from '../types';
import { chartColors, formatPeriod, money } from '../utils/format';
import { CategoryFilter } from './CategoryFilter';
import { MonthlyExpensesChart } from './MonthlyExpensesChart';
import { TransactionDetailsModal } from './TransactionDetailsModal';
import { TransactionTable } from './TransactionTable';

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

  const activeCategories = selectedCategories ?? categories;
  const filteredRows = rows.filter((row) => activeCategories.includes(row.category));
  const income = rows
    .filter((row) => row.type === 'Eingang' && activeCategories.includes(row.category))
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
  let pieStart = 0;
  const pieGradient = byCategory.length
    ? `conic-gradient(${byCategory
        .map(([, value], index) => {
          const end = pieStart + (value / expenseTotal) * 100;
          const segment = `${chartColors[index % chartColors.length]} ${pieStart}% ${end}%`;
          pieStart = end;
          return segment;
        })
        .join(', ')})`
    : 'conic-gradient(#edf1f5 0 100%)';
  const periods = [...new Set(transactions.map((transaction) => transaction.period))].sort();
  const periodIndex = periods.indexOf(period);
  const selectedTransaction = selectedId
    ? (rows.find((row) => row.id === selectedId) ?? null)
    : null;

  return (
    <section id="dashboard-tab" className="tab-panel">
      <div className="period-header">
        <div>
          <span className="eyebrow accent-eyebrow">Dashboard</span>
          <h2 className="period-title">{formatPeriod(period)}</h2>
          <p className="muted period-subtitle">
            {filteredRows.length} of {rows.length} transactions shown
          </p>
        </div>
        <div className="period-nav" aria-label="Navigate between months">
          <button
            className="icon-button"
            type="button"
            aria-label="Previous month"
            disabled={periodIndex <= 0}
            onClick={() => onPeriodChange(periods[periodIndex - 1] ?? period)}
          >
            ←
          </button>
          <span className="period-count">
            {periodIndex + 1} / {periods.length}
          </span>
          <button
            className="icon-button"
            type="button"
            aria-label="Next month"
            disabled={periodIndex < 0 || periodIndex >= periods.length - 1}
            onClick={() => onPeriodChange(periods[periodIndex + 1] ?? period)}
          >
            →
          </button>
        </div>
      </div>
      <div id="metrics" className="metric-grid">
        {[
          ['Income', income],
          ['Expenses', expenses],
          ['Net', income - expenses],
        ].map(([label, value]) => (
          <div className="metric" key={String(label)}>
            <span className="metric-label">{label}</span>
            <span className="metric-value">{money(Number(value))}</span>
          </div>
        ))}
      </div>
      <CategoryFilter
        categories={categories}
        selectedCategories={selectedCategories}
        onChange={onCategoryFilterChange}
      />
      <MonthlyExpensesChart
        transactions={transactions}
        categories={categories}
        selectedCategories={selectedCategories}
      />
      <div className="content-grid dashboard-grid">
        <article className="panel category-panel">
          <div className="panel-heading">
            <div>
              <h2>Where your money went</h2>
              <span className="muted">Expenses by category</span>
            </div>
            <span className="panel-total">{money(expenseTotal)}</span>
          </div>
          <div
            id="category-chart"
            className="pie-chart"
            role="img"
            aria-label={`Expenses by category totaling ${money(expenseTotal)}`}
            style={{ background: pieGradient }}
          >
            <div className="pie-hole">
              <strong>{money(expenseTotal)}</strong>
              <span>expenses</span>
            </div>
          </div>
          <div className="chart-legend">
            {byCategory.length ? (
              byCategory.map(([category, value], index) => (
                <div className="legend-row" key={category}>
                  <span className="legend-label">
                    <span
                      className="legend-dot"
                      style={{ background: chartColors[index % chartColors.length] }}
                    />
                    {category}
                  </span>
                  <span className="legend-value">
                    {expenseTotal ? Math.round((value / expenseTotal) * 100) : 0}% · {money(value)}
                  </span>
                </div>
              ))
            ) : (
              <p className="muted empty-copy">No outgoing transactions match this filter.</p>
            )}
          </div>
        </article>
        <article className="panel transactions-panel">
          <TransactionTable rows={filteredRows} onSelect={setSelectedId} />
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
