import { describe, expect, it } from 'vitest';
import {
  categoryEntries,
  categoryName,
  parseImportedCategoryState,
  serializeUserCategoryState,
  type UserCategoryState,
} from './categories';

describe('user category state', () => {
  it('keeps unchanged categories global and marks customized categories as user-specific', () => {
    const state: UserCategoryState = {
      renamed: { groceries: 'Food' },
      deleted: ['mix'],
      added: ['health'],
    };
    const entries = categoryEntries(state);

    expect(entries.find((entry) => entry.name === 'Food')).toMatchObject({
      source: 'user',
      globalName: 'groceries',
    });
    expect(entries.find((entry) => entry.name === 'restaurant')).toMatchObject({
      source: 'global',
    });
    expect(entries.some((entry) => entry.name === 'mix')).toBe(false);
    expect(entries.find((entry) => entry.name === 'health')).toMatchObject({
      source: 'user',
    });
  });

  it('maps renamed categories and deleted categories to unknown assignments', () => {
    const state: UserCategoryState = {
      renamed: { groceries: 'Food' },
      deleted: ['mix'],
      added: [],
    };

    expect(categoryName(state, 'groceries')).toBe('Food');
    expect(categoryName(state, 'mix')).toBe('unknown');
    expect(categoryName(state, 'restaurant')).toBe('restaurant');
  });

  it('round-trips the import/export format', () => {
    const state: UserCategoryState = {
      renamed: { groceries: 'Food' },
      deleted: ['mix'],
      added: ['health'],
    };

    expect(parseImportedCategoryState(serializeUserCategoryState(state))).toEqual(state);
    expect(parseImportedCategoryState('{"invalid":true}')).toBeNull();
  });
});
