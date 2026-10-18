import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { OidcClient } from './auth';
import { getAppConfig } from './config';
import { renameBudgetCategory } from './data/budgets';
import {
  applyCategoryOverrides,
  applyRules,
  loadCategoryOverrides,
  ruleKey,
  saveCategoryOverrides,
} from './data/rules';
import {
  categoryEntries,
  categoryName,
  categoryStateWithAdded,
  loadUserCategoryState,
  mergeCategoryStates,
  saveUserCategoryState,
  type CategoryEntry,
  type UserCategoryState,
} from './data/categories';
import { AppTabs } from './components/AppTabs';
import { TabContent } from './components/TabContent';
import type { AppTab } from './components/appTabs';
import { AuthControls, FilePicker } from './components/AppChrome';
import type { ManagedRule, RuleCategoryOption } from './components/RuleManager';
import type { AuthSnapshot, CategoryRule } from './types';
import { useRuleSync } from './hooks/useRuleSync';
import { useBudgetSync } from './hooks/useBudgetSync';
import { useTransactions } from './hooks/useTransactions';
import './styles.css';

const config = getAppConfig();

function useAuth(client: OidcClient): AuthSnapshot {
  const [snapshot, setSnapshot] = useState<AuthSnapshot>(client.snapshot);
  useEffect(() => {
    let active = true;
    void client.initialize().then((next) => {
      if (active) setSnapshot(next);
    });
    return () => {
      active = false;
    };
  }, [client]);
  return snapshot;
}

