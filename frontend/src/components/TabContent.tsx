import type { ReactElement } from 'react';
import type { OidcClient } from '../auth';
import type { BudgetPlan } from '../data/budgets';
import type { BudgetPreferences } from '../data/preferences';
import { categoryName } from '../data/categories';
import type { AuthSnapshot, CategoryRule, ClassificationRule, Transaction } from '../types';
import { Account } from './Account';
import { AllTransactions } from './AllTransactions';
import { Categories } from './Categories';
import { CategorizeUnknown } from './CategorizeUnknown';
import { Dashboard } from './Dashboard';
import { Plan } from './Plan';
import { RuleManager, type ManagedRule, type RuleCategoryOption } from './RuleManager';
import type { AppTab } from './appTabs';

export interface TabContentProps {
  tab: AppTab;
  transactions: Transaction[];
  period: string;
  onPeriodChange: (period: string) => void;
  categories: string[];
  selectedCategories: string[] | null;
  onCategoryFilterChange: (categories: string[] | null) => void;
  onCategoryChange: (transactionId: string, category: string) => void;
  auth: AuthSnapshot;
  client: OidcClient;
  rules: CategoryRule[];
  userRules: CategoryRule[];
  localRuleCount: number;
  onAddRule: (rule: CategoryRule) => void;
  onAddRules: (rules: ClassificationRule[]) => void;
  managedRules: ManagedRule[];
  ruleCategoryOptions: RuleCategoryOption[];
  onImportRules: (rules: CategoryRule[]) => void;
  onUpdateRule: (previous: CategoryRule, next: CategoryRule) => void;
  onDeleteRule: (rule: CategoryRule) => void;
  onRemoveAllRules: () => void;
  userCategoryState: Parameters<typeof Categories>[0]['state'];
  categoryEntries: Parameters<typeof Categories>[0]['entries'];
  onAddCategory: (name: string) => void;
  onRenameCategory: Parameters<typeof Categories>[0]['onRename'];
  onDeleteCategory: Parameters<typeof Categories>[0]['onDelete'];
  onImportCategories: Parameters<typeof Categories>[0]['onImport'];
  onRulePreferencesChange: Parameters<typeof Categories>[0]['onRulePreferencesChange'];
  onSyncRules: () => void;
  onDeleteServerRules: () => void;
  rulePreferences: Parameters<typeof Categories>[0]['rulePreferences'];
  ruleSyncStatus: string;
  budgets: BudgetPlan;
  budgetPreferences: BudgetPreferences;
  budgetSyncStatus: string;
  serverHasBudgets: boolean | null;
  onBudgetsChange: (next: BudgetPlan) => void;
  onBudgetPreferencesChange: (next: BudgetPreferences) => void;
  onDeleteServerBudgets: () => void;
  serverRuleCount: number | null;
  serverCategoryCount: number | null;
  onDeleteCommunityRules: () => void;
  onClearTransactions: () => void;
}

export function TabContent({
  tab,
  transactions,
  period,
  onPeriodChange,
  categories,
  selectedCategories,
  onCategoryFilterChange,
  onCategoryChange,
  auth,
  client,
  rules,
  userRules,
  localRuleCount,
  onAddRule,
  onAddRules,
  managedRules,
  ruleCategoryOptions,
  onImportRules,
  onUpdateRule,
  onDeleteRule,
  onRemoveAllRules,
  userCategoryState,
  categoryEntries,
  onAddCategory,
  onRenameCategory,
  onDeleteCategory,
  onImportCategories,
  onRulePreferencesChange,
  onSyncRules,
  onDeleteServerRules,
  rulePreferences,
  ruleSyncStatus,
  budgets,
  budgetPreferences,
  budgetSyncStatus,
  serverHasBudgets,
  onBudgetsChange,
  onBudgetPreferencesChange,
  onDeleteServerBudgets,
  serverRuleCount,
  serverCategoryCount,
  onDeleteCommunityRules,
  onClearTransactions,
}: TabContentProps): ReactElement | null {
  const categorizedUserRules = userRules.map((rule) => ({
    ...rule,
    category: categoryName(userCategoryState, rule.category),
  }));

  if (tab === 'dashboard') {
    return (
      <Dashboard
        transactions={transactions}
        period={period}
        onPeriodChange={onPeriodChange}
        categories={categories}
        selectedCategories={selectedCategories}
        onCategoryFilterChange={onCategoryFilterChange}
        onCategoryChange={onCategoryChange}
      />
    );
  }

  if (tab === 'plan') {
    return (
      <Plan
        transactions={transactions}
        categories={categories}
        initialPeriod={period}
        auth={auth}
        budgets={budgets}
        budgetPreferences={budgetPreferences}
        budgetSyncStatus={budgetSyncStatus}
        onBudgetsChange={onBudgetsChange}
        onBudgetPreferencesChange={onBudgetPreferencesChange}
        onDeleteServerBudgets={onDeleteServerBudgets}
      />
    );
  }

  if (tab === 'unknown') {
    return (
      <CategorizeUnknown
        transactions={transactions}
        rules={rules}
        auth={auth}
        client={client}
        onAddRule={onAddRule}
        onAddRules={onAddRules}
        categories={categories}
        userRules={categorizedUserRules}
      />
    );
  }

  if (tab === 'categories') {
    return (
      <Categories
        auth={auth}
        entries={categoryEntries}
        state={userCategoryState}
        onAdd={onAddCategory}
        onRename={onRenameCategory}
        onDelete={onDeleteCategory}
        onImport={onImportCategories}
        rulePreferences={rulePreferences}
        onRulePreferencesChange={onRulePreferencesChange}
        onSyncRules={onSyncRules}
        onDeleteServerRules={onDeleteServerRules}
        ruleSyncStatus={ruleSyncStatus}
      >
        <RuleManager
          rules={managedRules}
          categories={ruleCategoryOptions}
          rulesToExport={userRules}
          onImport={onImportRules}
          onUpdate={onUpdateRule}
          onDelete={onDeleteRule}
          onRemoveAll={onRemoveAllRules}
        />
      </Categories>
    );
  }

  if (tab === 'all') {
    return (
      <AllTransactions
        transactions={transactions}
        categories={categories}
        onCategoryChange={onCategoryChange}
      />
    );
  }

  if (tab === 'account') {
    return (
      <Account
        auth={auth}
        transactionCount={transactions.length}
        budgets={budgets}
        budgetPreferences={budgetPreferences}
        budgetSyncStatus={budgetSyncStatus}
        serverHasBudgets={serverHasBudgets}
        localRuleCount={localRuleCount}
        localCategoryCount={userCategoryState.categories.length}
        rulePreferences={rulePreferences}
        ruleSyncStatus={ruleSyncStatus}
        serverRuleCount={serverRuleCount}
        serverCategoryCount={serverCategoryCount}
        onBudgetPreferencesChange={onBudgetPreferencesChange}
        onRulePreferencesChange={onRulePreferencesChange}
        onDeleteServerBudgets={onDeleteServerBudgets}
        onDeleteServerRules={onDeleteServerRules}
        onDeleteCommunityRules={onDeleteCommunityRules}
        onClearLocalTransactions={onClearTransactions}
      />
    );
  }

  return null;
}
