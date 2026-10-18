import type { ReactElement } from 'react';

export function CategoryFilter({
  categories,
  selectedCategories,
  onActivateExpenses,
  onChange,
}: {
  categories: string[];
  selectedCategories: string[] | null;
  onActivateExpenses?: () => void;
  onChange: (categories: string[] | null) => void;
}): ReactElement {
  const activeCategories = selectedCategories ?? categories;

  function toggleCategory(category: string): void {
    const selected = selectedCategories ?? categories;
    onActivateExpenses?.();
    onChange(
      selected.includes(category)
        ? selected.filter((value) => value !== category)
        : [...selected, category],
    );
  }

  function toggleAllCategories(): void {
    onActivateExpenses?.();
    onChange((selectedCategories ?? categories).length === categories.length ? [] : null);
  }

  return (
    <div
      className="category-filter global-category-filter"
      aria-label="Filter expenses by category"
    >
      <div className="filter-heading">
        <span>Filter expenses by category</span>
        <button className="text-button" type="button" onClick={toggleAllCategories}>
          {(selectedCategories ?? categories).length === categories.length
            ? 'Clear all'
            : 'Select all'}
        </button>
      </div>
      <div className="category-options">
        {categories.map((category) => (
          <label className="category-option" key={category}>
            <input
              type="checkbox"
              checked={activeCategories.includes(category)}
              onChange={() => toggleCategory(category)}
            />
            <span>{category}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
