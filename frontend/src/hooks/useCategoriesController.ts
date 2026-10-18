import { useMemo } from 'react';
import type { CategoryEntry, UserCategoryState } from '../data/categories';
import type { CategoriesController } from '../components/categories/categoryTypes';

export function useCategoriesController({
  entries,
  state,
  onAdd,
  onRename,
  onDelete,
  onImport,
}: {
  entries: CategoryEntry[];
  state: UserCategoryState;
  onAdd: (name: string) => void;
  onRename: (entry: CategoryEntry, name: string) => void;
  onDelete: (entry: CategoryEntry) => void;
  onImport: (state: UserCategoryState) => void;
}): CategoriesController {
  return useMemo(
    () => ({
      entries,
      state,
      actions: {
        addCategory: onAdd,
        renameCategory: onRename,
        deleteCategory: onDelete,
        importCategories: onImport,
      },
    }),
    [entries, onAdd, onDelete, onImport, onRename, state],
  );
}
