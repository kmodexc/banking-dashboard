import type { ReactElement } from 'react';
import { formatPeriod } from '../utils/format';

export function DashboardHeader({
  period,
  periods,
  periodIndex,
  displayedCount,
  totalCount,
  transactionLabel,
  onPeriodChange,
}: {
  period: string;
  periods: string[];
  periodIndex: number;
  displayedCount: number;
  totalCount: number;
  transactionLabel: string;
  onPeriodChange: (period: string) => void;
}): ReactElement {
  return (
    <div className="period-header">
      <div>
        <span className="eyebrow accent-eyebrow">Dashboard</span>
        <h2 className="period-title">{formatPeriod(period)}</h2>
        <p className="muted period-subtitle">
          {displayedCount} of {totalCount} {transactionLabel} transactions shown
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
  );
}
