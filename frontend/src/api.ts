import {
  CategoryRuleSchema,
  ClassificationRequestSchema,
  ClassificationResponseSchema,
} from './types';
import type { AppConfig, CategoryRule, ClassificationRule } from './types';

const RuleListSchema = CategoryRuleSchema.array();

async function readRuleCollection(response: Response): Promise<{
  private: CategoryRule[];
  community: CategoryRule[];
}> {
  if (response.status === 401) throw new Error('Your session expired; sign in again');
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Invalid rule response');
  }
  const value = payload as { private?: unknown; community?: unknown };
  return {
    private: RuleListSchema.parse(value.private ?? []),
    community: RuleListSchema.parse(value.community ?? []),
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
  includeCommunity: boolean,
): Promise<{ private: CategoryRule[]; community: CategoryRule[] }> {
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
): Promise<void> {
  const response = await fetch(`${config.apiBaseUrl}/api/rules`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ rules }),
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

export async function deleteContributedRules(config: AppConfig, token: string): Promise<void> {
  const response = await fetch(`${config.apiBaseUrl}/api/community/rules`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  await readRuleCollection(response);
}
