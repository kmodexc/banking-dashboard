import type { BudgetPlan } from '../../data/budgets';
import type { BudgetPreferences } from '../../data/preferences';
import type { AuthSnapshot, RulePreferences } from '../../types';

export type DeleteTarget = 'budgets' | 'rules' | 'community' | 'transactions' | null;

export interface AccountProps {
  auth: AuthSnapshot;
  transactionCount: number;
  budgets: BudgetPlan;
  budgetPreferences: BudgetPreferences;
  budgetSyncStatus: string;
  serverHasBudgets: boolean | null;
  localRuleCount: number;
  localCategoryCount: number;
  rulePreferences: RulePreferences;
  ruleSyncStatus: string;
  serverRuleCount: number | null;
  serverCategoryCount: number | null;
  onBudgetPreferencesChange: (next: BudgetPreferences) => void;
  onRulePreferencesChange: (next: RulePreferences) => void;
  onDeleteServerBudgets: () => void;
  onDeleteServerRules: () => void;
  onDeleteCommunityRules: () => void;
  onClearLocalTransactions: () => void;
}
