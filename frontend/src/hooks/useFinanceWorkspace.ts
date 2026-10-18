import { useEffect, useMemo, useRef, useState } from 'react';
import { renameBudgetCategory } from '../data/budgets';
import {
  categoryEntries,
  categoryName,
  categoryStateWithAdded,
  loadUserCategoryState,
  mergeCategoryStates,
  saveUserCategoryState,
  type CategoryEntry,
  type UserCategoryState,
} from '../data/categories';
import {
  applyCategoryOverrides,
  applyRules,
  loadCategoryOverrides,
  ruleKey,
  saveCategoryOverrides,
} from '../data/rules';
import { useBudgetSync } from './useBudgetSync';
import { useRuleSync } from './useRuleSync';
import type { BudgetPlan } from '../data/budgets';
import type {
  AuthSnapshot,
  CategoryRule,
  ManagedRule,
  RuleCategoryOption,
  Transaction,
} from '../types';

export interface FinanceWorkspace {
  budgetPlan: BudgetPlan;
  budgetPreferences: ReturnType<typeof useBudgetSync>['budgetPreferences'];
  budgetSyncStatus: string;
  serverHasBudgets: boolean | null;
  serverBudgetSummary: ReturnType<typeof useBudgetSync>['serverBudgetSummary'];
  budgetLastSyncedAt: ReturnType<typeof useBudgetSync>['budgetLastSyncedAt'];
  budgetHasUnsyncedChanges: ReturnType<typeof useBudgetSync>['budgetHasUnsyncedChanges'];
  syncBudgetsNow: ReturnType<typeof useBudgetSync>['syncBudgetsNow'];
  deleteServerBudgets: () => Promise<void>;
  updateBudgetPlan: (next: BudgetPlan) => void;
  updateBudgetPreferences: ReturnType<typeof useBudgetSync>['updateBudgetPreferences'];
  categories: string[];
  categoryEntries: CategoryEntry[];
  changeCategory: (transactionId: string, category: string) => void;
  deleteUserCategory: (entry: CategoryEntry) => void;
  addUserCategory: (name: string) => void;
  renameUserCategory: (entry: CategoryEntry, name: string) => void;
  updateUserCategories: (next: UserCategoryState) => void;
  userCategoryState: UserCategoryState;
  transactions: Transaction[];
  rules: CategoryRule[];
  userRules: CategoryRule[];
  categorizedUserRules: CategoryRule[];
  localRuleCount: number;
  managedRules: ManagedRule[];
  ruleCategoryOptions: RuleCategoryOption[];
  activeRules: CategoryRule[];
  addRule: ReturnType<typeof useRuleSync>['addRule'];
  addRules: ReturnType<typeof useRuleSync>['addRules'];
  deleteUserRule: ReturnType<typeof useRuleSync>['deleteUserRule'];
  privateCategories: ReturnType<typeof useRuleSync>['privateCategories'];
  removePrivateServerRules: ReturnType<typeof useRuleSync>['removePrivateServerRules'];
  removeCommunityRules: ReturnType<typeof useRuleSync>['removeCommunityRules'];
  replaceLocalRules: ReturnType<typeof useRuleSync>['replaceLocalRules'];
  replaceRules: ReturnType<typeof useRuleSync>['replaceRules'];
  rulePreferences: ReturnType<typeof useRuleSync>['rulePreferences'];
  ruleSyncStatus: string;
  ruleLastSyncedAt: ReturnType<typeof useRuleSync>['ruleLastSyncedAt'];
  ruleHasUnsyncedChanges: ReturnType<typeof useRuleSync>['ruleHasUnsyncedChanges'];
  syncRulesNow: () => Promise<void>;
  serverCategoryCount: number | null;
  serverRuleCount: number | null;
  updateRulePreferences: ReturnType<typeof useRuleSync>['updateRulePreferences'];
  updateUserRule: ReturnType<typeof useRuleSync>['updateUserRule'];
}

