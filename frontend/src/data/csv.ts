import type { Transaction } from '../types';

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ';' && !quoted) {
      row.push(field);
      field = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(field);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }

  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function parseDate(value: string | undefined): string {
  const clean = String(value ?? '')
    .trim()
    .replace(/^"|"$/g, '');
  let match = clean.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/);
  if (!match) match = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match && /^\d{6}$/.test(clean)) {
    return `20${clean.slice(4, 6)}-${clean.slice(2, 4)}-${clean.slice(0, 2)}`;
  }
  if (!match) return '';
  const [, day, month, rawYear] = match;
  if (!day || !month || !rawYear) return '';
  const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

export function parseAmount(value: string | undefined): number {
  let clean = String(value ?? '').replace(/[€\s]/g, '');
  if (clean.includes(',') && clean.includes('.')) {
    clean =
      clean.lastIndexOf(',') > clean.lastIndexOf('.')
        ? clean.replace(/\./g, '').replace(',', '.')
        : clean.replace(/,/g, '');
  } else {
    clean = clean.replace(',', '.');
  }
  const amount = Number(clean);
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : Number.NaN;
}

export function normalizeRows(rows: string[][]): Transaction[] {
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

export async function readTransactions(file: File): Promise<Transaction[]> {
  const transactions = normalizeRows(parseCsv(await file.text()));
  if (!transactions.length) throw new Error('No valid transaction rows were found');
  return transactions;
}
