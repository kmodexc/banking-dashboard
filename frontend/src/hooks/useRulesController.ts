import { useMemo } from 'react';
import type { CategoryRule, ManagedRule, RuleCategoryOption } from '../types';
import type { RulesController } from '../components/rules/ruleTypes';

export function useRulesController({
  rules,
  categories,
  editableRules,
  onImport,
  onUpdate,
  onDelete,
  onRemoveAll,
}: {
  rules: ManagedRule[];
  categories: RuleCategoryOption[];
  editableRules: CategoryRule[];
  onImport: (rules: CategoryRule[]) => void;
  onUpdate: (previous: CategoryRule, next: CategoryRule) => void;
  onDelete: (rule: CategoryRule) => void;
  onRemoveAll: () => void;
}): RulesController {
  return useMemo(
    () => ({
      rules,
      categories,
      editableRules,
      actions: {
        importRules: onImport,
        updateRule: onUpdate,
        deleteRule: onDelete,
        removeAllRules: onRemoveAll,
      },
    }),
    [categories, editableRules, onDelete, onImport, onRemoveAll, onUpdate, rules],
  );
}
