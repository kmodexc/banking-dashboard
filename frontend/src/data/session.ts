import { TransactionSchema } from '../types';
import type { Transaction } from '../types';

export const TRANSACTIONS_SESSION_KEY = 'dkb-dashboard-transactions-v1';

export function loadSessionTransactions(): Transaction[] {
  try {
    const value = sessionStorage.getItem(TRANSACTIONS_SESSION_KEY);
    if (!value) return [];
    const result = TransactionSchema.array().safeParse(JSON.parse(value) as unknown);
    return result.success ? result.data : [];
  } catch {
    return [];
  }
}

export function saveSessionTransactions(transactions: Transaction[]): void {
  try {
    if (transactions.length) {
      sessionStorage.setItem(TRANSACTIONS_SESSION_KEY, JSON.stringify(transactions));
    } else {
      sessionStorage.removeItem(TRANSACTIONS_SESSION_KEY);
    }
  } catch {
    // Session persistence is best effort; the in-memory dashboard remains usable.
  }
}
