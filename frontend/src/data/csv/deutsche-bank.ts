import type { Transaction } from '../../types';
import { parseAmount, parseDate, rowError } from './parser';

function normalizedHeader(value: string | undefined): string {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase();
}

function parseExchangeRate(value: string | undefined): number | undefined {
  const normalized = String(value ?? '')
    .trim()
    .replace(',', '.');
  if (!normalized) return undefined;
  const rate = Number(normalized);
  return Number.isFinite(rate) ? rate : undefined;
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
    const currency = columns[7]?.trim().toUpperCase();
    if (currency !== 'EUR')
      throw rowError(columns, headerIndex + index + 1, 'Billed currency must be EUR');

    const originalAmount = parseAmount(columns[4]);
    const originalCurrency = columns[3]?.trim().toUpperCase();
    const exchangeRate = parseExchangeRate(columns[5]);
    const counterpartyName = purpose.split(',')[0]?.trim() ?? '';
    const transaction: Transaction = {
      id: `${date}-${headerIndex + index + 1}`,
      date,
      period: date.slice(0, 7),
      recipient: counterpartyName,
      purpose,
      type: amount < 0 ? 'Ausgang' : 'Eingang',
      amount,
      category: 'unknown',
      counterpartyName,
      counterpartyRole: amount < 0 ? 'recipient' : 'payer',
      currency,
    };

    const valueDate = parseDate(columns[1]);
    if (valueDate) transaction.valueDate = valueDate;
    if (Number.isFinite(originalAmount)) transaction.originalAmount = originalAmount;
    if (originalCurrency) transaction.originalCurrency = originalCurrency;
    if (exchangeRate !== undefined) transaction.exchangeRate = exchangeRate;

    return [transaction];
  });
}
