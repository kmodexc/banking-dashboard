import type { ReactElement } from 'react';
import type { Transaction } from '../../types';
import { money } from '../../utils/format';

export function Overview({ transactions }: { transactions: Transaction[] }): ReactElement {
  const monthly = Object.values(
    transactions.reduce<
      Record<string, { period: string; income: number; expenses: number; count: number }>
    >((result, row) => {
      const entry = (result[row.period] ??= {
        period: row.period,
        income: 0,
        expenses: 0,
        count: 0,
      });
      entry.count += 1;
      if (row.type === 'Eingang') entry.income += row.amount;
      else entry.expenses += Math.abs(row.amount);
      return result;
    }, {}),
  ).sort((left, right) => right.period.localeCompare(left.period));

  return (
    <section id="overview-tab" className="tab-panel">
      <article className="panel">
        <div className="panel-heading">
          <h2>Monthly overview</h2>
          <span className="muted">All loaded transactions</span>
        </div>
        <div className="table-wrap">
          <table id="overview-table">
            <thead>
              <tr>
                <th>Period</th>
                <th>Income</th>
                <th>Expenses</th>
                <th>Net</th>
                <th>Transactions</th>
              </tr>
            </thead>
            <tbody>
              {monthly.map((row) => (
                <tr key={row.period}>
                  <td>{row.period}</td>
                  <td>{money(row.income)}</td>
                  <td>{money(row.expenses)}</td>
                  <td>{money(row.income - row.expenses)}</td>
                  <td>{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
