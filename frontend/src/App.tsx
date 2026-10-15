import { useEffect, useMemo, useState, type ChangeEvent, type ReactElement } from 'react';
import { OidcClient } from './auth';
import { getAppConfig } from './config';
import { readTransactions } from './data/csv';
import { loadSessionTransactions, saveSessionTransactions } from './data/session';
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
  saveUserCategoryState,
  type CategoryEntry,
  type UserCategoryState,
} from './data/categories';
import { CategorizeUnknown } from './components/CategorizeUnknown';
import { AllTransactions } from './components/AllTransactions';
import { AppTabs } from './components/AppTabs';
import type { AppTab } from './components/appTabs';
import { AuthControls, FilePicker } from './components/AppChrome';
import { Categories } from './components/Categories';
import { Dashboard } from './components/Dashboard';
import { RuleManager } from './components/RuleManager';
import type { ManagedRule, RuleCategoryOption } from './components/RuleManager';
import type { AuthSnapshot, CategoryRule, Transaction } from './types';
import { useRuleSync } from './hooks/useRuleSync';
import './styles.css';

const config = getAppConfig();

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected error';
}

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
  const userCategoryState =
    categoryStateStore.userId === (auth.token ? categoryUserId : null)
      ? categoryStateStore.state
      : loadUserCategoryState(auth.token ? categoryUserId : null);
  const ruleSync = useRuleSync(auth, categoryUserId);
  const {
    activeRules,
    addRule,
    addRules,
    communityRules,
    defaultRules,
    deleteUserRule,
    localRules,
    removeCommunityRules,
    removePrivateServerRules,
    replaceLocalRules,
    replaceRules,
    rulePreferences,
    ruleSyncStatus,
    updateRulePreferences,
    updateUserRule,
    userRules,
  } = ruleSync;
  const [rawTransactions, setRawTransactions] = useState<Transaction[]>(() =>
    loadSessionTransactions(),
  );
  const [period, setPeriod] = useState('');
  const [tab, setTab] = useState<AppTab>('dashboard');
  const [loadError, setLoadError] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[] | null>(null);
  const ruleSyncError = ruleSyncStatus.startsWith('Could not ');
  useEffect(() => {
    saveSessionTransactions(rawTransactions);
  }, [rawTransactions]);
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
    add('community', communityRules);
    add('global', defaultRules);
    return result;
  }, [communityRules, defaultRules, userCategoryState, userRules]);
  const ruleCategoryOptions = useMemo<RuleCategoryOption[]>(() => {
    const seen = new Set<string>();
    const result: RuleCategoryOption[] = [];
    categoryEntriesForUser.forEach((entry) => {
      const value = entry.globalName ?? entry.name;
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

  async function handleFile(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    try {
      const next = await readTransactions(file);
      setRawTransactions(next);
      setPeriod(next[0]?.period ?? '');
      setLoadError('');
    } catch (error: unknown) {
      setLoadError(errorMessage(error));
    }
  }

  function changeCategory(transactionId: string, category: string): void {
    setCategoryOverrides((current) => {
      const next = { ...current, [transactionId]: category };
      saveCategoryOverrides(next);
      return next;
    });
  }

  function updateUserCategories(next: UserCategoryState): void {
    if (!auth.token) return;
    saveUserCategoryState(next, categoryUserId);
    setCategoryStateStore({ userId: categoryUserId, state: next });
  }

  function addUserCategory(name: string): void {
    updateUserCategories(categoryStateWithAdded(userCategoryState, name));
  }

  function renameUserCategory(entry: CategoryEntry, name: string): void {
    if (!auth.token) return;
    if (entry.globalName) {
      const renamed = { ...userCategoryState.renamed };
      if (name === entry.globalName) delete renamed[entry.globalName];
      else renamed[entry.globalName] = name;
      updateUserCategories({ ...userCategoryState, renamed });
      return;
    }
    const added = userCategoryState.added.map((value) => (value === entry.name ? name : value));
    const deleted = userCategoryState.deleted.filter((value) => value !== entry.name);
    updateUserCategories({
      ...userCategoryState,
      renamed: { ...userCategoryState.renamed, [entry.name]: name },
      added,
      deleted,
    });
  }

  function deleteUserCategory(entry: CategoryEntry): void {
    if (!auth.token) return;
    if (entry.globalName) {
      const renamed = { ...userCategoryState.renamed };
      delete renamed[entry.globalName];
      updateUserCategories({
        ...userCategoryState,
        renamed,
        deleted: [...new Set([...userCategoryState.deleted, entry.globalName])],
      });
      return;
    }
    updateUserCategories({
      ...userCategoryState,
      added: userCategoryState.added.filter((value) => value !== entry.name),
      deleted: [...new Set([...userCategoryState.deleted, entry.name])],
    });
  }

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
          <section id="welcome-panel" className="panel empty-state">
            <h2>Load a supported bank export to begin</h2>
            <p>
              Your transaction file stays in this browser. The classification service only receives
              transactions when you explicitly ask it to suggest categories.
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
            {tab === 'dashboard' && (
              <Dashboard
                transactions={transactions}
                period={activePeriod}
                onPeriodChange={setPeriod}
                categories={categories}
                selectedCategories={selectedCategories}
                onCategoryFilterChange={setSelectedCategories}
                onCategoryChange={changeCategory}
              />
            )}
            {tab === 'unknown' && (
              <CategorizeUnknown
                transactions={transactions}
                rules={rules}
                auth={auth}
                client={client}
                onAddRule={addRule}
                onAddRules={addRules}
                userRules={userRules.map((rule) => ({
                  ...rule,
                  category: categoryName(userCategoryState, rule.category),
                }))}
              />
            )}
            {tab === 'categories' && (
              <>
                <Categories
                  auth={auth}
                  entries={categoryEntriesForUser}
                  state={userCategoryState}
                  onAdd={addUserCategory}
                  onRename={renameUserCategory}
                  onDelete={deleteUserCategory}
                  onImport={updateUserCategories}
                  rulePreferences={rulePreferences}
                  onRulePreferencesChange={updateRulePreferences}
                  onSyncRules={() => void replaceRules(localRules)}
                  onDeleteServerRules={() => void removePrivateServerRules()}
                  onDeleteCommunityRules={() => void removeCommunityRules()}
                  ruleSyncStatus={ruleSyncStatus}
                />
                <RuleManager
                  rules={managedRules}
                  categories={ruleCategoryOptions}
                  rulesToExport={userRules}
                  onImport={replaceLocalRules}
                  onUpdate={updateUserRule}
                  onDelete={deleteUserRule}
                />
              </>
            )}
            {tab === 'all' && (
              <AllTransactions
                transactions={transactions}
                categories={categories}
                onCategoryChange={changeCategory}
              />
            )}
          </section>
        )}
      </main>
    </>
  );
}
