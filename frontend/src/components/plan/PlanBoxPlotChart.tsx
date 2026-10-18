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
import { money } from '../../utils/format';
import type { PlanBudgetRow } from './planViewTypes';

export interface BoxPlotChartRow extends PlanBudgetRow {
  chartLabel: string;
}

export interface BoxPlotPoint {
  category: string;
  value: number;
}

function BoxShape(props: BarShapeProps): ReactElement {
  const row = props.payload as BoxPlotChartRow | undefined;
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

export function PlanBoxPlotChart({
  rows,
  currentPoints,
  averagePoints,
  budgetPoints,
  height,
}: {
  rows: BoxPlotChartRow[];
  currentPoints: BoxPlotPoint[];
  averagePoints: BoxPlotPoint[];
  budgetPoints: BoxPlotPoint[];
  height: number;
}): ReactElement {
  const boxDataKey = (row: BoxPlotChartRow): [number, number] | null =>
    row.history ? [row.history.q1, row.history.q3] : null;
  const whiskerDataKey = (row: BoxPlotChartRow): [number, number] | null =>
    row.history ? [row.history.q3 - row.history.min, row.history.max - row.history.q3] : null;

  return (
    <div className="plan-box-plot-canvas" style={{ height: `${height}px` }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={rows}
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
  );
}
