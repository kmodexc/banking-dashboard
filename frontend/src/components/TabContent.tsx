import type { ReactElement } from 'react';
import type { OidcClient } from '../auth';
import type { BudgetPlan } from '../data/budgets';
import type { BudgetPreferences } from '../data/preferences';
import type { CategoryEntry, UserCategoryState } from '../data/categories';
import type { AccountProps } from './account/types';
import type {
  AuthSnapshot,
  CategoryRule,
  ClassificationRule,
  ManagedRule,
  RuleCategoryOption,
  RulePreferences,
  Transaction,
} from '../types';
import { Account } from './Account';
import { AllTransactions } from './AllTransactions';
import { Categories } from './Categories';
import { CategorizeUnknown } from './CategorizeUnknown';
import { Dashboard } from './Dashboard';
import { Plan } from './Plan';
import { RuleManager } from './RuleManager';
import type { AppTab } from './appTabs';

interface DashboardView {
  transactions: Transaction[];
  period: string;
  onPeriodChange: (period: string) => void;
  categories: string[];
  selectedCategories: string[] | null;
  onCategoryFilterChange: (categories: string[] | null) => void;
  onCategoryChange: (transactionId: string, category: string) => void;
}

interface PlanView {
  transactions: Transaction[];
  categories: string[];
  initialPeriod: string;
  auth: AuthSnapshot;
  budgets: BudgetPlan;
  budgetPreferences: BudgetPreferences;
  budgetSyncStatus: string;
  onBudgetsChange: (next: BudgetPlan) => void;
  onBudgetPreferencesChange: (next: BudgetPreferences) => void;
  onDeleteServerBudgets: () => void;
}

interface UnknownView {
  transactions: Transaction[];
  rules: CategoryRule[];
  auth: AuthSnapshot;
  client: OidcClient;
  onAddRule: (rule: CategoryRule) => void;
  onAddRules: (rules: ClassificationRule[]) => void;
  categories: string[];
  userRules: CategoryRule[];
}

interface CategoriesView {
  auth: AuthSnapshot;
  entries: CategoryEntry[];
  state: UserCategoryState;
  onAdd: (name: string) => void;
  onRename: (entry: CategoryEntry, name: string) => void;
  onDelete: (entry: CategoryEntry) => void;
  onImport: (next: UserCategoryState) => void;
  rulePreferences: RulePreferences;
  onRulePreferencesChange: (next: RulePreferences) => void;
  onSyncRules: () => void;
  onDeleteServerRules: () => void;
  ruleSyncStatus: string;
  ruleManager: {
    rules: ManagedRule[];
    categories: RuleCategoryOption[];
    rulesToExport: CategoryRule[];
    onImport: (rules: CategoryRule[]) => void;
    onUpdate: (previous: CategoryRule, next: CategoryRule) => void;
    onDelete: (rule: CategoryRule) => void;
    onRemoveAll: () => void;
  };
}

interface AllTransactionsView {
  transactions: Transaction[];
  categories: string[];
  onCategoryChange: (transactionId: string, category: string) => void;
}

export interface TabContentProps {
  tab: AppTab;
  dashboard: DashboardView;
  plan: PlanView;
  unknown: UnknownView;
  categories: CategoriesView;
  allTransactions: AllTransactionsView;
  account: AccountProps & { transactionCount: number };
}

export function TabContent({
  tab,
  dashboard,
  plan,
  unknown,
  categories,
  allTransactions,
  account,
}: TabContentProps): ReactElement | null {
  switch (tab) {
    case 'dashboard':
      return <Dashboard {...dashboard} />;
    case 'plan':
      return <Plan {...plan} />;
    case 'unknown':
      return <CategorizeUnknown {...unknown} />;
    case 'categories':
      return (
        <Categories
          auth={categories.auth}
          entries={categories.entries}
          state={categories.state}
          onAdd={categories.onAdd}
          onRename={categories.onRename}
          onDelete={categories.onDelete}
          onImport={categories.onImport}
          rulePreferences={categories.rulePreferences}
          onRulePreferencesChange={categories.onRulePreferencesChange}
          onSyncRules={categories.onSyncRules}
          onDeleteServerRules={categories.onDeleteServerRules}
          ruleSyncStatus={categories.ruleSyncStatus}
        >
          <RuleManager {...categories.ruleManager} />
        </Categories>
      );
    case 'all':
      return <AllTransactions {...allTransactions} />;
    case 'account':
      return <Account {...account} />;
    default:
      return null;
  }
}
