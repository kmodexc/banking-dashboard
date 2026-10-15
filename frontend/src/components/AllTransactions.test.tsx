import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Transaction } from '../types';
import { AllTransactions } from './AllTransactions';

const transactions: Transaction[] = [
  {
    id: 'income-1',
    date: '2026-02-01',
    period: '2026-02',
    recipient: 'SALARY',
    purpose: 'Monthly salary',
    type: 'Eingang',
    amount: 1000,
    category: 'unknown',
  },
  {
    id: 'expense-1',
    date: '2026-01-01',
    period: '2026-01',
    recipient: 'SHOP',
    purpose: 'Purchase',
    type: 'Ausgang',
    amount: -8,
    category: 'items',
  },
];

describe('all transactions', () => {
  it('shows every period and includes income without a category', () => {
    render(
      <AllTransactions
        transactions={transactions}
        categories={['items']}
        onCategoryChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Every imported transaction')).toBeInTheDocument();
    expect(screen.getByText('SALARY')).toBeInTheDocument();
    expect(screen.getByText('SHOP')).toBeInTheDocument();
    expect(screen.getByText('Income', { selector: '.type-badge' })).toBeInTheDocument();
    expect(screen.queryByText('unknown', { selector: '.category-badge' })).not.toBeInTheDocument();
    expect(screen.getByText('2 rows · click a row for details')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Income', pressed: false }));
    expect(screen.getByText('SALARY')).toBeInTheDocument();
    expect(screen.queryByText('SHOP')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: 'items' }));
    expect(screen.getByRole('button', { name: 'Expenses', pressed: true })).toBeInTheDocument();
    expect(screen.queryByText('SALARY')).not.toBeInTheDocument();
  });
});
