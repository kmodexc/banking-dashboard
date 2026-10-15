export function parseCsv(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"') {
      if (quoted && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ';' && !quoted) {
      row.push(field);
      field = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && source[index + 1] === '\n') index += 1;
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
