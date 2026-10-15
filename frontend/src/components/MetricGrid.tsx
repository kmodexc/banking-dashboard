import type { ReactElement } from 'react';
import { money } from '../utils/format';

export function MetricGrid({
  metrics,
}: {
  metrics: readonly (readonly [label: string, value: number])[];
}): ReactElement {
  return (
    <div id="metrics" className="metric-grid">
      {metrics.map(([label, value]) => (
        <div className="metric" key={label}>
          <span className="metric-label">{label}</span>
          <span className="metric-value">{money(value)}</span>
        </div>
      ))}
    </div>
  );
}
