import type { ReactElement } from 'react';
import { formatPeriod } from '../../utils/format';
import type { BudgetMode } from '../budgetTypes';

export function BudgetScopeSwitch({
  mode,
  period,
  hasMonthlyBudgets,
  onModeChange,
  onResetMonthly,
}: {
  mode: BudgetMode;
  period: string;
  hasMonthlyBudgets: boolean;
  onModeChange: (next: BudgetMode) => void;
  onResetMonthly: () => void;
}): ReactElement {
  return (
    <div className="budget-editor-controls">
      <div className="budget-scope-switch" role="tablist" aria-label="Budget mode">
        <button
          className={`budget-scope-button${mode === 'default' ? ' active' : ''}`}
          type="button"
          role="tab"
          aria-selected={mode === 'default'}
          onClick={() => onModeChange('default')}
        >
          <strong>Default budgets</strong>
          <small>Every month</small>
        </button>
        <button
          className={`budget-scope-button${mode === 'monthly' ? ' active' : ''}`}
          type="button"
          role="tab"
          aria-selected={mode === 'monthly'}
          onClick={() => onModeChange('monthly')}
        >
          <strong>This month</strong>
          <small>{formatPeriod(period)}</small>
        </button>
      </div>
      {mode === 'monthly' && (
        <button
          className="button secondary danger-button budget-reset-button"
          type="button"
          disabled={!hasMonthlyBudgets}
          onClick={onResetMonthly}
        >
          <span aria-hidden="true">↺</span> Reset month-specific budgets
        </button>
      )}
    </div>
  );
}
