import { describe, expect, it } from 'vitest';
import deutscheBankExample from '../../../data/example/deutsche_bank_example.csv?raw';
import dkbExample from '../../../data/example/dkb_example.csv?raw';
import { normalizeRows, parseAmount, parseCsv, parseDate, readTransactions } from './csv';

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

  it('parses the checked-in DKB example export', async () => {
    const transactions = await readTransactions(
      new File([dkbExample], 'dkb_example.csv', { type: 'text/csv' }),
    );

    expect(transactions).toEqual([
      {
        id: '2026-09-30-4',
        date: '2026-09-30',
        period: '2026-09',
        recipient: 'EDEKA',
        purpose: 'VISA Debitkartenumsatz vom 29.09.2026',
        type: 'Ausgang',
        amount: -35.41,
        category: 'unknown',
      },
    ]);
  });

  it('parses the checked-in Deutsche Bank example export', async () => {
    const transactions = await readTransactions(
      new File([deutscheBankExample], 'deutsche_bank_example.csv', { type: 'text/csv' }),
    );

    expect(transactions).toEqual([
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

const validAmounts = [
  ['1.234,56', 1234.56],
  ['1,234.56', 1234.56],
  ['1.234.567', 1234567],
  ['1,234,567', 1234567],
  ['1.234.567,89', 1234567.89],
  ['1,234,567.89', 1234567.89],
  ['1234', 1234],
  ['12,34', 12.34],
  ['12.34', 12.34],
  ['-8,4', -8.4],
  ['+8.40', 8.4],
  ['0', 0],
  [' 1.234,56 € ', 1234.56],
] as const;
const invalidAmounts = [
  '1.234',
  '1,234',
  '',
  ' ',
  '1.23.456,78',
  '1,23,456.78',
  '12,34,56',
  '12.34.56',
  '1e3',
  '0x10',
  'Infinity',
  'NaN',
  '1 2',
  '12,3456',
  '9007199254740992',
];
const bankHeaders = {
  db: [
    'Belegdatum',
    'Eingangstag',
    'Verwendungszweck',
    'Fremdwährung',
    'Betrag',
    'Kurs',
    'Betrag',
    'Währung',
  ],
  dkb: [
    'Buchungstag',
    'Wertstellung',
    'Buchungstext',
    'Kontonummer',
    'Empfänger',
    'Zweck',
    'Art',
    'Saldo',
    'Umsatz',
    'A',
    'B',
    'C',
  ],
};
function transactionColumns(bank: keyof typeof bankHeaders, amount: string): string[] {
  return bank === 'db'
    ? ['25.9.2026', '28.9.2026', 'SHOP, location', 'USD', '-100', '0,9', amount, 'EUR']
    : [
        '25.9.2026',
        '28.9.2026',
        'Kartenzahlung',
        '',
        'SHOP, location',
        'Purpose',
        'Ausgang',
        '',
        amount,
        '',
        '',
        '',
      ];
}
function encodeRow(columns: string[], separator: string): string {
  return columns.map((value) => `"${value.replace(/"/g, '""')}"`).join(separator);
}

describe('amount validation', () => {
  it.each(validAmounts)('parses %s as %s', (value, expected) => {
    expect(parseAmount(value)).toBe(expected);
  });
  it.each(invalidAmounts)('rejects %j rather than guessing or rounding', (value) => {
    expect(parseAmount(value)).toBeNaN();
  });
});

for (const bank of ['db', 'dkb'] as const) {
  for (const separator of [';', ',', '\t']) {
    describe(`${bank} imports using ${JSON.stringify(separator)}`, () => {
      it.each(validAmounts)('imports %s correctly', async (amount, expected) => {
        const text = [
          encodeRow(bankHeaders[bank], separator),
          encodeRow(transactionColumns(bank, amount), separator),
        ].join('\r\n');
        const transactions = await readTransactions(new File([text], 'test.csv'));
        expect(transactions).toHaveLength(1);
        expect(transactions[0]?.amount).toBe(expected);
      });
      it.each(invalidAmounts.filter((amount) => bank !== 'dkb' || amount !== '1.234'))(
        'reports the source line for %j and rejects the whole import',
        async (amount) => {
          const badLine = encodeRow(transactionColumns(bank, amount), separator);
          const text = [
            '\uFEFFExport',
            '',
            encodeRow(bankHeaders[bank], separator),
            encodeRow(transactionColumns(bank, '12,34'), separator),
            badLine,
          ].join('\r\n');
          await expect(readTransactions(new File([text], 'test.csv'))).rejects.toThrow(`Line 5:`);
          await expect(readTransactions(new File([text], 'test.csv'))).rejects.toThrow(badLine);
        },
      );
    });
  }
}

it('rejects an unquoted decimal comma that creates an extra column', async () => {
  const line = transactionColumns('db', '12,34')
    .map((v, i) => (i === 6 ? v : `"${v}"`))
    .join(',');
  const text = `${bankHeaders.db.join(',')}\n${line}`;
  await expect(readTransactions(new File([text], 'test.csv'))).rejects.toThrow(
    `Line 2: Expected 8 columns`,
  );
  await expect(readTransactions(new File([text], 'test.csv'))).rejects.toThrow(line);
});

it('uses the billed EUR amount instead of the foreign amount', () => {
  expect(normalizeRows([bankHeaders.db, transactionColumns('db', '-90')])[0]?.amount).toBe(-90);
});

it('rejects a non-EUR billed currency', () => {
  const columns = transactionColumns('db', '-90');
  columns[7] = 'USD';
  expect(() => normalizeRows([bankHeaders.db, columns])).toThrow('Billed currency must be EUR');
});

it('retains physical line numbers after multiline fields and blank lines', () => {
  const text = [
    bankHeaders.db.join(';'),
    encodeRow(
      transactionColumns('db', '12,34').map((v, i) => (i === 2 ? 'SHOP\nlocation' : v)),
      ';',
    ),
    '',
    encodeRow(transactionColumns('db', '1.234'), ';'),
  ].join('\n');
  expect(() => normalizeRows(parseCsv(text))).toThrow('Line 5:');
});

it.each(['"unclosed', 'un"expected', '"closed"extra'])(
  'reports malformed quoting in %s',
  (field) => {
    expect(() => parseCsv(`header\n${field}`)).toThrow(`Line 2:`);
  },
);

it.each([';', ',', '\t'])(
  'imports DKB whole-euro grouping with separator %j',
  async (separator) => {
    for (const [amount, expected] of [
      ['-1.480', -1480],
      ['1.234', 1234],
      ['12.345', 12345],
      ['123.456', 123456],
    ] as const) {
      const text = [
        encodeRow(bankHeaders.dkb, separator),
        encodeRow(transactionColumns('dkb', amount), separator),
      ].join('\n');
      const transactions = await readTransactions(new File([text], 'dkb.csv'));
      expect(transactions[0]?.amount).toBe(expected);
    }
  },
);

it('imports the reported 12-column DKB rent row with a two-digit year', async () => {
  // Preserve the reported structure while keeping personal details out of the fixture.
  const row =
    '"28.09.26";"28.09.26";"Gebucht";"Account holder";"Landlord";"Miete + NK, Example address";"Ausgang";"DE00000000000000000000";"-1.480";"";"";""';
  const text = ['Export', '', '', '', '', '', bankHeaders.dkb.join(';'), row].join('\n');
  const transactions = await readTransactions(new File([text], 'rent.csv'));
  expect(transactions).toHaveLength(1);
  expect(transactions[0]).toMatchObject({
    date: '2026-09-28',
    amount: -1480,
    recipient: 'Landlord',
    type: 'Ausgang',
  });
});

it('uses DKB grouping for modern rows too', () => {
  const columns = Array<string>(17).fill('');
  columns[0] = '28.09.26';
  columns[15] = '-1.480';
  expect(normalizeRows([columns])[0]?.amount).toBe(-1480);
});
