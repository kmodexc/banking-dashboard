import { describe, expect, it } from 'vitest';
import { normalizeRows, parseAmount, parseCsv, parseDate } from './csv';

describe('DKB CSV parsing', () => {
  it('parses quoted semicolon fields and German numbers', () => {
    const rows = parseCsv('01.01.2026;"REWE; Markt";1.234,56');
    expect(rows).toEqual([['01.01.2026', 'REWE; Markt', '1.234,56']]);
    expect(parseAmount('1.234,56 €')).toBe(1234.56);
  });

  it('normalizes a DKB transaction row and skips headers', () => {
    const rows = parseCsv(
      [
        'Buchungstag;Wertstellung;Buchungstext;Kontonummer;Empfänger;Zweck;Art;Saldo;Umsatz;A;B;C',
        '02.01.2026;02.01.2026;Kartenzahlung;;UNKNOWN SHOP;Sonstiges;Ausgang;;-8,00;;;',
      ].join('\n'),
    );
    expect(normalizeRows(rows)).toEqual([
      {
        id: '2026-01-02-1',
        date: '2026-01-02',
        period: '2026-01',
        recipient: 'UNKNOWN SHOP',
        purpose: 'Sonstiges',
        type: 'Ausgang',
        amount: -8,
        category: 'unknown',
      },
    ]);
  });

  it('normalizes DKB date variants', () => {
    expect(parseDate('020126')).toBe('2026-01-02');
    expect(parseDate('2/1/2026')).toBe('2026-01-02');
    expect(parseDate('invalid')).toBe('');
  });
});
