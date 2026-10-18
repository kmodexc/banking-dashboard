import type { ReactElement } from 'react';
import { formatPeriod } from '../utils/format';

export function PeriodHeader({
  eyebrow,
  period,
  subtitle,
  navigationLabel,
  previousLabel,
  nextLabel,
  previousDisabled = false,
  nextDisabled = false,
  onPrevious,
  onNext,
}: {
  eyebrow: string;
  period: string;
  subtitle: string;
  navigationLabel: string;
  previousLabel: string;
  nextLabel: string;
  previousDisabled?: boolean;
  nextDisabled?: boolean;
  onPrevious: () => void;
  onNext: () => void;
}): ReactElement {
  return (
    <div className="period-header">
      <div>
        <span className="eyebrow accent-eyebrow">{eyebrow}</span>
        <h2 className="period-title">{formatPeriod(period)}</h2>
        <p className="muted period-subtitle">{subtitle}</p>
      </div>
      <div className="period-nav" aria-label={navigationLabel}>
        <button
          className="icon-button"
          type="button"
          aria-label={previousLabel}
          disabled={previousDisabled}
          onClick={onPrevious}
        >
          ←
        </button>
        <span className="period-count">{formatPeriod(period)}</span>
        <button
          className="icon-button"
          type="button"
          aria-label={nextLabel}
          disabled={nextDisabled}
          onClick={onNext}
        >
          →
        </button>
      </div>
    </div>
  );
}
