import { CategoryRuleSchema } from '../types';
import type { CategoryRule, RuleColumn, Transaction } from '../types';

export const RULES_KEY = 'dkb-dashboard-rules-v1';
export const CATEGORY_OVERRIDES_KEY = 'dkb-dashboard-category-overrides-v1';

export function parseRules(value: string | null): CategoryRule[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return deduplicateRules(
      parsed.flatMap((rule) => {
        const result = CategoryRuleSchema.safeParse(rule);
        return result.success ? [result.data] : [];
      }),
    );
  } catch {
    return [];
  }
}

export function deduplicateRules(rules: CategoryRule[]): CategoryRule[] {
  const seen = new Set<string>();
  return rules.filter((rule) => {
    const key = ruleKey(rule);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function ruleKey(rule: CategoryRule): string {
  return `${rule.keyword.toLowerCase()}\u0000${rule.category.toLowerCase()}\u0000${rule.column}`;
}

export function loadLocalRules(): CategoryRule[] {
  return parseRules(localStorage.getItem(RULES_KEY));
}

export function saveLocalRules(rules: CategoryRule[]): void {
  localStorage.setItem(RULES_KEY, JSON.stringify(rules));
}

export function parseImportedRules(value: string): CategoryRule[] | null {
  try {
    const result = CategoryRuleSchema.array().safeParse(JSON.parse(value) as unknown);
    return result.success ? deduplicateRules(result.data) : null;
  } catch {
    return null;
  }
}

export function serializeRules(rules: CategoryRule[]): string {
  return `${JSON.stringify(deduplicateRules(rules), null, 2)}\n`;
}

export function loadCategoryOverrides(): Record<string, string> {
  const value = localStorage.getItem(CATEGORY_OVERRIDES_KEY);
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.entries(parsed).reduce<Record<string, string>>((result, [id, category]) => {
      if (typeof category === 'string' && category.trim()) result[id] = category;
      return result;
    }, {});
  } catch {
    return {};
  }
}

export function saveCategoryOverrides(overrides: Record<string, string>): void {
  localStorage.setItem(CATEGORY_OVERRIDES_KEY, JSON.stringify(overrides));
}

export function applyRules(transactions: Transaction[], rules: CategoryRule[]): Transaction[] {
  return transactions.map((transaction) => {
    const categoryRule = rules.find((rule) => matchesRule(transaction, rule));
    return { ...transaction, category: categoryRule?.category ?? 'unknown' };
  });
}

export function matchesRule(transaction: Transaction, rule: CategoryRule): boolean {
  const keyword = rule.keyword.toLocaleLowerCase();
  const recipient = transaction.recipient.toLocaleLowerCase();
  const purpose = transaction.purpose.toLocaleLowerCase();
  return (
    (rule.column === 'recipient' && recipient.includes(keyword)) ||
    (rule.column === 'purpose' && purpose.includes(keyword)) ||
    (rule.column === 'both' && (recipient.includes(keyword) || purpose.includes(keyword)))
  );
}

export function applyCategoryOverrides(
  transactions: Transaction[],
  overrides: Record<string, string>,
): Transaction[] {
  return transactions.map((transaction) => ({
    ...transaction,
    category: overrides[transaction.id] ?? transaction.category,
  }));
}

export function unknownTransactions(transactions: Transaction[]): Transaction[] {
  return transactions
    .filter((transaction) => transaction.type === 'Ausgang' && transaction.category === 'unknown')
    .sort((left, right) => right.date.localeCompare(left.date));
}

export function ruleFromForm(keyword: string, category: string, column: RuleColumn): CategoryRule {
  return { keyword: keyword.trim(), category: category.trim(), column };
}
