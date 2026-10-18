import type { ReactElement } from 'react';
import type { OidcClient } from '../../auth';
import type { BudgetPlan } from '../../data/budgets';
import type { CategoryEntry, UserCategoryState } from '../../data/categories';
import type { AccountProps } from '../account/types';
import type {
  AuthSnapshot,
  CategoryRule,
  ClassificationRule,
  ManagedRule,
  RuleCategoryOption,
  Transaction,
} from '../../types';
import { Account } from '../account/Account';
import { AllTransactions } from '../transactions/AllTransactions';
import { Categories } from '../categories/Categories';
import { CategorizeUnknown } from '../rules/CategorizeUnknown';
import { Dashboard } from '../dashboard/Dashboard';
import { Plan } from '../plan/Plan';
import { RuleSummaryList } from '../rules/RuleSummaryList';
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
  budgets: BudgetPlan;
  onBudgetsChange: (next: BudgetPlan) => void;
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
  entries: CategoryEntry[];
  state: UserCategoryState;
  onAdd: (name: string) => void;
  onRename: (entry: CategoryEntry, name: string) => void;
  onDelete: (entry: CategoryEntry) => void;
  onImport: (next: UserCategoryState) => void;
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
          entries={categories.entries}
          state={categories.state}
          onAdd={categories.onAdd}
          onRename={categories.onRename}
          onDelete={categories.onDelete}
          onImport={categories.onImport}
        >
          <RuleSummaryList
            rules={categories.ruleManager.rules}
            categories={categories.ruleManager.categories}
            title="Categorization rules"
            listLabel="Categorization rule list"
            emptyMessage="No rules match this filter."
            rulesToExport={categories.ruleManager.rulesToExport}
            onImport={categories.ruleManager.onImport}
            onUpdate={categories.ruleManager.onUpdate}
            onDelete={categories.ruleManager.onDelete}
            onRemoveAll={categories.ruleManager.onRemoveAll}
          />
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
