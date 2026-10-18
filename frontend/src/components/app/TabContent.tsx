import type { ReactElement } from 'react';
import type { OidcClient } from '../../auth';
import type { BudgetPlan } from '../../data/budgets';
import type { AccountProps } from '../account/types';
import { Categories } from '../categories/Categories';
import type { CategoriesController } from '../categories/categoryTypes';
import type { RulesController } from '../rules/ruleTypes';
import type { AuthSnapshot, CategoryRule, ClassificationRule, Transaction } from '../../types';
import { Account } from '../account/Account';
import { AllTransactions } from '../transactions/AllTransactions';
import { CategorizeUnknown } from '../rules/CategorizeUnknown';
import { Dashboard } from '../dashboard/Dashboard';
import { Plan } from '../plan/Plan';
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
  rulesController: RulesController;
}

interface CategoriesView {
  categoriesController: CategoriesController;
  rulesController: RulesController;
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
          categoriesController={categories.categoriesController}
          rulesController={categories.rulesController}
        />
      );
    case 'all':
      return <AllTransactions {...allTransactions} />;
    case 'account':
      return <Account {...account} />;
    default:
      return null;
  }
}
