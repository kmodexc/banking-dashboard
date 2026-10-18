import type { ReactElement } from 'react';
import { chartColors, money } from '../../utils/format';

export function ExpenseCategoryPanel({
  byCategory,
  expenseTotal,
}: {
  byCategory: [category: string, value: number][];
  expenseTotal: number;
}): ReactElement {
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

  return (
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
  );
}