export function useFinanceWorkspace(
  auth: AuthSnapshot,
  rawTransactions: Transaction[],
): FinanceWorkspace {
  const categoryUserId =
    auth.user?.sub ?? auth.user?.preferred_username ?? auth.user?.email ?? 'authenticated-user';
  const [categoryOverrides, setCategoryOverrides] = useState<Record<string, string>>(() =>
    loadCategoryOverrides(),
  );
  const [categoryStateStore, setCategoryStateStore] = useState<{
    userId: string | null;
    state: UserCategoryState;
  }>({ userId: null, state: loadUserCategoryState(null) });
  const previousCategoryUserId = useRef<string | null>(null);
  const ruleSync = useRuleSync(auth, categoryUserId);
  const budgetSync = useBudgetSync(auth, categoryUserId);
  const {
    activeRules,
    addRule,
    addRules,
    deleteUserRule,
    privateCategories,
    serverCategoryCount,
    serverRuleCount,
    localRules,
    removePrivateServerRules,
    removeCommunityRules,
    replaceLocalRules,
    replaceRules,
    rulePreferences,
    ruleSyncStatus,
    ruleLastSyncedAt,
    ruleHasUnsyncedChanges,
    syncRulesNow: syncRulesNowFromHook,
    updateRulePreferences,
    updateUserRule,
    userRules,
  } = ruleSync;
  const {
    budgetPlan,
    budgetPreferences,
    budgetSyncStatus,
    deleteServerBudgets,
    serverHasBudgets,
    serverBudgetSummary,
    budgetLastSyncedAt,
    budgetHasUnsyncedChanges,
    syncBudgetsNow,
    updateBudgetPlan,
    updateBudgetPreferences,
  } = budgetSync;

  useEffect(() => {
    const currentUserId = auth.token ? categoryUserId : null;
    if (currentUserId && previousCategoryUserId.current !== currentUserId) {
      const localState = loadUserCategoryState(null);
      const accountState = loadUserCategoryState(currentUserId);
      const merged = mergeCategoryStates(accountState, localState);
      saveUserCategoryState(merged, currentUserId);
      setCategoryStateStore({ userId: currentUserId, state: merged });
    }
    previousCategoryUserId.current = currentUserId;
  }, [auth.token, categoryUserId]);

  const userCategoryState =
    categoryStateStore.userId === (auth.token ? categoryUserId : null)
      ? categoryStateStore.state
      : loadUserCategoryState(auth.token ? categoryUserId : null);
  const rules = useMemo(
    () =>
      activeRules.map((rule) => ({
        ...rule,
        category: categoryName(userCategoryState, rule.category),
      })),
    [activeRules, userCategoryState],
  );
  const categorizedUserRules = useMemo(
    () =>
      userRules.map((rule) => ({
        ...rule,
        category: categoryName(userCategoryState, rule.category),
      })),
    [userCategoryState, userRules],
  );
  const transactions = useMemo(() => {
    const resolvedOverrides = Object.fromEntries(
      Object.entries(categoryOverrides).map(([id, category]) => [
        id,
        categoryName(userCategoryState, category),
      ]),
    );
    return applyCategoryOverrides(applyRules(rawTransactions, rules), resolvedOverrides);
  }, [categoryOverrides, rawTransactions, rules, userCategoryState]);
  const categoryEntriesForUser = useMemo(
    () =>
      categoryEntries(
        userCategoryState,
        rules.map((rule) => rule.category),
      ),
    [rules, userCategoryState],
  );
  const categories = useMemo(
    () =>
      [
        ...new Set([
          ...categoryEntriesForUser.map((entry) => entry.name),
          ...transactions
            .filter((transaction) => transaction.type === 'Ausgang')
            .map((transaction) => transaction.category),
        ]),
      ].sort(),
    [categoryEntriesForUser, transactions],
  );
  const managedRules = useMemo<ManagedRule[]>(() => {
    const seen = new Set<string>();
    const result: ManagedRule[] = [];
    userRules.forEach((rule) => {
      const key = ruleKey(rule);
      if (seen.has(key)) return;
      seen.add(key);
      result.push({
        rule,
        categoryLabel: categoryName(userCategoryState, rule.category),
        source: 'user',
      });
    });
    return result;
  }, [userCategoryState, userRules]);
  const ruleCategoryOptions = useMemo<RuleCategoryOption[]>(() => {
    const seen = new Set<string>();
    const result: RuleCategoryOption[] = [];
    categoryEntriesForUser.forEach((entry) => {
      const value = entry.name;
      const key = value.toLocaleLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      result.push({ value, label: entry.name });
    });
    userRules.forEach((rule) => {
      const key = rule.category.toLocaleLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      result.push({ value: rule.category, label: categoryName(userCategoryState, rule.category) });
    });
    return result;
  }, [categoryEntriesForUser, userCategoryState, userRules]);

  function changeCategory(transactionId: string, category: string): void {
    setCategoryOverrides((current) => {
      const next = { ...current, [transactionId]: category };
      saveCategoryOverrides(next);
      return next;
    });
  }

  function updateUserCategories(next: UserCategoryState): void {
    const storageUserId = auth.token ? categoryUserId : null;
    saveUserCategoryState(next, storageUserId);
    setCategoryStateStore({ userId: storageUserId, state: next });
    if (auth.token && rulePreferences.storePrivateRules) void replaceRules(userRules, next);
  }

  function addUserCategory(name: string): void {
    updateUserCategories(categoryStateWithAdded(userCategoryState, name));
  }

  function renameUserCategory(entry: CategoryEntry, name: string): void {
    const categories = userCategoryState.categories.map((category) =>
      category.id === entry.id
        ? { ...category, name, aliases: [...new Set([...category.aliases, category.name])] }
        : category,
    );
    updateUserCategories({ ...userCategoryState, categories });
    updateBudgetPlan(renameBudgetCategory(budgetPlan, entry.name, name));
  }

  function deleteUserCategory(entry: CategoryEntry): void {
    updateUserCategories({
      ...userCategoryState,
      categories: userCategoryState.categories.filter((category) => category.id !== entry.id),
      deletedIds: [...new Set([...userCategoryState.deletedIds, entry.id])],
    });
  }

  async function syncRulesNow(): Promise<void> {
    await syncRulesNowFromHook(userCategoryState);
  }

  useEffect(() => {
    if (!auth.token || privateCategories === undefined) return;
    if (privateCategories) {
      const merged = mergeCategoryStates(userCategoryState, privateCategories);
      if (JSON.stringify(merged) !== JSON.stringify(userCategoryState)) {
        saveUserCategoryState(merged, categoryUserId);
        // The server response is an external state source; adopt its ID-based merge locally.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCategoryStateStore({ userId: categoryUserId, state: merged });
        if (rulePreferences.storePrivateRules) void replaceRules(userRules, merged);
      }
    } else if (rulePreferences.storePrivateRules) {
      void replaceRules(userRules, userCategoryState);
    }
  }, [
    auth.token,
    categoryUserId,
    privateCategories,
    replaceRules,
    rulePreferences.storePrivateRules,
    userCategoryState,
    userRules,
  ]);

  return {
    budgetPlan,
    budgetPreferences,
    budgetSyncStatus,
    deleteServerBudgets,
    updateBudgetPlan,
    updateBudgetPreferences,
    categories,
    categoryEntries: categoryEntriesForUser,
    changeCategory,
    deleteUserCategory,
    addUserCategory,
    renameUserCategory,
    updateUserCategories,
    userCategoryState,
    transactions,
    rules,
    userRules,
    categorizedUserRules,
    localRuleCount: localRules.length,
    managedRules,
    ruleCategoryOptions,
    activeRules,
    addRule,
    addRules,
    deleteUserRule,
    privateCategories,
    removePrivateServerRules,
    removeCommunityRules,
    replaceLocalRules,
    replaceRules,
    rulePreferences,
    ruleSyncStatus,
    ruleLastSyncedAt,
    ruleHasUnsyncedChanges,
    syncRulesNow,
    serverCategoryCount,
    serverRuleCount,
    updateRulePreferences,
    updateUserRule,
    serverHasBudgets,
    serverBudgetSummary,
    budgetLastSyncedAt,
    budgetHasUnsyncedChanges,
    syncBudgetsNow,
  };
}
