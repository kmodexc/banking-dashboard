import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { OidcClient } from './auth';
import { getAppConfig } from './config';
import { AppTabs } from './components/AppTabs';
import { TabContent } from './components/TabContent';
import type { AppTab } from './components/appTabs';
import { AuthControls, FilePicker } from './components/AppChrome';
import type { AuthSnapshot } from './types';
import { useFinanceWorkspace } from './hooks/useFinanceWorkspace';
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
  const {
    transactions: rawTransactions,
    period,
    setPeriod,
    loadError,
    handleFile,
    clearTransactions,
  } = useTransactions();
  const workspace = useFinanceWorkspace(auth, rawTransactions);
  const {
    budgetPlan,
    budgetPreferences,
    budgetSyncStatus,
    categories,
    categoryEntries,
    changeCategory,
    deleteUserCategory,
    addUserCategory,
    renameUserCategory,
    updateUserCategories,
    userCategoryState,
    transactions,
    rules,
    userRules,
    localRuleCount,
    managedRules,
    ruleCategoryOptions,
    addRule,
    addRules,
    deleteUserRule,
    removePrivateServerRules,
    removeCommunityRules,
    replaceLocalRules,
    replaceRules,
    rulePreferences,
    ruleSyncStatus,
    serverCategoryCount,
    serverRuleCount,
    updateRulePreferences,
    updateUserRule,
    serverHasBudgets,
    deleteServerBudgets,
    updateBudgetPlan,
    updateBudgetPreferences,
  } = workspace;
  const [tab, setTab] = useState<AppTab>('dashboard');
  const [selectedCategories, setSelectedCategories] = useState<string[] | null>(null);
  const ruleSyncError = ruleSyncStatus.startsWith('Could not ');
  const activePeriod =
    period && transactions.some((row) => row.period === period)
      ? period
      : (transactions[0]?.period ?? '');

  function clearLocalTransactions(): void {
    clearTransactions();
    setSelectedCategories(null);
  }

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
    localRuleCount,
    onAddRule: addRule,
    onAddRules: addRules,
    managedRules,
    ruleCategoryOptions,
    onImportRules: replaceLocalRules,
    onUpdateRule: updateUserRule,
    onDeleteRule: deleteUserRule,
    onRemoveAllRules: () => replaceLocalRules([]),
    userCategoryState,
    categoryEntries,
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
