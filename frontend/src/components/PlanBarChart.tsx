import type { ReactElement } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { money } from '../utils/format';
import type { PlanViewProps } from './planViewTypes';

export function PlanBarChart({ rows }: PlanViewProps): ReactElement {
  const chartRows = rows.map((row) => ({
    ...row,
    chartLabel: `${row.category} · ${row.percentage === null ? 'No budget' : `${row.percentage}%`}`,
  }));
  const chartHeight = Math.max(280, rows.length * 64);

  return (
    <div className="plan-bar-chart" role="img" aria-label="Budget spending bar chart">
      {rows.length ? (
        <div className="plan-chart-canvas" style={{ height: `${chartHeight}px` }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartRows}
              layout="vertical"
              margin={{ top: 8, right: 42, bottom: 8, left: 8 }}
              barCategoryGap="24%"
              role="img"
            >
              <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" horizontal={false} />
              <XAxis
                type="number"
                axisLine={false}
                tickLine={false}
                tickFormatter={(value: number) => money(value)}
                tick={{ fill: 'var(--muted)', fontSize: 11 }}
              />
              <YAxis
                type="category"
                dataKey="chartLabel"
                width={150}
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--ink)', fontSize: 12 }}
              />
              <Tooltip
                cursor={{ fill: 'rgba(23, 105, 224, 0.06)' }}
                formatter={(value, name) => [money(Number(value)), name]}
                labelFormatter={(label) =>
                  typeof label === 'string' ? label : 'Category spending'
                }
              />
              <Legend verticalAlign="top" align="right" height={32} />
              <Bar dataKey="budget" name="Planned" fill="#aeb9c5" radius={[0, 4, 4, 0]}>
                <LabelList
                  dataKey="budget"
                  position="right"
                  formatter={(value) => money(Number(value))}
                  fill="var(--muted)"
                  fontSize={11}
                />
              </Bar>
              <Bar dataKey="spent" name="Spent" radius={[0, 4, 4, 0]}>
                {chartRows.map((row) => (
                  <Cell
                    key={`${row.category}-spent`}
                    fill={row.percentage !== null && row.percentage > 100 ? '#b42318' : '#1769e0'}
                  />
                ))}
                <LabelList
                  dataKey="spent"
                  position="right"
                  formatter={(value) => money(Number(value))}
                  fill="var(--ink)"
                  fontSize={11}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="muted empty-copy">Add categories to start planning.</p>
      )}
    </div>
  );
}
