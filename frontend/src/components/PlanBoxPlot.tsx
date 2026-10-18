import type { ReactElement } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ErrorBar,
  Legend,
  Rectangle,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
  type BarShapeProps,
} from 'recharts';
import { money } from '../utils/format';
import type { PlanBudgetRow, PlanViewProps } from './planViewTypes';

interface BoxPlotRow extends PlanBudgetRow {
  chartLabel: string;
}

interface Point {
  category: string;
  value: number;
}

function BoxShape(props: BarShapeProps): ReactElement {
  const row = props.payload as BoxPlotRow | undefined;
  const history = row?.history;
  if (!history) return <g />;

  const quartileRange = history.q3 - history.q1;
  const medianOffset =
    quartileRange === 0
      ? props.height / 2
      : ((history.q3 - history.median) / quartileRange) * props.height;

  return (
    <g>
      <Rectangle {...props} fill="#dbe7ff" stroke="#1769e0" strokeWidth={1.5} />
      <line
        x1={props.x}
        x2={props.x + props.width}
        y1={props.y + medianOffset}
        y2={props.y + medianOffset}
        stroke="#123f8a"
        strokeWidth={2}
      />
    </g>
  );
}

export function PlanBoxPlot({ rows }: PlanViewProps): ReactElement {
  const chartRows: BoxPlotRow[] = rows.map((row) => ({
    ...row,
    chartLabel: `${row.category} · ${row.percentage === null ? 'No budget' : `${row.percentage}%`}`,
  }));
  const currentPoints: Point[] = chartRows.map((row) => ({
    category: row.chartLabel,
    value: row.spent,
  }));
  const averagePoints: Point[] = chartRows.flatMap((row) =>
    row.history ? [{ category: row.chartLabel, value: row.history.average }] : [],
  );
  const budgetPoints: Point[] = chartRows.flatMap((row) =>
    row.budget > 0 ? [{ category: row.chartLabel, value: row.budget }] : [],
  );
  const historicalMonths = chartRows[0]?.history?.months ?? 0;
  const chartHeight = Math.max(300, rows.length * 76);

  const boxDataKey = (row: BoxPlotRow): [number, number] | null =>
    row.history ? [row.history.q1, row.history.q3] : null;
  const whiskerDataKey = (row: BoxPlotRow): [number, number] | null =>
    row.history ? [row.history.q3 - row.history.min, row.history.max - row.history.q3] : null;

  return (
    <div className="plan-box-plot" role="img" aria-label="Historical spending box plot">
      {rows.length ? (
        <>
          <div className="plan-box-plot-canvas" style={{ height: `${chartHeight}px` }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartRows}
                margin={{ top: 24, right: 28, bottom: 36, left: 8 }}
                barCategoryGap="38%"
              >
                <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="chartLabel"
                  interval={0}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'var(--ink)', fontSize: 11 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value: number) => money(value)}
                  tick={{ fill: 'var(--muted)', fontSize: 11 }}
                />
                <Tooltip
                  labelFormatter={(label) =>
                    typeof label === 'string' ? label : 'Category spending history'
                  }
                  formatter={(value, name) => {
                    if (Array.isArray(value)) {
                      return [`${money(Number(value[0]))}–${money(Number(value[1]))}`, name];
                    }
                    return [money(Number(value)), name];
                  }}
                />
                <Legend verticalAlign="top" align="right" height={28} />
                <Bar
                  dataKey={boxDataKey}
                  name="Previous-month range"
                  shape={BoxShape}
                  fill="#dbe7ff"
                  fillOpacity={1}
                  isAnimationActive={false}
                >
                  <ErrorBar dataKey={whiskerDataKey} width={8} stroke="#1769e0" strokeWidth={1.5} />
                </Bar>
                <Scatter name="This month" data={currentPoints} dataKey="value" fill="#1769e0" />
                <Scatter
                  name="Historical average"
                  data={averagePoints}
                  dataKey="value"
                  fill="#2a9d8f"
                  shape="square"
                />
                <Scatter
                  name="Planned"
                  data={budgetPoints}
                  dataKey="value"
                  fill="#7d8792"
                  shape="diamond"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
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
