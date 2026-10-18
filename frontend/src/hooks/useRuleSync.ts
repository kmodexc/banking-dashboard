import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  contributeRules,
  deleteContributedRules,
  deleteStoredRules,
  getStoredRules,
  replaceStoredRules,
} from '../api';
import { getAppConfig } from '../config';
import {
  DEFAULT_RULE_PREFERENCES,
  loadRulePreferences,
  saveRulePreferences,
} from '../data/preferences';
import { deduplicateRules, loadLocalRules, ruleKey, saveLocalRules } from '../data/rules';
import type { UserCategoryState } from '../data/categories';
import { LEGACY_COMMUNITY_CATEGORIES } from '../types';
import type { AuthSnapshot, CategoryRule, ClassificationRule, RulePreferences } from '../types';

const config = getAppConfig();

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected error';
}

export function useRuleSync(
  auth: AuthSnapshot,
  categoryUserId: string,
): {
  activeRules: CategoryRule[];
  communityRules: CategoryRule[];
  defaultRules: CategoryRule[];
  privateCategories: UserCategoryState | null | undefined;
  serverCategoryCount: number | null;
  serverRuleCount: number | null;
  localRules: CategoryRule[];
  rulePreferences: RulePreferences;
  ruleSyncStatus: string;
  userRules: CategoryRule[];
  addRule: (rule: CategoryRule) => void;
  addRules: (rules: ClassificationRule[]) => void;
  deleteUserRule: (rule: CategoryRule) => void;
  removeCommunityRules: () => Promise<void>;
  removePrivateServerRules: () => Promise<void>;
  replaceLocalRules: (rules: CategoryRule[]) => void;
  replaceRules: (
    rules: CategoryRule[],
    categoriesOrPreferences?: UserCategoryState | RulePreferences,
    preferences?: RulePreferences,
  ) => Promise<void>;
  updateRulePreferences: (preferences: RulePreferences) => void;
  updateUserRule: (previous: CategoryRule, next: CategoryRule) => void;
} {
  const [defaultRules] = useState<CategoryRule[]>([]);
  const [privateCategories, setPrivateCategories] = useState<UserCategoryState | null | undefined>(
    undefined,
  );
  const [localRules, setLocalRules] = useState<CategoryRule[]>(() => loadLocalRules());
  const [rulePreferencesStore, setRulePreferencesStore] = useState<{
    userId: string | null;
    preferences: RulePreferences;
  }>({ userId: null, preferences: DEFAULT_RULE_PREFERENCES });
  const [serverRules, setServerRules] = useState<CategoryRule[]>([]);
  const [serverRuleCount, setServerRuleCount] = useState<number | null>(null);
  const [serverCategoryCount, setServerCategoryCount] = useState<number | null>(null);
  const [serverRulesUserId, setServerRulesUserId] = useState<string | null>(null);
  const [communityRules, setCommunityRules] = useState<CategoryRule[]>([]);
  const [ruleSyncStatus, setRuleSyncStatus] = useState('');
  const previousUserId = useRef<string | null>(null);
  const rulePreferences =
    rulePreferencesStore.userId === (auth.token ? categoryUserId : null)
      ? rulePreferencesStore.preferences
      : loadRulePreferences(auth.token ? categoryUserId : null);
  const storePrivateRules = rulePreferences.storePrivateRules;
  const useCommunityRules = rulePreferences.useCommunityRules;
  const contributeRulesPreference = rulePreferences.contributeRules;

  const privateRulesForUser = useMemo(
    () =>
      auth.token && rulePreferences.storePrivateRules && serverRulesUserId === categoryUserId
        ? serverRules
        : [],
    [auth.token, categoryUserId, rulePreferences.storePrivateRules, serverRules, serverRulesUserId],
  );
  const userRules = useMemo(
    () => deduplicateRules([...localRules, ...privateRulesForUser]),
    [localRules, privateRulesForUser],
  );
  const activeRules = useMemo(
    () => [...localRules, ...privateRulesForUser],
    [localRules, privateRulesForUser],
  );

  const replaceRules = useCallback(
    async (
      nextRules: CategoryRule[],
      categoriesOrPreferences?: UserCategoryState | RulePreferences,
      preferences?: RulePreferences,
    ): Promise<void> => {
      const categories =
        categoriesOrPreferences && 'categories' in categoriesOrPreferences
          ? categoriesOrPreferences
          : undefined;
      const activePreferences =
        preferences ??
        (categoriesOrPreferences && 'storePrivateRules' in categoriesOrPreferences
          ? categoriesOrPreferences
          : {
              storePrivateRules,
              useCommunityRules,
              contributeRules: contributeRulesPreference,
            });
      if (!auth.token) {
        setRuleSyncStatus('Sign in to sync rules on the server.');
        return;
      }
      if (!activePreferences.storePrivateRules && !activePreferences.contributeRules) {
        setRuleSyncStatus('Rules remain local to this browser.');
        return;
      }
      const uniqueRules = deduplicateRules(nextRules);
      setRuleSyncStatus('Syncing rules…');
      try {
        if (activePreferences.storePrivateRules) {
          await replaceStoredRules(config, auth.token, uniqueRules, categories);
          setServerRulesUserId(categoryUserId);
          setServerRules(uniqueRules);
          setServerRuleCount(uniqueRules.length);
          if (categories) setPrivateCategories(categories);
          if (categories) setServerCategoryCount(categories.categories.length);
        }
        if (activePreferences.contributeRules) {
          const eligibleRules = uniqueRules.filter((rule) =>
            (LEGACY_COMMUNITY_CATEGORIES as readonly string[]).includes(rule.category),
          );
          await contributeRules(config, auth.token, eligibleRules);
        }
        setRuleSyncStatus('Rules synced. Custom-category rules stayed private.');
      } catch (error: unknown) {
        setRuleSyncStatus(`Could not sync rules: ${errorMessage(error)}`);
      }
    },
    [auth.token, categoryUserId, storePrivateRules, useCommunityRules, contributeRulesPreference],
  );

  useEffect(() => {
    let active = true;
    const currentUserId = auth.token ? categoryUserId : null;
    const isNewLogin = Boolean(currentUserId && previousUserId.current !== currentUserId);
    previousUserId.current = currentUserId;
    if (!auth.token || (!storePrivateRules && !useCommunityRules && !contributeRulesPreference)) {
      return () => {
        active = false;
      };
    }
    void getStoredRules(config, auth.token, useCommunityRules)
      .then((result) => {
        if (!active) return;
        setServerRulesUserId(categoryUserId);
        setServerRules(storePrivateRules ? result.private : []);
        setServerRuleCount(storePrivateRules ? result.private.length : null);
        setCommunityRules(useCommunityRules ? result.community : []);
        setPrivateCategories(storePrivateRules ? (result.categories ?? null) : null);
        setServerCategoryCount(
          storePrivateRules ? (result.categories?.categories.length ?? 0) : null,
        );
        setRuleSyncStatus('Shared rules loaded.');
        if (isNewLogin && localRules.length && (storePrivateRules || contributeRulesPreference)) {
          void replaceRules(localRules);
        }
      })
      .catch((error: unknown) => {
        if (active) setRuleSyncStatus(`Could not load shared rules: ${errorMessage(error)}`);
      });
    return () => {
      active = false;
    };
  }, [
    auth.token,
    categoryUserId,
    storePrivateRules,
    useCommunityRules,
    contributeRulesPreference,
    localRules,
    replaceRules,
  ]);

  function saveRules(nextRules: CategoryRule[]): void {
    const uniqueRules = deduplicateRules(nextRules);
    setLocalRules(uniqueRules);
    saveLocalRules(uniqueRules);
    if (auth.token && (rulePreferences.storePrivateRules || rulePreferences.contributeRules)) {
      void replaceRules(uniqueRules);
    }
  }

  function updateRulePreferences(next: RulePreferences): void {
    if (!auth.token) {
      setRuleSyncStatus('Sign in to change rule privacy settings.');
      return;
    }
    setRulePreferencesStore({ userId: categoryUserId, preferences: next });
    saveRulePreferences(next, categoryUserId);
    if (next.useCommunityRules) setRuleSyncStatus('Loading shared rules…');
    else setCommunityRules([]);
    if (next.storePrivateRules || next.contributeRules) void replaceRules(localRules, next);
  }

  function addRule(rule: CategoryRule): void {
    saveRules([rule, ...userRules]);
  }

  function addRules(newRules: ClassificationRule[]): void {
    saveRules([
      ...newRules.filter(
        (rule) => !userRules.some((existing) => ruleKey(existing) === ruleKey(rule)),
      ),
      ...userRules,
    ]);
  }

  function replaceLocalRules(nextRules: CategoryRule[]): void {
    saveRules(nextRules);
  }

  function updateUserRule(previous: CategoryRule, next: CategoryRule): void {
    const previousKey = ruleKey(previous);
    saveRules(userRules.map((rule) => (ruleKey(rule) === previousKey ? next : rule)));
  }

  function deleteUserRule(rule: CategoryRule): void {
    const key = ruleKey(rule);
    saveRules(userRules.filter((candidate) => ruleKey(candidate) !== key));
  }

  async function removePrivateServerRules(): Promise<void> {
    if (!auth.token) return;
    setRuleSyncStatus('Deleting private server rules…');
    try {
      await deleteStoredRules(config, auth.token);
      setServerRulesUserId(categoryUserId);
      setServerRules([]);
      setServerRuleCount(0);
      setPrivateCategories(undefined);
      setServerCategoryCount(0);
      setRuleSyncStatus('Private server rules deleted.');
    } catch (error: unknown) {
      setRuleSyncStatus(`Could not delete private server rules: ${errorMessage(error)}`);
    }
  }

  async function removeCommunityRules(): Promise<void> {
    if (!auth.token) return;
    setRuleSyncStatus('Removing your community contributions…');
    try {
      await deleteContributedRules(config, auth.token);
      setRuleSyncStatus('Your community contributions were removed.');
    } catch (error: unknown) {
      setRuleSyncStatus(`Could not remove community contributions: ${errorMessage(error)}`);
    }
  }

  return {
    activeRules,
    communityRules,
    defaultRules,
    privateCategories,
    serverCategoryCount:
      auth.token && storePrivateRules && serverRulesUserId === categoryUserId
        ? serverCategoryCount
        : null,
    serverRuleCount:
      auth.token && storePrivateRules && serverRulesUserId === categoryUserId
        ? serverRuleCount
        : null,
    localRules,
    rulePreferences,
    ruleSyncStatus,
    userRules,
    addRule,
    addRules,
    deleteUserRule,
    removeCommunityRules,
    removePrivateServerRules,
    replaceLocalRules,
    replaceRules,
    updateRulePreferences,
    updateUserRule,
  };
}
