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
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<CategoryRule | null>(null);
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

  function startEditing(entry: ManagedRule): void {
    setEditingKey(ruleKey(entry.rule));
    setDraft({ ...entry.rule });
    setMessage('');
  }

  function cancelEditing(): void {
    setEditingKey(null);
    setDraft(null);
    setMessage('');
  }

  function saveEditing(previous: CategoryRule): void {
    if (!draft) return;
    const result = CategoryRuleSchema.safeParse({
      ...draft,
      keyword: draft.keyword.trim(),
      category: draft.category.trim(),
    });
    if (!result.success) {
      setMessage('Rules need a keyword, category, and valid search column.');
      return;
    }
    const nextKey = ruleKey(result.data);
    if (
      nextKey !== ruleKey(previous) &&
      rules.some((entry) => entry.source === 'user' && ruleKey(entry.rule) === nextKey)
    ) {
      setMessage('A user rule with the same keyword, category, and search column already exists.');
      return;
    }
    onUpdate(previous, result.data);
    cancelEditing();
  }

  function deleteRule(rule: CategoryRule): void {
    onDelete(rule);
    if (editingKey === ruleKey(rule)) cancelEditing();
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
    editingKey,
    draft,
    setDraft,
    message,
    deleteAllOpen,
    deleteConfirmation,
    setDeleteConfirmation,
    startEditing,
    cancelEditing,
    saveEditing,
    deleteRule,
    exportRules,
    openDeleteAllConfirmation,
    cancelDeleteAll,
    removeAllRules,
    importRules,
  };
}
