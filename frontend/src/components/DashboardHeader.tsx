import type { ReactElement } from 'react';
import { PeriodHeader } from './PeriodHeader';

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
    <PeriodHeader
      eyebrow="Dashboard"
      period={period}
      subtitle={`${displayedCount} of ${totalCount} ${transactionLabel} transactions shown`}
      navigationLabel="Navigate between months"
      previousLabel="Previous month"
      nextLabel="Next month"
      previousDisabled={periodIndex <= 0}
      nextDisabled={periodIndex < 0 || periodIndex >= periods.length - 1}
      onPrevious={() => onPeriodChange(periods[periodIndex - 1] ?? period)}
      onNext={() => onPeriodChange(periods[periodIndex + 1] ?? period)}
    />
  );
}
