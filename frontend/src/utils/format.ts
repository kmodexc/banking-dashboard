import type { Transaction } from '../types';

export const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' });
export const chartColors = [
  '#2457d6',
  '#ef8354',
  '#2a9d8f',
  '#e9c46a',
  '#8f6fe8',
  '#e76f51',
  '#5c7cfa',
];

export type SortKey = 'date' | 'recipient' | 'purpose' | 'amount' | 'category' | 'type';

export function money(value: number): string {
  return currency.format(Number.isFinite(value) ? value : 0);
}

export function formatPeriod(period: string): string {
  if (!period) return 'No period selected';
  const date = new Date(`${period}-01T00:00:00`);
  return Number.isNaN(date.getTime())
    ? period
    : new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date);
}

export function formatDate(date: string): string {
  const value = new Date(`${date}T00:00:00`);
  return Number.isNaN(value.getTime())
    ? date
    : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(
        value,
      );
}

export function sortRows(
  rows: Transaction[],
  sortKey: SortKey,
  direction: 'asc' | 'desc',
): Transaction[] {
  const multiplier = direction === 'asc' ? 1 : -1;
  return [...rows].sort((left, right) => {
    const leftValue = left[sortKey];
    const rightValue = right[sortKey];
    if (typeof leftValue === 'number' && typeof rightValue === 'number') {
      return (leftValue - rightValue) * multiplier;
    }
    return (
      String(leftValue).localeCompare(String(rightValue), undefined, { sensitivity: 'base' }) *
      multiplier
    );
  });
}
