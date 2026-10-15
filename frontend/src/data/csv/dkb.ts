import type { Transaction } from '../../types';
import { parseAmount, parseDate } from './parser';

export function normalizeDkbRows(rows: string[][]): Transaction[] {
  return rows.flatMap((columns, index): Transaction[] => {
    const date = parseDate(columns[0]);
    if (!date || columns.length < 12) return [];

    const isLegacyFormat = columns.length === 12;
    const amount = parseAmount(isLegacyFormat ? columns[8] : (columns[15] ?? columns[16]));
    if (!Number.isFinite(amount)) return [];

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
