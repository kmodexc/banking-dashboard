import type { ReactElement } from 'react';
import { PlanBoxPlotChart, type BoxPlotChartRow, type BoxPlotPoint } from './PlanBoxPlotChart';
import type { PlanViewProps } from './planViewTypes';

export function PlanBoxPlot({ rows }: PlanViewProps): ReactElement {
  const chartRows: BoxPlotChartRow[] = rows.map((row) => ({
    ...row,
    chartLabel: `${row.category} · ${row.percentage === null ? 'No budget' : `${row.percentage}%`}`,
  }));
  const currentPoints: BoxPlotPoint[] = chartRows.map((row) => ({
    category: row.chartLabel,
    value: row.spent,
  }));
  const averagePoints: BoxPlotPoint[] = chartRows.flatMap((row) =>
    row.history ? [{ category: row.chartLabel, value: row.history.average }] : [],
  );
  const budgetPoints: BoxPlotPoint[] = chartRows.flatMap((row) =>
    row.budget > 0 ? [{ category: row.chartLabel, value: row.budget }] : [],
  );
  const historicalMonths = chartRows[0]?.history?.months ?? 0;
  const chartHeight = Math.max(300, rows.length * 76);

  return (
    <div className="plan-box-plot" role="img" aria-label="Historical spending box plot">
      {rows.length ? (
        <>
          <PlanBoxPlotChart
            rows={chartRows}
            currentPoints={currentPoints}
            averagePoints={averagePoints}
            budgetPoints={budgetPoints}
            height={chartHeight}
          />
          <p className="plan-box-plot-note muted">
            {historicalMonths
              ? `The box shows the middle 50% of spending across ${historicalMonths} previous ${historicalMonths === 1 ? 'month' : 'months'}; whiskers show the full range.`
              : 'Import another month to show historical spending ranges and averages.'}
          </p>
        </>
      ) : (
        <p className="muted empty-copy">Add categories to start planning.</p>
      )}
    </div>
  );
}
