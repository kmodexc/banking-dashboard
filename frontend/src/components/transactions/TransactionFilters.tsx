import type { ReactElement } from 'react';
import { CategoryFilter } from './CategoryFilter';

export type TransactionTypeFilter = 'all' | 'income' | 'expenses';

export function TransactionFilters({
  typeFilter,
  onTypeFilterChange,
  categories,
  selectedCategories,
  onCategoryFilterChange,
  showAll = false,
}: {
  typeFilter: TransactionTypeFilter;
  onTypeFilterChange: (filter: TransactionTypeFilter) => void;
  categories: string[];
  selectedCategories: string[] | null;
  onCategoryFilterChange: (categories: string[] | null) => void;
  showAll?: boolean;
}): ReactElement {
  return (
    <div className="transaction-filters" aria-label="Filter transactions">
      <div className="transaction-type-filter" role="group" aria-label="Filter by transaction type">
        <span className="filter-heading-label">Transaction type</span>
        <button
          className={`filter-button${typeFilter === 'income' ? ' active' : ''}`}
          type="button"
          aria-pressed={typeFilter === 'income'}
          onClick={() => onTypeFilterChange('income')}
        >
          Income
        </button>
        <button
          className={`filter-button${typeFilter === 'expenses' ? ' active' : ''}`}
          type="button"
          aria-pressed={typeFilter === 'expenses'}
          onClick={() => onTypeFilterChange('expenses')}
        >
          Expenses
        </button>
        {showAll && (
          <button
            className={`filter-button${typeFilter === 'all' ? ' active' : ''}`}
            type="button"
            aria-pressed={typeFilter === 'all'}
            onClick={() => onTypeFilterChange('all')}
          >
            All
          </button>
        )}
      </div>
      <CategoryFilter
        categories={categories}
        selectedCategories={selectedCategories}
        onActivateExpenses={() => onTypeFilterChange('expenses')}
        onChange={onCategoryFilterChange}
      />
    </div>
  );
}
