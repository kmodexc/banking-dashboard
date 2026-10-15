import { RulePreferencesSchema } from '../types';
import type { RulePreferences } from '../types';

export const RULE_PREFERENCES_KEY = 'dkb-dashboard-rule-preferences-v1';

export const DEFAULT_RULE_PREFERENCES: RulePreferences = {
  storePrivateRules: true,
  useCommunityRules: false,
  contributeRules: false,
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
