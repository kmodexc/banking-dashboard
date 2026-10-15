import type { Transaction } from '../../types';
import { parseAmount, parseDate, rowError } from './parser';

export function normalizeDkbRows(rows: string[][]): Transaction[] {
  const header = rows.find((columns) => columns[0]?.trim().toLowerCase() === 'buchungstag');
  return rows.flatMap((columns, index): Transaction[] => {
    const date = parseDate(columns[0]);
    if (!date) {
      if (/^\d{1,2}[./]\d{1,2}[./]\d{2,4}[,;\t]/.test(columns[0] ?? ''))
        throw rowError(columns, index, 'Unsupported CSV separator');
      return [];
    }
    if (
      columns.length < 12 ||
      (columns.length > 12 && columns.length < 16) ||
      (header && columns.length !== header.length)
    )
      throw rowError(
        columns,
        index,
        'Unexpected column count; check the CSV separator and quoting',
      );

    const isLegacyFormat = columns.length === 12;
    const amount = parseAmount(isLegacyFormat ? columns[8] : (columns[15] ?? columns[16]));
    if (!Number.isFinite(amount))
      throw rowError(columns, index, 'Missing, invalid or ambiguous amount');

    const recipient = isLegacyFormat ? columns[4] : columns[3];
    const purpose = isLegacyFormat ? columns[5] : columns[4];
    const type = isLegacyFormat ? columns[6] : amount < 0 ? 'Ausgang' : 'Eingang';
    return [
      {
        id: `${date}-${index}`,
        date,
        period: date.slice(0, 7),
        recipient: recipient ?? '',
        purpose: purpose ?? '',
        type: type ?? (amount < 0 ? 'Ausgang' : 'Eingang'),
        amount,
        category: 'unknown',
      },
    ];
  });
}
