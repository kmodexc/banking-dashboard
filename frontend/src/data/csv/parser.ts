const sourceRows = new WeakMap<string[], { line: number; text: string }>();

export function rowError(columns: string[], index: number, message: string): Error {
  const source = sourceRows.get(columns);
  return new Error(
    `Line ${source?.line ?? index + 1}: ${message}\n${source?.text ?? columns.join(';')}`,
  );
}

export function parseCsv(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, '');
  // Bank headers identify the delimiter without confusing decimal commas with columns.
  const delimiter =
    source.match(/^"?(?:Belegdatum|Buchungstag|Buchungsdatum)"?([;,\t])/im)?.[1] ?? ';';
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let closedQuote = false;
  let line = 1;
  let startLine = 1;
  let start = 0;
  const fail = (message: string, end: number): never => {
    throw new Error(`Line ${startLine}: ${message}\n${source.slice(start, end)}`);
  };
  const finish = (end: number): void => {
    row.push(field);
    if (row.some((value) => value.trim())) {
      sourceRows.set(row, { line: startLine, text: source.slice(start, end) });
      rows.push(row);
    }
    row = [];
    field = '';
    closedQuote = false;
  };
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"') {
      if (quoted && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (quoted) {
        quoted = false;
        closedQuote = true;
      } else {
        if (field || closedQuote)
          fail(
            'Unexpected quote in CSV field',
            source.indexOf('\n', index) < 0 ? source.length : source.indexOf('\n', index),
          );
        quoted = true;
      }
    } else if (character === delimiter && !quoted) {
      row.push(field);
      field = '';
      closedQuote = false;
    } else if ((character === '\n' || character === '\r') && !quoted) {
      finish(index);
      if (character === '\r' && source[index + 1] === '\n') index += 1;
      line += 1;
      startLine = line;
      start = index + 1;
    } else {
      if (closedQuote)
        fail(
          'Unexpected text after closing quote',
          source.indexOf('\n', index) < 0 ? source.length : source.indexOf('\n', index),
        );
      field += character;
      if (character === '\n' || (character === '\r' && source[index + 1] !== '\n')) line += 1;
    }
  }
  if (quoted) fail('Unclosed quoted CSV field', source.length);
  if (field || row.length || closedQuote) finish(source.length);
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

export function parseAmount(value: string | undefined, thousandsSeparator?: '.' | ','): number {
  const clean = String(value ?? '')
    .trim()
    .replace(/\s*€$/, '')
    .trim();
  let normalized: string;
  // Use the bank's known grouping convention to resolve whole amounts such as 1.480.
  if (thousandsSeparator === '.' && /^[+-]?\d{1,3}(?:\.\d{3})+$/.test(clean)) {
    normalized = clean.replace(/\./g, '');
  } else if (thousandsSeparator === ',' && /^[+-]?\d{1,3}(?:,\d{3})+$/.test(clean)) {
    normalized = clean.replace(/,/g, '');
  } else if (/^[+-]?\d+(?:[.,]\d{1,2})?$/.test(clean)) {
    normalized = clean.replace(',', '.');
  } else if (/^[+-]?\d{1,3}(?:\.\d{3})+,\d{1,2}$/.test(clean)) {
    normalized = clean.replace(/\./g, '').replace(',', '.');
  } else if (/^[+-]?\d{1,3}(?:,\d{3})+\.\d{1,2}$/.test(clean)) {
    normalized = clean.replace(/,/g, '');
  } else if (/^[+-]?\d{1,3}(?:\.\d{3}){2,}$/.test(clean)) {
    normalized = clean.replace(/\./g, '');
  } else if (/^[+-]?\d{1,3}(?:,\d{3}){2,}$/.test(clean)) {
    normalized = clean.replace(/,/g, '');
  } else {
    // A single separator followed by three digits is ambiguous without a locale.
    return Number.NaN;
  }
  const amount = Number(normalized);
  return Number.isSafeInteger(Math.round(amount * 100))
    ? Math.round(amount * 100) / 100
    : Number.NaN;
}
