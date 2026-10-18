import { z } from 'zod';

export const BUDGETS_STORAGE_KEY = 'dkb-dashboard-budgets-v1';

const BudgetMapSchema = z.record(
  z.string().min(1).max(80),
  z.number().finite().nonnegative().max(100_000_000),
);

export const BudgetPlanSchema = z
  .object({
    defaults: BudgetMapSchema.default({}),
    monthly: z.record(z.string(), BudgetMapSchema).default({}),
  })
  .strict();

export type BudgetMap = Record<string, number>;

export interface BudgetPlan {
  defaults: BudgetMap;
  monthly: Record<string, BudgetMap>;
}

export const EMPTY_BUDGET_PLAN: BudgetPlan = {
  defaults: {},
  monthly: {},
};

function normalizeMap(map: BudgetMap): BudgetMap {
  return Object.fromEntries(
    Object.entries(map)
      .map(([category, amount]) => [category.trim(), Math.round(amount * 100) / 100] as const)
      .filter(([category, amount]) => category && Number.isFinite(amount) && amount >= 0),
  );
}

function normalizePlan(value: z.infer<typeof BudgetPlanSchema>): BudgetPlan {
  const monthly = Object.fromEntries(
    Object.entries(value.monthly)
      .map(([period, budgets]) => [period, normalizeMap(budgets)] as const)
      .filter(([, budgets]) => Object.keys(budgets).length > 0),
  );
  return {
    defaults: normalizeMap(value.defaults),
    monthly,
  };
}

export function parseBudgetPlan(value: string | null): BudgetPlan {
  if (!value) return EMPTY_BUDGET_PLAN;
  try {
    return parseBudgetPlanValue(JSON.parse(value)) ?? EMPTY_BUDGET_PLAN;
  } catch {
    return EMPTY_BUDGET_PLAN;
  }
}

export function parseBudgetPlanValue(value: unknown): BudgetPlan | null {
  const parsed = BudgetPlanSchema.safeParse(value);
  return parsed.success ? normalizePlan(parsed.data) : null;
}

export function loadBudgetPlan(): BudgetPlan {
  return parseBudgetPlan(localStorage.getItem(BUDGETS_STORAGE_KEY));
}

export function saveBudgetPlan(plan: BudgetPlan): void {
  localStorage.setItem(BUDGETS_STORAGE_KEY, JSON.stringify(normalizePlan(plan)));
}

export function updateBudgetValue(
  plan: BudgetPlan,
  scope: 'default' | 'monthly',
  period: string,
  category: string,
  amount: number | null,
): BudgetPlan {
  const key = category.trim();
  if (!key) return plan;
  if (scope === 'default') {
    const defaults = { ...plan.defaults };
    if (amount === null) delete defaults[key];
    else defaults[key] = amount;
    return { ...plan, defaults: normalizeMap(defaults) };
  }

  const monthly = { ...plan.monthly };
  const budgets = { ...(monthly[period] ?? {}) };
  if (amount === null) delete budgets[key];
  else budgets[key] = amount;
  if (Object.keys(budgets).length) monthly[period] = normalizeMap(budgets);
  else delete monthly[period];
  return { ...plan, monthly };
}

export function renameBudgetCategory(
  plan: BudgetPlan,
  previousName: string,
  nextName: string,
): BudgetPlan {
  if (previousName === nextName) return plan;
  const renameMap = (map: BudgetMap): BudgetMap => {
    if (!(previousName in map)) return map;
    const next = { ...map };
    if (!(nextName in next)) next[nextName] = next[previousName]!;
    delete next[previousName];
    return normalizeMap(next);
  };
  return {
    defaults: renameMap(plan.defaults),
    monthly: Object.fromEntries(
      Object.entries(plan.monthly).map(([period, budgets]) => [period, renameMap(budgets)]),
    ),
  };
}
