import {
  CategoryRuleSchema,
  ClassificationRequestSchema,
  ClassificationResponseSchema,
} from './types';
import type { AppConfig, CategoryRule, ClassificationRule } from './types';
import { parseBudgetPlanValue } from './data/budgets';
import type { BudgetPlan } from './data/budgets';
import { parseImportedCategoryState } from './data/categories';
import type { UserCategoryState } from './data/categories';

const RuleListSchema = CategoryRuleSchema.array();

async function readRuleCollection(response: Response): Promise<{
  private: CategoryRule[];
  community: CategoryRule[];
  categories?: UserCategoryState | null;
}> {
  if (response.status === 401) throw new Error('Your session expired; sign in again');
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Invalid rule response');
  }
  const value = payload as { private?: unknown; community?: unknown; categories?: unknown };
  const hasCategories = Object.prototype.hasOwnProperty.call(value, 'categories');
  const categories =
    value.categories == null ? null : parseImportedCategoryState(JSON.stringify(value.categories));
  if (value.categories != null && !categories) throw new Error('Invalid category response');
  return {
    private: RuleListSchema.parse(value.private ?? []),
    community: RuleListSchema.parse(value.community ?? []),
    ...(hasCategories ? { categories } : {}),
  };
}

export async function classifyTransactions(
  config: AppConfig,
  token: string,
  request: unknown,
): Promise<ClassificationRule[]> {
  const body = ClassificationRequestSchema.parse(request);
  const response = await fetch(`${config.apiBaseUrl}/api/classify`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (response.status === 401) throw new Error('Your session expired; sign in again');
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  const payload: unknown = await response.json();
  return ClassificationResponseSchema.parse(payload).rules;
}

export async function getStoredRules(
  config: AppConfig,
  token: string,
  includeCommunity = false,
): Promise<{
  private: CategoryRule[];
  community: CategoryRule[];
  categories?: UserCategoryState | null;
}> {
  const query = includeCommunity ? '?include_community=true' : '';
  const response = await fetch(`${config.apiBaseUrl}/api/rules${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return readRuleCollection(response);
}

export async function replaceStoredRules(
  config: AppConfig,
  token: string,
  rules: CategoryRule[],
  categories?: UserCategoryState,
): Promise<void> {
  const response = await fetch(`${config.apiBaseUrl}/api/rules`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      rules,
      ...(categories ? { categories } : {}),
    }),
  });
  await readRuleCollection(response);
}

export async function contributeRules(
  config: AppConfig,
  token: string,
  rules: CategoryRule[],
): Promise<void> {
  const response = await fetch(`${config.apiBaseUrl}/api/community/rules`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ rules }),
  });
  await readRuleCollection(response);
}

export async function deleteStoredRules(config: AppConfig, token: string): Promise<void> {
  const response = await fetch(`${config.apiBaseUrl}/api/rules`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  await readRuleCollection(response);
}

export async function getStoredBudgets(
  config: AppConfig,
  token: string,
): Promise<BudgetPlan | null> {
  const response = await fetch(`${config.apiBaseUrl}/api/budgets`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status === 401) throw new Error('Your session expired; sign in again');
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Invalid budget response');
  }
  const value = payload as { budgets?: unknown };
  if (value.budgets == null) return null;
  const budgets = parseBudgetPlanValue(value.budgets);
  if (!budgets) throw new Error('Invalid budget response');
  return budgets;
}

export async function replaceStoredBudgets(
  config: AppConfig,
  token: string,
  budgets: BudgetPlan,
): Promise<void> {
  const response = await fetch(`${config.apiBaseUrl}/api/budgets`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ budgets }),
  });
  if (response.status === 401) throw new Error('Your session expired; sign in again');
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
}

export async function deleteStoredBudgets(config: AppConfig, token: string): Promise<void> {
  const response = await fetch(`${config.apiBaseUrl}/api/budgets`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status === 401) throw new Error('Your session expired; sign in again');
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
}

export async function deleteContributedRules(config: AppConfig, token: string): Promise<void> {
  const response = await fetch(`${config.apiBaseUrl}/api/community/rules`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  await readRuleCollection(response);
}
