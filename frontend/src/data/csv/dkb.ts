import type { Transaction } from '../../types';
import { columnValue, normalizedColumn, parseAmount, parseDate, rowError } from './parser';

function isDkbHeader(columns: string[]): boolean {
  const first = normalizedColumn(columns[0]);
  return first === 'buchungstag' || first === 'buchungsdatum';
}

function optionalAmount(value: string, thousandsSeparator: '.' | ',' = '.'): number | undefined {
  if (!value) return undefined;
  const amount = parseAmount(value, thousandsSeparator);
  return Number.isFinite(amount) ? amount : undefined;
}

export function normalizeDkbRows(rows: string[][]): Transaction[] {
  const header = rows.find(isDkbHeader);
  return rows.flatMap((columns, index): Transaction[] => {
    const isLegacyFormat = header
      ? normalizedColumn(header[0]) === 'buchungstag'
      : columns.length === 12;
    const date = parseDate(columnValue(columns, header, ['Buchungstag', 'Buchungsdatum'], 0));
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

    const amountText = columnValue(
      columns,
      header,
      ['Umsatz', 'Betrag (€)', 'Betrag'],
      isLegacyFormat ? 8 : 15,
    );
    const amount = parseAmount(amountText, '.');
    if (!Number.isFinite(amount))
      throw rowError(columns, index, 'Missing, invalid or ambiguous amount');

    const isIncome = amount >= 0;
    const payer = columnValue(columns, header, ['Zahlungspflichtige*r', 'Zahlungspflichtiger']);
    const recipient = columnValue(
      columns,
      header,
      ['Zahlungsempfänger*in', 'Zahlungsempfänger', 'Empfänger', 'Auftraggeber / Begünstigter'],
      4,
    );
    const counterpartyName = (isIncome ? payer : recipient) || recipient || payer;
    const type =
      columnValue(columns, header, ['Art', 'Umsatztyp'], 6) || (isIncome ? 'Eingang' : 'Ausgang');
    const transaction: Transaction = {
      id: `${date}-${index}`,
      date,
      period: date.slice(0, 7),
      recipient: counterpartyName,
      purpose: columnValue(columns, header, ['Zweck', 'Verwendungszweck'], 5),
      type,
      amount,
      category: 'unknown',
      counterpartyName,
      counterpartyRole: isIncome ? 'payer' : 'recipient',
    };

    const valueDate = parseDate(columnValue(columns, header, ['Wertstellung'], 1));
    const status = columnValue(columns, header, ['Status']);
    const paymentMethod = columnValue(columns, header, ['Buchungstext'], 2);
    const bankReference =
      columnValue(columns, header, ['Kundenreferenz']) ||
      columnValue(columns, header, ['Mandatsreferenz']) ||
      columnValue(columns, header, ['Gläubiger-ID']);
    const balanceAfter = optionalAmount(columnValue(columns, header, ['Saldo'], 7));

    if (valueDate) transaction.valueDate = valueDate;
    if (status) transaction.status = status;
    if (paymentMethod) transaction.paymentMethod = paymentMethod;
    if (bankReference) transaction.bankReference = bankReference;
    if (balanceAfter !== undefined) transaction.balanceAfter = balanceAfter;

    return [transaction];
  });
}
