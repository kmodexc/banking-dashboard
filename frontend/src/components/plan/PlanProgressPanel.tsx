import type { ReactElement } from 'react';
import { formatPeriod, money } from '../../utils/format';
import { PlanBarChart } from '../PlanBarChart';
import { PlanBoxPlot } from '../PlanBoxPlot';
import { PlanProgressList } from '../PlanProgressList';
import type { PlanBudgetRow } from '../planViewTypes';
import type { PlanView } from '../planViewTypes';

export function PlanProgressPanel({
  period,
  visibleCategories,
  budgetRows,
  totalSpent,
  totalBudget,
  remaining,
  view,
  onViewChange,
}: {
  period: string;
  visibleCategories: number;
  budgetRows: PlanBudgetRow[];
  totalSpent: number;
  totalBudget: number;
  remaining: number;
  view: PlanView;
  onViewChange: (view: PlanView) => void;
}): ReactElement {
  return (
    <article className="panel plan-progress-panel">
      <div className="panel-heading">
        <div>
          <h2>Spending vs budget</h2>
          <p className="muted">{formatPeriod(period)} · expenses grouped by category</p>
        </div>
        <span className="panel-total">{money(totalSpent)} spent</span>
      </div>
      <div className="plan-progress-legend" aria-label="Budget bar legend">
        <span>
          <i className="plan-budget-marker" /> 100% budget
        </span>
        <span>Bars show spending up to 150%</span>
      </div>
      <div className="plan-summary-grid">
        <div className="plan-summary-card">
          <span className="metric-label">Planned</span>
          <strong>{money(totalBudget)}</strong>
        </div>
        <div className="plan-summary-card">
          <span className="metric-label">Remaining</span>
          <strong className={remaining < 0 ? 'over-budget-text' : ''}>{money(remaining)}</strong>
        </div>
        <div className="plan-summary-card">
          <span className="metric-label">Categories</span>
          <strong>{visibleCategories}</strong>
        </div>
      </div>
      <div className="plan-view-switch plan-mode-switch" role="tablist" aria-label="Budget view">
        <button
          className={`plan-mode-button${view === 'list' ? ' active' : ''}`}
          type="button"
          role="tab"
          aria-selected={view === 'list'}
          onClick={() => onViewChange('list')}
        >
          Category bars
        </button>
        <button
          className={`plan-mode-button${view === 'chart' ? ' active' : ''}`}
          type="button"
          role="tab"
          aria-selected={view === 'chart'}
          onClick={() => onViewChange('chart')}
        >
          Bar chart
        </button>
        <button
          className={`plan-mode-button${view === 'boxplot' ? ' active' : ''}`}
          type="button"
          role="tab"
          aria-selected={view === 'boxplot'}
          onClick={() => onViewChange('boxplot')}
        >
          History box plot
        </button>
      </div>
      {view === 'list' ? (
        <PlanProgressList rows={budgetRows} />
      ) : view === 'chart' ? (
        <PlanBarChart rows={budgetRows} />
      ) : (
        <PlanBoxPlot rows={budgetRows} />
      )}
    </article>
  );
}