export function App(): ReactElement {
  const client = useMemo(() => new OidcClient(config), []);
  const auth = useAuth(client);
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
  useEffect(() => {
    const currentUserId = auth.token ? categoryUserId : null;
    if (currentUserId && previousCategoryUserId.current !== currentUserId) {
      const localState = loadUserCategoryState(null);
      const accountState = loadUserCategoryState(currentUserId);
      const merged = mergeCategoryStates(accountState, localState);
      saveUserCategoryState(merged, currentUserId);
      // Keep categories created before login when switching to account-scoped storage.
      setCategoryStateStore({ userId: currentUserId, state: merged });
    }
    previousCategoryUserId.current = currentUserId;
  }, [auth.token, categoryUserId]);
  const userCategoryState =
    categoryStateStore.userId === (auth.token ? categoryUserId : null)
      ? categoryStateStore.state
      : loadUserCategoryState(auth.token ? categoryUserId : null);
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
    updateBudgetPlan,
    updateBudgetPreferences,
  } = budgetSync;
  const {
    transactions: rawTransactions,
    period,
    setPeriod,
    loadError,
    handleFile,
    clearTransactions,
  } = useTransactions();
  const [tab, setTab] = useState<AppTab>('dashboard');
  const [selectedCategories, setSelectedCategories] = useState<string[] | null>(null);
  const ruleSyncError = ruleSyncStatus.startsWith('Could not ');
  const rules = useMemo(
    () =>
      activeRules.map((rule) => ({
        ...rule,
        category: categoryName(userCategoryState, rule.category),
      })),
    [activeRules, userCategoryState],
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
    const add = (source: ManagedRule['source'], sourceRules: CategoryRule[]) => {
      sourceRules.forEach((rule) => {
        const key = ruleKey(rule);
        if (seen.has(key)) return;
        seen.add(key);
        result.push({
          rule,
          categoryLabel: categoryName(userCategoryState, rule.category),
          source,
        });
      });
    };
    add('user', userRules);
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
  const activePeriod =
    period && transactions.some((row) => row.period === period)
      ? period
      : (transactions[0]?.period ?? '');

  function clearLocalTransactions(): void {
    clearTransactions();
    setSelectedCategories(null);
  }

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
    updateUserCategories({
      ...userCategoryState,
      categories,
    });
    updateBudgetPlan(renameBudgetCategory(budgetPlan, entry.name, name));
  }

  function deleteUserCategory(entry: CategoryEntry): void {
    updateUserCategories({
      ...userCategoryState,
      categories: userCategoryState.categories.filter((category) => category.id !== entry.id),
      deletedIds: [...new Set([...userCategoryState.deletedIds, entry.id])],
    });
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

  const tabContentProps = {
    tab,
    transactions,
    period: activePeriod,
    onPeriodChange: setPeriod,
    categories,
    selectedCategories,
    onCategoryFilterChange: setSelectedCategories,
    onCategoryChange: changeCategory,
    auth,
    client,
    rules,
    userRules,
    localRuleCount: localRules.length,
    onAddRule: addRule,
    onAddRules: addRules,
    managedRules,
    ruleCategoryOptions,
    onImportRules: replaceLocalRules,
    onUpdateRule: updateUserRule,
    onDeleteRule: deleteUserRule,
    onRemoveAllRules: () => replaceLocalRules([]),
    userCategoryState,
    categoryEntries: categoryEntriesForUser,
    onAddCategory: addUserCategory,
    onRenameCategory: renameUserCategory,
    onDeleteCategory: deleteUserCategory,
    onImportCategories: updateUserCategories,
    onRulePreferencesChange: updateRulePreferences,
    onSyncRules: () => void replaceRules(userRules, userCategoryState),
    onDeleteServerRules: () => void removePrivateServerRules(),
    rulePreferences,
    ruleSyncStatus,
    budgets: budgetPlan,
    budgetPreferences,
    budgetSyncStatus,
    serverHasBudgets,
    onBudgetsChange: updateBudgetPlan,
    onBudgetPreferencesChange: updateBudgetPreferences,
    onDeleteServerBudgets: () => void deleteServerBudgets(),
    serverRuleCount,
    serverCategoryCount,
    onDeleteCommunityRules: () => void removeCommunityRules(),
    onClearTransactions: clearLocalTransactions,
  };

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">Personal finance</p>
          <h1>Personal finance dashboard</h1>
        </div>
        <AuthControls
          auth={auth}
          onLogin={() => void client.login()}
          onLogout={() => void client.logout()}
        />
      </header>
      <main className="page-shell">
        {auth.setupError && (
          <section id="setup-panel" className="panel notice">
            {auth.setupError}
          </section>
        )}
        {loadError && (
          <section
            className="panel notice"
            role="alert"
            style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
          >
            {loadError}
          </section>
        )}
        {ruleSyncError && (
          <section id="rule-sync-error" className="panel notice" role="alert" aria-live="assertive">
            <strong>Rule synchronization warning:</strong> {ruleSyncStatus} Your local rules are
            still available. Open Categories and use “Sync selected rules now” to retry.
          </section>
        )}
        {!transactions.length ? (
          <>
            <AppTabs activeTab={tab} onChange={setTab} />
            {tab === 'account' ? (
              <TabContent {...tabContentProps} />
            ) : (
              <section id="welcome-panel" className="panel empty-state">
                <h2>Load a supported bank export to begin</h2>
                <p>
                  Your transaction file stays in this browser. The classification service only
                  receives transactions when you explicitly ask it to suggest categories.
                </p>
                <FilePicker
                  id="csv-input"
                  label="Choose CSV export"
                  onChange={(event) => void handleFile(event)}
                />
                <p className="muted small">
                  Supported formats: DKB and Deutsche Bank credit-card CSV exports.
                </p>
              </section>
            )}
          </>
        ) : (
          <section id="app-panel">
            <div className="toolbar panel">
              <FilePicker
                id="csv-input-secondary"
                label="Replace CSV"
                onChange={(event) => void handleFile(event)}
              />
              <span id="data-status" className="muted">
                {transactions.length} transactions loaded
              </span>
            </div>
            <AppTabs activeTab={tab} onChange={setTab} />
            <TabContent {...tabContentProps} />
          </section>
        )}
      </main>
    </>
  );
}
