import type { CategoryEntry, UserCategoryState } from '../../data/categories';

export interface CategoryActions {
  addCategory: (name: string) => void;
  renameCategory: (entry: CategoryEntry, name: string) => void;
  deleteCategory: (entry: CategoryEntry) => void;
  importCategories: (state: UserCategoryState) => void;
}

export interface CategoriesController {
  entries: CategoryEntry[];
  state: UserCategoryState;
  actions: CategoryActions;
}
