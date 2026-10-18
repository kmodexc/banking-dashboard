import type { ReactElement } from 'react';
import { money } from '../../../utils/format';
import type { BudgetMode } from '../budgetTypes';

function hasValue(map: Record<string, number>, category: string): boolean {
  return Object.prototype.hasOwnProperty.call(map, category);
}

export function BudgetCategoryGrid({
  categories,
  mode,
  monthlyBudgets,
  defaultBudgets,
  editorBudgets,
  onChange,
}: {
  categories: string[];
  mode: BudgetMode;
  monthlyBudgets: Record<string, number>;
  defaultBudgets: Record<string, number>;
  editorBudgets: Record<string, number>;
  onChange: (category: string, value: string) => void;
}): ReactElement {
  return (
    <div className="budget-editor-grid">
      {categories.map((category) => {
        const hasMonthlyBudget = hasValue(monthlyBudgets, category);
        const defaultBudget = defaultBudgets[category] ?? 0;
        return (
          <label className="budget-editor-row" key={category}>
            <span>{category}</span>
            <span className="budget-input-wrap">
              <span className="currency-prefix">€</span>
              <input
                aria-label={`${category} ${mode === 'default' ? 'default' : 'monthly'} budget`}
                type="number"
                min="0"
                step="0.01"
                placeholder={
                  mode === 'monthly' && !hasMonthlyBudget ? String(defaultBudget) : '0.00'
                }
                value={editorBudgets[category] ?? ''}
                onChange={(event) => onChange(category, event.currentTarget.value)}
              />
              <span className="budget-suffix">/ month</span>
            </span>
            {mode === 'monthly' && !hasMonthlyBudget && (
              <small className="budget-fallback">Using default: {money(defaultBudget)}</small>
            )}
          </label>
        );
      })}
    </div>
  );
}
