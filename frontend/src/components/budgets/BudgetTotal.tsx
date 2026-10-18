import type { ReactElement } from 'react';
import { formatPeriod, money } from '../../utils/format';
import type { BudgetMode } from '../budgetTypes';

export function BudgetTotal({
  mode,
  period,
  total,
}: {
  mode: BudgetMode;
  period: string;
  total: number;
}): ReactElement {
  return (
    <div className="budget-editor-total">
      <div>
        <span className="budget-editor-total-label">
          {mode === 'default'
            ? 'Total default budget'
            : `Total planned for ${formatPeriod(period)}`}
        </span>
        <small>
          {mode === 'default'
            ? 'Applied when no monthly override exists'
            : 'Effective total including defaults'}
        </small>
      </div>
      <strong>
        {money(total)} <span>/ month</span>
      </strong>
    </div>
  );
}
