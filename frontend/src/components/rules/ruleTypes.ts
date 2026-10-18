import type { CategoryRule, ManagedRule, RuleCategoryOption } from '../../types';

export interface RuleActions {
  importRules: (rules: CategoryRule[]) => void;
  updateRule: (previous: CategoryRule, next: CategoryRule) => void;
  deleteRule: (rule: CategoryRule) => void;
  removeAllRules: () => void;
}

export interface RulesController {
  rules: ManagedRule[];
  categories: RuleCategoryOption[];
  editableRules: CategoryRule[];
  actions: RuleActions;
}
