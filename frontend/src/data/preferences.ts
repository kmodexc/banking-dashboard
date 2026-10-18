import { RulePreferencesSchema } from '../types';
import type { RulePreferences } from '../types';

export const RULE_PREFERENCES_KEY = 'dkb-dashboard-rule-preferences-v1';
export const BUDGET_PREFERENCES_KEY = 'dkb-dashboard-budget-preferences-v1';

export const DEFAULT_RULE_PREFERENCES: RulePreferences = {
  storePrivateRules: true,
  useCommunityRules: false,
  contributeRules: false,
};

export interface BudgetPreferences {
  storePrivateBudgets: boolean;
}

export const DEFAULT_BUDGET_PREFERENCES: BudgetPreferences = {
  storePrivateBudgets: true,
};

function storageKey(userId: string | null): string | null {
  return userId ? `${RULE_PREFERENCES_KEY}:${encodeURIComponent(userId)}` : null;
}

export function loadRulePreferences(userId: string | null): RulePreferences {
  const key = storageKey(userId);
  if (!key) return DEFAULT_RULE_PREFERENCES;
  const value = localStorage.getItem(key);
  if (!value) return DEFAULT_RULE_PREFERENCES;
  try {
    const result = RulePreferencesSchema.safeParse(JSON.parse(value) as unknown);
    return result.success ? result.data : DEFAULT_RULE_PREFERENCES;
  } catch {
    return DEFAULT_RULE_PREFERENCES;
  }
}

export function saveRulePreferences(preferences: RulePreferences, userId: string | null): void {
  const key = storageKey(userId);
  if (key) localStorage.setItem(key, JSON.stringify(preferences));
}

function budgetPreferencesKey(userId: string | null): string | null {
  return userId ? `${BUDGET_PREFERENCES_KEY}:${encodeURIComponent(userId)}` : null;
}

export function loadBudgetPreferences(userId: string | null): BudgetPreferences {
  const key = budgetPreferencesKey(userId);
  if (!key) return DEFAULT_BUDGET_PREFERENCES;
  const value = localStorage.getItem(key);
  if (!value) return DEFAULT_BUDGET_PREFERENCES;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (
      parsed &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed) &&
      typeof (parsed as { storePrivateBudgets?: unknown }).storePrivateBudgets === 'boolean'
    ) {
      return parsed as BudgetPreferences;
    }
  } catch {
    // Use the default below when browser storage contains malformed data.
  }
  return DEFAULT_BUDGET_PREFERENCES;
}

export function saveBudgetPreferences(preferences: BudgetPreferences, userId: string | null): void {
  const key = budgetPreferencesKey(userId);
  if (key) localStorage.setItem(key, JSON.stringify(preferences));
}
