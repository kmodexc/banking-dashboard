import type { BudgetPlan } from '../../data/budgets';
import type { BudgetPlanSummary } from '../../data/budgets';
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
  serverBudgetSummary: BudgetPlanSummary | null;
  budgetLastSyncedAt: string | null;
  budgetHasUnsyncedChanges: boolean;
  localRuleCount: number;
  localCategoryCount: number;
  rulePreferences: RulePreferences;
  ruleSyncStatus: string;
  ruleLastSyncedAt: string | null;
  ruleHasUnsyncedChanges: boolean;
  serverRuleCount: number | null;
  serverCategoryCount: number | null;
  onBudgetPreferencesChange: (next: BudgetPreferences) => void;
  onSyncBudgets: () => void;
  onRulePreferencesChange: (next: RulePreferences) => void;
  onSyncRules: () => void;
  onDeleteServerBudgets: () => void;
  onDeleteServerRules: () => void;
  onDeleteCommunityRules: () => void;
  onClearLocalTransactions: () => void;
}
