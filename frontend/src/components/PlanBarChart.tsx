import type { ReactElement } from 'react';
import { money } from '../utils/format';
import type { PlanViewProps } from './planViewTypes';

export function PlanBarChart({ rows }: PlanViewProps): ReactElement {
  const scale = Math.max(1, ...rows.flatMap((row) => [row.spent, row.budget]));

  return (
    <div className="plan-bar-chart" role="img" aria-label="Budget spending bar chart">
      <div className="plan-chart-legend" aria-label="Chart legend">
        <span>
          <i className="plan-chart-swatch spent" /> Spent
        </span>
        <span>
          <i className="plan-chart-swatch planned" /> Planned
        </span>
      </div>
      <div className="plan-chart-axis" aria-hidden="true">
        <span>€0</span>
        <span>{money(scale)}</span>
      </div>
      <div className="plan-chart-list">
        {rows.map((row) => {
          const isOverBudget = row.percentage !== null && row.percentage > 100;
          const spentWidth = `${(row.spent / scale) * 100}%`;
          const plannedWidth = `${(row.budget / scale) * 100}%`;
          const chartLabel = `${row.category}: ${money(row.spent)} spent, ${
            row.budget ? `${money(row.budget)} planned` : 'no budget'
          }`;

          return (
            <div className="plan-chart-row" key={row.category}>
              <div className="plan-chart-heading">
                <strong>{row.category}</strong>
                <span className={isOverBudget ? 'over-budget-text' : 'muted'}>
                  {row.percentage === null ? 'No budget' : `${row.percentage}%`}
                </span>
              </div>
              <div
                className="plan-chart-track"
                role="img"
                aria-label={chartLabel}
                title={chartLabel}
              >
                <span
                  className="plan-chart-bar plan-chart-planned"
                  style={{ width: plannedWidth }}
                />
                <span
                  className={`plan-chart-bar plan-chart-spent${isOverBudget ? ' over-budget' : ''}`}
                  style={{ width: spentWidth }}
                />
              </div>
              <div className="plan-progress-details">
                <span>{money(row.spent)} spent</span>
                <span>
                  {row.budget ? `${money(row.budget)} planned` : 'Set a budget above'}
                  {row.hasMonthlyBudget && <em> · month-specific</em>}
                </span>
              </div>
              {isOverBudget && (
                <strong className="over-budget-text">
                  {money(row.spent - row.budget)} over budget
                </strong>
              )}
            </div>
          );
        })}
      </div>
      {!rows.length && <p className="muted empty-copy">Add categories to start planning.</p>}
    </div>
  );
}
