import { z } from 'zod';
import { DEFAULT_CATEGORIES } from '../types';

export const USER_CATEGORIES_KEY = 'dkb-dashboard-user-categories-v1';

const CategorySchema = z
  .object({
    id: z.string().min(1).max(160),
    name: z.string().min(1).max(80),
    aliases: z.array(z.string().min(1).max(80)).default([]),
  })
  .strict();

const UserCategoryStateSchema = z
  .object({
    categories: z.array(CategorySchema).default([]),
    deletedIds: z.array(z.string().min(1).max(160)).default([]),
  })
  .strict();

const LegacyUserCategoryStateSchema = z
  .object({
    renamed: z.record(z.string(), z.string().min(1).max(80)).default({}),
    deleted: z.array(z.string().min(1).max(80)).default([]),
    added: z.array(z.string().min(1).max(80)).default([]),
  })
  .strict();

export interface UserCategory {
  id: string;
  name: string;
  aliases: string[];
}

export interface UserCategoryState {
  categories: UserCategory[];
  deletedIds: string[];
}

export interface CategoryEntry extends UserCategory {
  key: string;
  source: 'user';
}

function defaultCategoryId(name: string): string {
  return `default:${name}`;
}

function legacyCategoryId(name: string): string {
  return `legacy:${encodeURIComponent(name.trim().toLocaleLowerCase())}`;
}

function newCategoryId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `user:${crypto.randomUUID()}`;
  return `user:${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export const EMPTY_USER_CATEGORY_STATE: UserCategoryState = {
  categories: DEFAULT_CATEGORIES.map((name) => ({
    id: defaultCategoryId(name),
    name,
    aliases: [],
  })),
  deletedIds: [],
};

function normalizeState(value: z.infer<typeof UserCategoryStateSchema>): UserCategoryState {
  const deletedIds = [...new Set(value.deletedIds)];
  const seen = new Set<string>();
  const categories = value.categories.flatMap((category) => {
    if (seen.has(category.id) || deletedIds.includes(category.id)) return [];
    seen.add(category.id);
    const name = category.name.trim();
    return [
      {
        id: category.id,
        name,
        aliases: [...new Set(category.aliases.map((alias) => alias.trim()))].filter(
          (alias) => alias !== name,
        ),
      },
    ];
  });
  return { categories, deletedIds };
}

function migrateLegacyState(
  value: z.infer<typeof LegacyUserCategoryStateSchema>,
): UserCategoryState {
  const deletedNames = new Set(value.deleted);
  const categories: UserCategory[] = [];
  const deletedIds: string[] = [];
  const add = (id: string, originalName: string, name: string): void => {
    const normalized = name.trim();
    if (deletedNames.has(originalName) || deletedNames.has(normalized)) {
      deletedIds.push(id);
      return;
    }
    categories.push({
      id,
      name: normalized,
      aliases: normalized === originalName ? [] : [originalName],
    });
  };
  DEFAULT_CATEGORIES.forEach((name) =>
    add(defaultCategoryId(name), name, value.renamed[name] ?? name),
  );
  value.added.forEach((name) => add(legacyCategoryId(name), name, value.renamed[name] ?? name));
  return normalizeState({ categories, deletedIds });
}

export function parseUserCategoryState(value: string | null): UserCategoryState {
  if (!value) return EMPTY_USER_CATEGORY_STATE;
  try {
    const parsed: unknown = JSON.parse(value);
    const current = UserCategoryStateSchema.safeParse(parsed);
    if (current.success) return normalizeState(current.data);
    const legacy = LegacyUserCategoryStateSchema.safeParse(parsed);
    return legacy.success ? migrateLegacyState(legacy.data) : EMPTY_USER_CATEGORY_STATE;
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
    const parsed: unknown = JSON.parse(value);
    const current = UserCategoryStateSchema.safeParse(parsed);
    if (current.success) return normalizeState(current.data);
    const legacy = LegacyUserCategoryStateSchema.safeParse(parsed);
    return legacy.success ? migrateLegacyState(legacy.data) : null;
  } catch {
    return null;
  }
}

export function serializeUserCategoryState(state: UserCategoryState): string {
  return `${JSON.stringify(normalizeState(state), null, 2)}\n`;
}

export function categoryName(state: UserCategoryState, idOrName: string): string {
  if (state.deletedIds.includes(idOrName)) return 'unknown';
  const normalized = idOrName.toLocaleLowerCase();
  const entry = state.categories.find(
    (candidate) =>
      candidate.id === idOrName ||
      candidate.name.toLocaleLowerCase() === normalized ||
      candidate.aliases.some((alias) => alias.toLocaleLowerCase() === normalized),
  );
  return entry?.name ?? idOrName;
}

export function categoryEntries(
  state: UserCategoryState,
  extraUserCategories: string[] = [],
): CategoryEntry[] {
  const entries: CategoryEntry[] = state.categories.map((category) => ({
    ...category,
    key: category.id,
    source: 'user' as const,
  }));
  const knownIds = new Set(entries.map((entry) => entry.id));
  const knownNames = new Set(
    entries
      .flatMap((entry) => [entry.name, ...entry.aliases])
      .map((name) => name.toLocaleLowerCase()),
  );
  for (const name of extraUserCategories) {
    const normalized = name.trim();
    if (!normalized || knownNames.has(normalized.toLocaleLowerCase())) continue;
    const id = legacyCategoryId(normalized);
    if (knownIds.has(id)) continue;
    knownIds.add(id);
    knownNames.add(normalized.toLocaleLowerCase());
    entries.push({ id, name: normalized, aliases: [], key: id, source: 'user' });
  }
  return entries;
}

export function mergeCategoryStates(
  local: UserCategoryState,
  remote: UserCategoryState,
): UserCategoryState {
  const byId = new Map(local.categories.map((category) => [category.id, category]));
  remote.categories.forEach((category) => {
    const existing = byId.get(category.id);
    byId.set(category.id, {
      ...category,
      aliases: [...new Set([...(existing?.aliases ?? []), ...category.aliases])],
    });
  });
  const deletedIds = [...new Set([...local.deletedIds, ...remote.deletedIds])];
  return normalizeState({ categories: [...byId.values()], deletedIds });
}

export function categoryStateWithAdded(state: UserCategoryState, name: string): UserCategoryState {
  const normalized = name.trim();
  if (!normalized) return state;
  return {
    ...state,
    categories: [...state.categories, { id: newCategoryId(), name: normalized, aliases: [] }],
  };
}
