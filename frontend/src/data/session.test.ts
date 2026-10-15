import { beforeEach, describe, expect, it } from 'vitest';
import {
  loadSessionTransactions,
  saveSessionTransactions,
  TRANSACTIONS_SESSION_KEY,
} from './session';

describe('transaction session storage', () => {
  beforeEach(() => sessionStorage.clear());

  it('ignores malformed or schema-incompatible saved data', () => {
    sessionStorage.setItem(TRANSACTIONS_SESSION_KEY, '{not-json');
    expect(loadSessionTransactions()).toEqual([]);

    sessionStorage.setItem(TRANSACTIONS_SESSION_KEY, JSON.stringify([{ id: 'missing-fields' }]));
    expect(loadSessionTransactions()).toEqual([]);
  });

  it('round-trips valid transactions and clears the key for an empty session', () => {
    const transactions = [
      {
        id: '2026-01-02-1',
        date: '2026-01-02',
        period: '2026-01',
        recipient: 'SHOP',
        purpose: 'Groceries',
        type: 'Ausgang',
        amount: -8,
        category: 'unknown',
      },
    ];

    saveSessionTransactions(transactions);
    expect(loadSessionTransactions()).toEqual(transactions);

    saveSessionTransactions([]);
    expect(sessionStorage.getItem(TRANSACTIONS_SESSION_KEY)).toBeNull();
    expect(loadSessionTransactions()).toEqual([]);
  });
});
