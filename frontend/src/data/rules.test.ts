import { beforeEach, describe, expect, it } from 'vitest';
import {
  applyRules,
  deduplicateRules,
  loadLocalRules,
  matchesRule,
  saveLocalRules,
  unknownTransactions,
} from './rules';
import type { CategoryRule, Transaction } from '../types';

const transaction: Transaction = {
  id: '1',
  date: '2026-01-02',
  period: '2026-01',
  recipient: 'UNKNOWN SHOP',
  purpose: 'Card payment',
  type: 'Ausgang',
  amount: -8,
  category: 'unknown',
};

describe('categorization rules', () => {
  beforeEach(() => localStorage.clear());

  it('deduplicates rules using the same case-insensitive server key', () => {
    const rules: CategoryRule[] = [
      { keyword: 'SPC.CAFE', category: 'restaurant', column: 'recipient' },
      { keyword: 'spc.cafe', category: 'Restaurant', column: 'recipient', confidence: 0.9 },
      { keyword: 'SPC.CAFE', category: 'restaurant', column: 'purpose' },
    ];

    expect(deduplicateRules(rules)).toEqual([rules[0], rules[2]]);
  });

  it('matches recipient and purpose rules without mutating transactions', () => {
    const rules: CategoryRule[] = [{ keyword: 'unknown', category: 'items', column: 'recipient' }];
    const result = applyRules([transaction], rules);
    expect(result[0]?.category).toBe('items');
    expect(transaction.category).toBe('unknown');
  });

  it('returns only unknown outgoing transactions', () => {
    expect(
      unknownTransactions([
        transaction,
        { ...transaction, id: '2', type: 'Eingang' },
        { ...transaction, id: '3', category: 'items' },
      ]),
    ).toHaveLength(1);
  });

  it('matches rules against the configured transaction fields', () => {
    expect(
      matchesRule(
        { ...transaction, recipient: 'Transit Provider', purpose: 'Monthly pass' },
        { keyword: 'monthly', category: 'vacation', column: 'purpose' },
      ),
    ).toBe(true);
    expect(
      matchesRule(
        { ...transaction, recipient: 'Transit Provider', purpose: 'Monthly pass' },
        { keyword: 'transit', category: 'vacation', column: 'both' },
      ),
    ).toBe(true);
    expect(
      matchesRule(
        { ...transaction, recipient: 'Transit Provider', purpose: 'Monthly pass' },
        { keyword: 'monthly', category: 'vacation', column: 'recipient' },
      ),
    ).toBe(false);
  });

  it('restores custom browser rules after a reload', () => {
    const customRule: CategoryRule = {
      keyword: 'MY CUSTOM SHOP',
      category: 'my-category',
      column: 'recipient',
    };

    saveLocalRules([customRule]);

    expect(loadLocalRules()).toEqual([customRule]);
  });
});
