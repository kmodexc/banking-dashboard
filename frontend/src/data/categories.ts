import { z } from 'zod';
import { DEFAULT_CATEGORIES } from '../types';

export const USER_CATEGORIES_KEY = 'dkb-dashboard-user-categories-v1';

const UserCategoryStateSchema = z
  .object({
    renamed: z.record(z.string(), z.string().min(1).max(80)).default({}),
    deleted: z.array(z.string().min(1).max(80)).default([]),
    added: z.array(z.string().min(1).max(80)).default([]),
  })
  .strict();

export interface UserCategoryState {
  renamed: Record<string, string>;
  deleted: string[];
  added: string[];
}

export interface CategoryEntry {
  key: string;
  name: string;
  source: 'global' | 'user';
  globalName?: string;
}

export const EMPTY_USER_CATEGORY_STATE: UserCategoryState = {
  renamed: {},
  deleted: [],
  added: [],
};

function normalizeState(value: z.infer<typeof UserCategoryStateSchema>): UserCategoryState {
  const globalNames = new Set<string>(DEFAULT_CATEGORIES);
  const deleted = [...new Set(value.deleted)];
  const added = [...new Set(value.added)].filter(
    (name) => !globalNames.has(name) && !deleted.includes(name),
  );
  const renamed = Object.entries(value.renamed).reduce<Record<string, string>>(
    (result, [originalName, name]) => {
      if (name !== originalName && !deleted.includes(originalName) && !deleted.includes(name)) {
        result[originalName] = name.trim();
      }
      return result;
    },
    {},
  );
  return { renamed, deleted, added };
}

export function parseUserCategoryState(value: string | null): UserCategoryState {
  if (!value) return EMPTY_USER_CATEGORY_STATE;
  try {
    const result = UserCategoryStateSchema.safeParse(JSON.parse(value) as unknown);
    return result.success ? normalizeState(result.data) : EMPTY_USER_CATEGORY_STATE;
  } catch {
    return EMPTY_USER_CATEGORY_STATE;
  }
}

function scopedStorageKey(userId: string | null): string | null {
  return userId ? `${USER_CATEGORIES_KEY}:${encodeURIComponent(userId)}` : null;
}

export function loadUserCategoryState(userId: string | null): UserCategoryState {
  const key = scopedStorageKey(userId);
  return key ? parseUserCategoryState(localStorage.getItem(key)) : EMPTY_USER_CATEGORY_STATE;
}

export function saveUserCategoryState(state: UserCategoryState, userId: string | null): void {
  const key = scopedStorageKey(userId);
  if (key) localStorage.setItem(key, JSON.stringify(normalizeState(state)));
}

export function parseImportedCategoryState(value: string): UserCategoryState | null {
  try {
    const result = UserCategoryStateSchema.safeParse(JSON.parse(value) as unknown);
    return result.success ? normalizeState(result.data) : null;
  } catch {
    return null;
  }
}

export function serializeUserCategoryState(state: UserCategoryState): string {
  return `${JSON.stringify(normalizeState(state), null, 2)}\n`;
}

export function categoryName(state: UserCategoryState, name: string): string {
  if (state.deleted.includes(name)) return 'unknown';
  let current = name;
  for (let index = 0; index < 10; index += 1) {
    const next = state.renamed[current];
    if (!next || next === current) break;
    current = next;
    if (state.deleted.includes(current)) return 'unknown';
  }
  return current;
}

export function categoryEntries(
  state: UserCategoryState,
  extraUserCategories: string[] = [],
): CategoryEntry[] {
  const entries: CategoryEntry[] = DEFAULT_CATEGORIES.flatMap((globalName) => {
    if (state.deleted.includes(globalName)) return [];
    const name = state.renamed[globalName] ?? globalName;
    return [
      {
        key: `global:${globalName}`,
        name,
        source: state.renamed[globalName] ? ('user' as const) : ('global' as const),
        ...(state.renamed[globalName] ? { globalName } : {}),
      },
    ];
  });
  const names = new Set(entries.map((entry) => entry.name.toLocaleLowerCase()));
  for (const name of [...state.added, ...extraUserCategories]) {
    const normalized = name.trim();
    if (!normalized || state.deleted.includes(normalized)) continue;
    const key = normalized.toLocaleLowerCase();
    if (names.has(key)) continue;
    names.add(key);
    entries.push({ key: `user:${normalized}`, name: normalized, source: 'user' });
  }
  return entries;
}

export function categoryStateWithAdded(state: UserCategoryState, name: string): UserCategoryState {
  const normalized = name.trim();
  if (!normalized) return state;
  return {
    ...state,
    deleted: state.deleted.filter((value) => value !== normalized),
    added: [...new Set([...state.added, normalized])],
  };
}
