import type { ReactElement } from 'react';
import { money } from '../../utils/format';
import { MAX_VISUAL_PERCENTAGE, type PlanViewProps } from './planViewTypes';

export function PlanProgressList({ rows }: PlanViewProps): ReactElement {
  return (
    <div className="plan-progress-list">
      {rows.map((row) => {
        const width =
          row.percentage === null
            ? 0
            : (Math.min(row.percentage, MAX_VISUAL_PERCENTAGE) / MAX_VISUAL_PERCENTAGE) * 100;
        const isOverBudget = row.percentage !== null && row.percentage > 100;
        const overage = isOverBudget ? row.spent - row.budget : 0;
        return (
          <div className="plan-progress-row" key={row.category}>
            <div className="plan-progress-heading">
              <strong>{row.category}</strong>
              <span className={isOverBudget ? 'over-budget-text' : 'muted'}>
                {row.percentage === null ? 'No budget' : `${row.percentage}%`}
              </span>
            </div>
            <div
              className={`plan-progress-track${isOverBudget ? ' over-budget' : ''}`}
              role="progressbar"
              aria-label={`${row.category} spending progress`}
              aria-valuemin={0}
              aria-valuemax={MAX_VISUAL_PERCENTAGE}
              aria-valuenow={row.percentage === null ? 0 : row.percentage}
            >
              <span className="plan-budget-marker" />
              <span className="plan-progress-fill" style={{ width: `${width}%` }} />
            </div>
            <div className="plan-progress-details">
              <span>{money(row.spent)} spent</span>
              <span>
                {row.budget ? `${money(row.budget)} planned` : 'Set a budget above'}
                {row.hasMonthlyBudget && <em> · month-specific</em>}
              </span>
            </div>
            {isOverBudget && (
              <strong className="over-budget-text">{money(overage)} over budget</strong>
            )}
          </div>
        );
      })}
      {!rows.length && <p className="muted empty-copy">Add categories to start planning.</p>}
    </div>
  );
}
