import type { Transaction } from '../../types';
import { parseAmount, parseDate, rowError } from './parser';

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
    if (!date) return [];
    if (columns.length !== 8)
      throw rowError(
        columns,
        headerIndex + index + 1,
        'Expected 8 columns; check the CSV separator and quoting',
      );

    const purpose = String(columns[2] ?? '').trim();
    const amount = parseAmount(columns[6]);
    if (!Number.isFinite(amount))
      throw rowError(
        columns,
        headerIndex + index + 1,
        'Missing, invalid or ambiguous billed amount',
      );
    if (columns[7]?.trim().toUpperCase() !== 'EUR')
      throw rowError(columns, headerIndex + index + 1, 'Billed currency must be EUR');

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
