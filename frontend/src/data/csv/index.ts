import type { Transaction } from '../../types';
import { isDeutscheBankHeader, normalizeDeutscheBankRows } from './deutsche-bank';
import { normalizeDkbRows } from './dkb';
import { parseCsv } from './parser';

export { parseAmount, parseCsv, parseDate } from './parser';

export function normalizeRows(rows: string[][]): Transaction[] {
  const deutscheBankHeaderIndex = rows.findIndex(isDeutscheBankHeader);
  if (deutscheBankHeaderIndex >= 0) {
    return normalizeDeutscheBankRows(rows, deutscheBankHeaderIndex);
  }

  return normalizeDkbRows(rows);
}

export async function readTransactions(file: File): Promise<Transaction[]> {
  const transactions = normalizeRows(parseCsv(await file.text()));
  if (!transactions.length) throw new Error('No valid transaction rows were found');
  return transactions;
}
