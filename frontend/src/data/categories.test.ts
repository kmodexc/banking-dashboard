import { describe, expect, it } from 'vitest';
import {
  categoryEntries,
  categoryName,
  EMPTY_USER_CATEGORY_STATE,
  mergeCategoryStates,
  parseImportedCategoryState,
  serializeUserCategoryState,
  type UserCategoryState,
} from './categories';

describe('user category state', () => {
  it('uses stable ids and keeps renamed categories associated with their rules', () => {
    const state: UserCategoryState = {
      categories: [
        { id: 'category-1', name: 'Food', aliases: ['groceries'] },
        { id: 'category-2', name: 'health', aliases: [] },
      ],
      deletedIds: [],
    };

    expect(categoryEntries(state)[0]).toMatchObject({ id: 'category-1', key: 'category-1' });
    expect(categoryName(state, 'category-1')).toBe('Food');
    expect(categoryName(state, 'groceries')).toBe('Food');
  });

  it('merges categories by id rather than by display name', () => {
    const local: UserCategoryState = {
      categories: [
        { id: 'same-id', name: 'Food', aliases: [] },
        { id: 'local-only', name: 'Travel', aliases: [] },
      ],
      deletedIds: [],
    };
    const remote: UserCategoryState = {
      categories: [
        { id: 'same-id', name: 'Groceries', aliases: [] },
        { id: 'remote-only', name: 'Travel', aliases: [] },
      ],
      deletedIds: [],
    };

    expect(mergeCategoryStates(local, remote).categories).toEqual([
      { id: 'same-id', name: 'Groceries', aliases: [] },
      { id: 'local-only', name: 'Travel', aliases: [] },
      { id: 'remote-only', name: 'Travel', aliases: [] },
    ]);
  });

  it('maps deleted categories to unknown assignments', () => {
    const state: UserCategoryState = {
      categories: [{ id: 'category-1', name: 'Food', aliases: ['groceries'] }],
      deletedIds: ['category-2'],
    };

    expect(categoryName(state, 'category-2')).toBe('unknown');
    expect(categoryName(state, 'category-1')).toBe('Food');
  });

  it('imports legacy category state and round-trips the new format', () => {
    const imported = parseImportedCategoryState(
      '{"renamed":{"groceries":"Food"},"deleted":["mix"],"added":["health"]}',
    );
    expect(
      imported?.categories.find((category) => category.id === 'default:groceries'),
    ).toMatchObject({ name: 'Food', aliases: ['groceries'] });
    expect(imported?.deletedIds).toContain('default:mix');
    expect(imported?.categories.some((category) => category.name === 'health')).toBe(true);
    expect(
      parseImportedCategoryState(serializeUserCategoryState(EMPTY_USER_CATEGORY_STATE)),
    ).toEqual(EMPTY_USER_CATEGORY_STATE);
    expect(parseImportedCategoryState('{"invalid":true}')).toBeNull();
  });
});
