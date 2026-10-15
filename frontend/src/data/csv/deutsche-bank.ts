import type { Transaction } from '../../types';
import { parseAmount, parseDate } from './parser';

function normalizedHeader(value: string | undefined): string {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase();
}

export function isDeutscheBankHeader(columns: string[]): boolean {
  return (
    normalizedHeader(columns[0]) === 'belegdatum' &&
    normalizedHeader(columns[1]) === 'eingangstag' &&
    normalizedHeader(columns[2]) === 'verwendungszweck' &&
    normalizedHeader(columns[4]) === 'betrag' &&
    normalizedHeader(columns[7]) === 'währung'
  );
}

export function normalizeDeutscheBankRows(rows: string[][], headerIndex: number): Transaction[] {
  return rows.slice(headerIndex + 1).flatMap((columns, index): Transaction[] => {
    const date = parseDate(columns[0]);
    if (!date || columns.length < 8) return [];

    const purpose = String(columns[2] ?? '').trim();
    const amount = parseAmount(columns[6] || columns[4]);
    if (!Number.isFinite(amount)) return [];

    return [
      {
        id: `${date}-${headerIndex + index + 1}`,
        date,
        period: date.slice(0, 7),
        recipient: purpose.split(',')[0]?.trim() ?? '',
        purpose,
        type: amount < 0 ? 'Ausgang' : 'Eingang',
        amount,
        category: 'unknown',
      },
    ];
  });
}
