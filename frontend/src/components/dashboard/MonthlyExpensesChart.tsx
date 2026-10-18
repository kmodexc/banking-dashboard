import type { ReactElement } from 'react';
import type { Transaction } from '../../types';
import { chartColors, formatPeriod, money } from '../../utils/format';

export function MonthlyExpensesChart({
  transactions,
  categories,
  selectedCategories,
}: {
  transactions: Transaction[];
  categories: string[];
  selectedCategories: string[] | null;
}): ReactElement {
  const activeCategories = selectedCategories ?? categories;
  const monthly = [...new Set(transactions.map((transaction) => transaction.period))]
    .sort()
    .map((period) => {
      const categoryTotals = transactions
        .filter(
          (transaction) =>
            transaction.period === period &&
            transaction.type === 'Ausgang' &&
            activeCategories.includes(transaction.category),
        )
        .reduce<Record<string, number>>((result, transaction) => {
          result[transaction.category] =
            (result[transaction.category] ?? 0) + Math.abs(transaction.amount);
          return result;
        }, {});
      return {
        period,
        categoryTotals,
        total: Object.values(categoryTotals).reduce((sum, value) => sum + value, 0),
      };
    });
  const maximum = Math.max(...monthly.map((row) => row.total), 1);
  const grandTotal = monthly.reduce((sum, row) => sum + row.total, 0);
  const visibleCategories = categories.filter((category) =>
    monthly.some((row) => row.categoryTotals[category]),
  );

  return (
    <article className="panel monthly-panel">
      <div className="panel-heading">
        <div>
          <h2>Expenses over time</h2>
          <span className="muted">Monthly totals split by category</span>
        </div>
        <span className="panel-total">{money(grandTotal)} total</span>
      </div>
      <div className="monthly-chart" role="img" aria-label="Monthly expenses by category">
        {monthly.map((row) => (
          <div className="month-column" key={row.period}>
            <span className="month-total">{money(row.total)}</span>
            <div className="month-bar-area">
              <div
                className="month-stack"
                style={{ height: `${(row.total / maximum) * 100}%` }}
                title={`${formatPeriod(row.period)}: ${money(row.total)}`}
              >
                {visibleCategories.map((category, index) => {
                  const value = row.categoryTotals[category] ?? 0;
                  return value ? (
                    <span
                      className="month-segment"
                      key={category}
                      style={{
                        height: `${(value / row.total) * 100}%`,
                        background: chartColors[index % chartColors.length],
                      }}
                      title={`${category}: ${money(value)}`}
                    />
                  ) : null;
                })}
              </div>
            </div>
            <span className="month-label">{formatPeriod(row.period).split(' ')[0]}</span>
            <span className="month-year">{row.period.slice(0, 4)}</span>
          </div>
        ))}
      </div>
      {visibleCategories.length ? (
        <div className="monthly-legend">
          {visibleCategories.map((category, index) => (
            <span key={category}>
              <i style={{ background: chartColors[index % chartColors.length] }} />
              {category}
            </span>
          ))}
        </div>
      ) : (
        <p className="muted empty-copy">No expense data matches the selected categories.</p>
      )}
    </article>
  );
}
