import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { deleteStoredBudgets, getStoredBudgets, replaceStoredBudgets } from '../api';
import { getAppConfig } from '../config';
import {
  DEFAULT_BUDGET_PREFERENCES,
  loadBudgetPreferences,
  saveBudgetPreferences,
  type BudgetPreferences,
} from '../data/preferences';
import { loadBudgetPlan, saveBudgetPlan, type BudgetPlan } from '../data/budgets';
import type { AuthSnapshot } from '../types';

const config = getAppConfig();

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected error';
}

function hasBudgets(plan: BudgetPlan): boolean {
  return Object.keys(plan.defaults).length > 0 || Object.keys(plan.monthly).length > 0;
}

export function useBudgetSync(
  auth: AuthSnapshot,
  userId: string,
): {
  budgetPlan: BudgetPlan;
  budgetPreferences: BudgetPreferences;
  budgetSyncStatus: string;
  serverHasBudgets: boolean | null;
  deleteServerBudgets: () => Promise<void>;
  updateBudgetPlan: (next: BudgetPlan) => void;
  updateBudgetPreferences: (next: BudgetPreferences) => void;
} {
  const [budgetPlan, setBudgetPlan] = useState<BudgetPlan>(() => loadBudgetPlan());
  const [preferencesStore, setPreferencesStore] = useState<{
    userId: string | null;
    preferences: BudgetPreferences;
  }>({ userId: null, preferences: DEFAULT_BUDGET_PREFERENCES });
  const [budgetSyncStatus, setBudgetSyncStatus] = useState('');
  const [serverHasBudgets, setServerHasBudgets] = useState<boolean | null>(null);
  const previousUserId = useRef<string | null>(null);
  const requestVersion = useRef(0);
  const budgetPlanRef = useRef(budgetPlan);
  const budgetPreferencesRef = useRef<BudgetPreferences>(DEFAULT_BUDGET_PREFERENCES);
  useEffect(() => {
    budgetPlanRef.current = budgetPlan;
  }, [budgetPlan]);
  const budgetPreferences = useMemo(
    () =>
      preferencesStore.userId === (auth.token ? userId : null)
        ? preferencesStore.preferences
        : loadBudgetPreferences(auth.token ? userId : null),
    [auth.token, preferencesStore, userId],
  );
  useEffect(() => {
    budgetPreferencesRef.current = budgetPreferences;
  }, [budgetPreferences]);

  const syncToServer = useCallback(async (next: BudgetPlan, token: string): Promise<void> => {
    setBudgetSyncStatus('Syncing budgets…');
    try {
      await replaceStoredBudgets(config, token, next);
      setServerHasBudgets(hasBudgets(next));
      setBudgetSyncStatus('Budgets synced privately.');
    } catch (error: unknown) {
      setBudgetSyncStatus(`Could not sync budgets: ${errorMessage(error)}`);
    }
  }, []);

  useEffect(() => {
    const currentUserId = auth.token ? userId : null;
    const isNewLogin = Boolean(currentUserId && previousUserId.current !== currentUserId);
    previousUserId.current = currentUserId;
    if (!auth.token || !budgetPreferencesRef.current.storePrivateBudgets) {
      setServerHasBudgets(null);
      return () => undefined;
    }
    const version = requestVersion.current + 1;
    requestVersion.current = version;
    let active = true;
    const token = auth.token;
    void getStoredBudgets(config, token)
      .then((serverPlan) => {
        if (!active || requestVersion.current !== version) return;
        setServerHasBudgets(Boolean(serverPlan));
        if (serverPlan) {
          setBudgetPlan(serverPlan);
          saveBudgetPlan(serverPlan);
          setBudgetSyncStatus('Private budgets loaded from the server.');
        } else if (isNewLogin && hasBudgets(budgetPlanRef.current)) {
          void syncToServer(budgetPlanRef.current, token);
        } else {
          setBudgetSyncStatus('Private budget storage is enabled.');
        }
      })
      .catch((error: unknown) => {
        if (active && requestVersion.current === version) {
          setBudgetSyncStatus(`Could not load budgets: ${errorMessage(error)}`);
        }
      });
    return () => {
      active = false;
    };
  }, [auth.token, syncToServer, userId]);

  function updateBudgetPlan(next: BudgetPlan): void {
    setBudgetPlan(next);
    saveBudgetPlan(next);
    if (auth.token && budgetPreferences.storePrivateBudgets) {
      void syncToServer(next, auth.token);
    }
  }

  function updateBudgetPreferences(next: BudgetPreferences): void {
    if (!auth.token) {
      setBudgetSyncStatus('Sign in to change budget privacy settings.');
      return;
    }
    const token = auth.token;
    setPreferencesStore({ userId, preferences: next });
    saveBudgetPreferences(next, userId);
    if (next.storePrivateBudgets) void syncToServer(budgetPlan, token);
    else setBudgetSyncStatus('Budgets remain local to this browser.');
  }

  async function deleteServerBudgets(): Promise<void> {
    if (!auth.token) return;
    const token = auth.token;
    setBudgetSyncStatus('Deleting private server budgets…');
    try {
      await deleteStoredBudgets(config, token);
      setServerHasBudgets(false);
      setBudgetSyncStatus('Private server budgets deleted.');
    } catch (error: unknown) {
      setBudgetSyncStatus(`Could not delete private server budgets: ${errorMessage(error)}`);
    }
  }

  return {
    budgetPlan,
    budgetPreferences,
    budgetSyncStatus: !auth.token
      ? 'Sign in to sync budgets on the server.'
      : !budgetPreferences.storePrivateBudgets
        ? 'Budgets remain local to this browser.'
        : budgetSyncStatus,
    serverHasBudgets,
    deleteServerBudgets,
    updateBudgetPlan,
    updateBudgetPreferences,
  };
}
