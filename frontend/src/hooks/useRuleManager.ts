import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { CategoryRuleSchema } from '../types';
import type { CategoryRule, ManagedRule } from '../types';
import { parseImportedRules, ruleKey, serializeRules } from '../data/rules';

export function useRuleManager({
  rules,
  rulesToExport,
  onImport,
  onUpdate,
  onDelete,
  onRemoveAll,
}: {
  rules: ManagedRule[];
  rulesToExport: CategoryRule[];
  onImport: (rules: CategoryRule[]) => void;
  onUpdate: (previous: CategoryRule, next: CategoryRule) => void;
  onDelete: (rule: CategoryRule) => void;
  onRemoveAll: () => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState('');
  const [message, setMessage] = useState('');
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const normalizedFilter = filter.trim().toLocaleLowerCase();
  const visibleRules = useMemo(
    () =>
      rules.filter((entry) => {
        if (!normalizedFilter) return true;
        return [entry.rule.keyword, entry.categoryLabel]
          .join(' ')
          .toLocaleLowerCase()
          .includes(normalizedFilter);
      }),
    [normalizedFilter, rules],
  );

  function saveEditing(previous: CategoryRule, nextRule: CategoryRule): string | null {
    const result = CategoryRuleSchema.safeParse({
      ...nextRule,
      keyword: nextRule.keyword.trim(),
      category: nextRule.category.trim(),
    });
    if (!result.success) {
      const message = 'Rules need a keyword, category, and valid search column.';
      setMessage(message);
      return message;
    }
    const nextKey = ruleKey(result.data);
    if (
      nextKey !== ruleKey(previous) &&
      rules.some((entry) => entry.source === 'user' && ruleKey(entry.rule) === nextKey)
    ) {
      const message =
        'A user rule with the same keyword, category, and search column already exists.';
      setMessage(message);
      return message;
    }
    onUpdate(previous, result.data);
    setMessage('');
    return null;
  }

  function deleteRule(rule: CategoryRule): void {
    onDelete(rule);
  }

  function exportRules(): void {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(
      new Blob([serializeRules(rulesToExport)], { type: 'application/json' }),
    );
    link.download = 'finance-dashboard-rules.json';
    link.click();
    URL.revokeObjectURL(link.href);
    setMessage('Rules exported.');
  }

  function openDeleteAllConfirmation(): void {
    setDeleteConfirmation('');
    setDeleteAllOpen(true);
  }

  function cancelDeleteAll(): void {
    setDeleteConfirmation('');
    setDeleteAllOpen(false);
  }

  function removeAllRules(): void {
    if (deleteConfirmation !== 'delete') return;
    onRemoveAll();
    cancelDeleteAll();
  }

  async function importRules(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    const imported = parseImportedRules(await file.text());
    if (!imported) {
      setMessage('The rules file is invalid.');
      return;
    }
    onImport(imported);
    setMessage('Rules imported.');
  }

  return {
    fileInput,
    filter,
    setFilter,
    visibleRules,
    message,
    deleteAllOpen,
    deleteConfirmation,
    setDeleteConfirmation,
    saveEditing,
    deleteRule,
    exportRules,
    openDeleteAllConfirmation,
    cancelDeleteAll,
    removeAllRules,
    importRules,
  };
}
