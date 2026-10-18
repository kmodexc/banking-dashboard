import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { OidcClient } from './auth';
import { getAppConfig } from './config';
import { AppTabs } from './components/app/AppTabs';
import { TabContent, type TabContentProps } from './components/app/TabContent';
import type { AppTab } from './components/app/appTabs';
import { AuthControls, FilePicker } from './components/app/AppChrome';
import type { AuthSnapshot } from './types';
import { useFinanceWorkspace } from './hooks/useFinanceWorkspace';
import { useCategoriesController } from './hooks/useCategoriesController';
import { useRulesController } from './hooks/useRulesController';
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
    changeCategory,
    userCategoryState,
    transactions,
    rules,
    localRuleCount,
    addRule,
    addRules,
    removePrivateServerRules,
    removeCommunityRules,
    rulePreferences,
    ruleSyncStatus,
    ruleLastSyncedAt,
    ruleHasUnsyncedChanges,
    syncRulesNow,
    serverCategoryCount,
    serverRuleCount,
    updateRulePreferences,
    serverHasBudgets,
    serverBudgetSummary,
    budgetLastSyncedAt,
    budgetHasUnsyncedChanges,
    syncBudgetsNow,
    deleteServerBudgets,
    updateBudgetPlan,
    updateBudgetPreferences,
  } = workspace;
  const rulesController = useRulesController({
    rules: workspace.managedRules,
    categories: workspace.ruleCategoryOptions,
    editableRules: workspace.userRules,
    onImport: workspace.replaceLocalRules,
    onUpdate: workspace.updateUserRule,
    onDelete: workspace.deleteUserRule,
    onRemoveAll: () => workspace.replaceLocalRules([]),
  });
  const categoriesController = useCategoriesController({
    entries: workspace.categoryEntries,
    state: workspace.userCategoryState,
    onAdd: workspace.addUserCategory,
    onRename: workspace.renameUserCategory,
    onDelete: workspace.deleteUserCategory,
    onImport: workspace.updateUserCategories,
  });
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

  const tabContentProps: TabContentProps = {
    tab,
    dashboard: {
      transactions,
      period: activePeriod,
      onPeriodChange: setPeriod,
      categories,
      selectedCategories,
      onCategoryFilterChange: setSelectedCategories,
      onCategoryChange: changeCategory,
    },
    plan: {
      transactions,
      categories,
      initialPeriod: activePeriod,
      budgets: budgetPlan,
      onBudgetsChange: updateBudgetPlan,
    },
    unknown: {
      transactions,
      rules,
      auth,
      client,
      onAddRule: addRule,
      onAddRules: addRules,
      categories,
      rulesController,
    },
    categories: {
      categoriesController,
      rulesController,
    },
    allTransactions: {
      transactions,
      categories,
      onCategoryChange: changeCategory,
    },
    account: {
      auth,
      transactionCount: transactions.length,
      budgets: budgetPlan,
      budgetPreferences,
      budgetSyncStatus,
      serverHasBudgets,
      serverBudgetSummary,
      budgetLastSyncedAt,
      budgetHasUnsyncedChanges,
      localRuleCount,
      localCategoryCount: userCategoryState.categories.length,
      rulePreferences,
      ruleSyncStatus,
      ruleLastSyncedAt,
      ruleHasUnsyncedChanges,
      serverRuleCount,
      serverCategoryCount,
      onBudgetPreferencesChange: updateBudgetPreferences,
      onSyncBudgets: () => void syncBudgetsNow(),
      onRulePreferencesChange: updateRulePreferences,
      onSyncRules: () => void syncRulesNow(),
      onDeleteServerBudgets: () => void deleteServerBudgets(),
      onDeleteServerRules: () => void removePrivateServerRules(),
      onDeleteCommunityRules: () => void removeCommunityRules(),
      onClearLocalTransactions: clearLocalTransactions,
    },
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
            still available. Open Account to review synchronization settings.
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
