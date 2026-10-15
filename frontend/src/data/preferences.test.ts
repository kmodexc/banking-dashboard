import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_RULE_PREFERENCES, loadRulePreferences, saveRulePreferences } from './preferences';

describe('rule preferences', () => {
  beforeEach(() => localStorage.clear());

  it('defaults authenticated users to private storage only', () => {
    expect(DEFAULT_RULE_PREFERENCES).toEqual({
      storePrivateRules: true,
      useCommunityRules: false,
      contributeRules: false,
    });
  });

  it('keeps preferences scoped to the authenticated user', () => {
    saveRulePreferences({ ...DEFAULT_RULE_PREFERENCES, useCommunityRules: true }, 'user-a');

    expect(loadRulePreferences('user-a').useCommunityRules).toBe(true);
    expect(loadRulePreferences('user-b')).toEqual(DEFAULT_RULE_PREFERENCES);
    expect(loadRulePreferences(null)).toEqual(DEFAULT_RULE_PREFERENCES);
  });

  it('falls back to local-only defaults for malformed data', () => {
    localStorage.setItem(
      'dkb-dashboard-rule-preferences-v1:user-a',
      JSON.stringify({ storePrivateRules: 'yes' }),
    );

    expect(loadRulePreferences('user-a')).toEqual(DEFAULT_RULE_PREFERENCES);
  });
});
