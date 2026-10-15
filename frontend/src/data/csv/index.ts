import type { Transaction } from '../../types';
import { isDeutscheBankHeader, normalizeDeutscheBankRows } from './deutsche-bank';
import { normalizeDkbRows } from './dkb';
import { parseCsv, rowError } from './parser';

export { parseAmount, parseCsv, parseDate } from './parser';

export function normalizeRows(rows: string[][]): Transaction[] {
  const deutscheBankHeaderIndex = rows.findIndex(isDeutscheBankHeader);
  if (deutscheBankHeaderIndex >= 0) {
    return normalizeDeutscheBankRows(rows, deutscheBankHeaderIndex);
  }

  return normalizeDkbRows(rows);
}

export async function readTransactions(file: File): Promise<Transaction[]> {
  const rows = parseCsv(await file.text());
  const transactions = normalizeRows(rows);
  if (!transactions.length) {
    if (rows[0])
      throw rowError(
        rows[0],
        0,
        'No valid transaction rows were found; check the format and separator',
      );
    throw new Error('No valid transaction rows were found: the file is empty');
  }
  return transactions;
}
