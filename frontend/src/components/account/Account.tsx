import { useState, type ReactElement } from 'react';
import { AccountIdentity } from './AccountIdentity';
import { DangerZone } from './DangerZone';
import { StorageOverview } from './StorageOverview';
import { SyncPreferences } from './SyncPreferences';
import type { AccountProps, DeleteTarget } from './types';

export function Account({
  auth,
  transactionCount,
  budgets,
  budgetPreferences,
  budgetSyncStatus,
  budgetLastSyncedAt,
  budgetHasUnsyncedChanges,
  serverHasBudgets,
  serverBudgetSummary,
  localRuleCount,
  localCategoryCount,
  rulePreferences,
  ruleSyncStatus,
  ruleLastSyncedAt,
  ruleHasUnsyncedChanges,
  serverRuleCount,
  serverCategoryCount,
  onBudgetPreferencesChange,
  onSyncBudgets,
  onRulePreferencesChange,
  onSyncRules,
  onDeleteServerBudgets,
  onDeleteServerRules,
  onDeleteCommunityRules,
  onClearLocalTransactions,
}: AccountProps): ReactElement {
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const canManageAccount = Boolean(auth.token);

  function confirmDelete(): void {
    if (deleteTarget === 'budgets') onDeleteServerBudgets();
    if (deleteTarget === 'rules') onDeleteServerRules();
    if (deleteTarget === 'community') onDeleteCommunityRules();
    if (deleteTarget === 'transactions') onClearLocalTransactions();
    setDeleteTarget(null);
  }

  return (
    <section id="account-tab" className="tab-panel account-tab">
      <div className="account-heading">
        <div>
          <span className="eyebrow accent-eyebrow">Account</span>
          <h2>Account and data</h2>
          <p className="muted">
            Review where your dashboard data lives and control private synchronization.
          </p>
        </div>
        <AccountIdentity auth={auth} />
      </div>

      <StorageOverview
        auth={auth}
        transactionCount={transactionCount}
        budgets={budgets}
        budgetPreferences={budgetPreferences}
        serverHasBudgets={serverHasBudgets}
        serverBudgetSummary={serverBudgetSummary}
        localRuleCount={localRuleCount}
        localCategoryCount={localCategoryCount}
        rulePreferences={rulePreferences}
        serverRuleCount={serverRuleCount}
        serverCategoryCount={serverCategoryCount}
      />
      <SyncPreferences
        canManageAccount={canManageAccount}
        budgetPreferences={budgetPreferences}
        rulePreferences={rulePreferences}
        budgetSyncStatus={budgetSyncStatus}
        ruleSyncStatus={ruleSyncStatus}
        budgetLastSyncedAt={budgetLastSyncedAt}
        budgetHasUnsyncedChanges={budgetHasUnsyncedChanges}
        ruleLastSyncedAt={ruleLastSyncedAt}
        ruleHasUnsyncedChanges={ruleHasUnsyncedChanges}
        onBudgetPreferencesChange={onBudgetPreferencesChange}
        onSyncBudgets={onSyncBudgets}
        onRulePreferencesChange={onRulePreferencesChange}
        onSyncRules={onSyncRules}
      />
      <DangerZone
        canManageAccount={canManageAccount}
        transactionCount={transactionCount}
        deleteTarget={deleteTarget}
        onRequestDelete={setDeleteTarget}
        onCancelDelete={() => setDeleteTarget(null)}
        onConfirmDelete={confirmDelete}
      />
    </section>
  );
}
