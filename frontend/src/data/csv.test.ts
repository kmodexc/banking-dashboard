import { describe, expect, it } from 'vitest';
import { normalizeRows, parseAmount, parseCsv, parseDate } from './csv';

describe('CSV parsing', () => {
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

  it('imports Deutsche Bank credit card exports', () => {
    const rows = parseCsv(
      [
        '\uFEFFKreditkartentransaktionen',
        'Kreditkarte;Kundennummer;Kartennummer;Karteninhaber',
        'Deutsche Bank Card Virtual;220 6433031;5354********5493;YIFEI PENG',
        '',
        '1.9.2026 - 30.9.2026',
        'Belegdatum;Eingangstag;Verwendungszweck;Fremdwährung;Betrag;Kurs;Betrag;Währung',
        '25.9.2026;28.9.2026;APPLE.COM/BILL, UNKNOWN CORK, IRL, IRL;EUR;-2,99;1,00000;-2,99;EUR',
        '3.9.2026;3.9.2026;Mol*WeWash GmbH, 80336 9800939274266, DEU;EUR;-8,4;1,00000;-8,4;EUR',
      ].join('\n'),
    );

    expect(normalizeRows(rows)).toEqual([
      {
        id: '2026-09-25-5',
        date: '2026-09-25',
        period: '2026-09',
        recipient: 'APPLE.COM/BILL',
        purpose: 'APPLE.COM/BILL, UNKNOWN CORK, IRL, IRL',
        type: 'Ausgang',
        amount: -2.99,
        category: 'unknown',
      },
      {
        id: '2026-09-03-6',
        date: '2026-09-03',
        period: '2026-09',
        recipient: 'Mol*WeWash GmbH',
        purpose: 'Mol*WeWash GmbH, 80336 9800939274266, DEU',
        type: 'Ausgang',
        amount: -8.4,
        category: 'unknown',
      },
    ]);
  });
});
