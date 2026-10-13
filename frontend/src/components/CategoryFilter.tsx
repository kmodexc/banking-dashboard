import type { ReactElement } from 'react';

export function CategoryFilter({
  categories,
  selectedCategories,
  onChange,
}: {
  categories: string[];
  selectedCategories: string[] | null;
  onChange: (categories: string[] | null) => void;
}): ReactElement {
  const activeCategories = selectedCategories ?? categories;

  function toggleCategory(category: string): void {
    const selected = selectedCategories ?? categories;
    onChange(
      selected.includes(category)
        ? selected.filter((value) => value !== category)
        : [...selected, category],
    );
  }

  return (
    <div
      className="category-filter global-category-filter"
      aria-label="Filter dashboard by category"
    >
      <div className="filter-heading">
        <span>Filter dashboard by category</span>
        <button
          className="text-button"
          type="button"
          onClick={() =>
            onChange((selectedCategories ?? categories).length === categories.length ? [] : null)
          }
        >
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
