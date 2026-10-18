import { useState, type ReactElement } from 'react';
import { AccountIdentity } from './account/AccountIdentity';
import { DangerZone } from './account/DangerZone';
import { StorageOverview } from './account/StorageOverview';
import { SyncPreferences } from './account/SyncPreferences';
import type { AccountProps, DeleteTarget } from './account/types';

export function Account({
  auth,
  transactionCount,
  budgets,
  budgetPreferences,
  budgetSyncStatus,
  serverHasBudgets,
  localRuleCount,
  localCategoryCount,
  rulePreferences,
  ruleSyncStatus,
  serverRuleCount,
  serverCategoryCount,
  onBudgetPreferencesChange,
  onRulePreferencesChange,
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
        onBudgetPreferencesChange={onBudgetPreferencesChange}
        onRulePreferencesChange={onRulePreferencesChange}
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
