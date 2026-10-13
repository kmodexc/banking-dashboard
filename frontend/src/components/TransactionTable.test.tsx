import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TransactionTable } from './TransactionTable';
import type { Transaction } from '../types';

const transaction: Transaction = {
  id: '1',
  date: '2026-01-02',
  period: '2026-01',
  recipient: 'UNKNOWN SHOP',
  purpose: 'Card payment',
  type: 'Ausgang',
  amount: -8,
  category: 'items',
};

describe('transaction table', () => {
  it('shows the category beside the recipient and uses amount instead of purpose', () => {
    render(<TransactionTable rows={[transaction]} onSelect={vi.fn()} />);

    expect(screen.getByText('UNKNOWN SHOP')).toBeInTheDocument();
    expect(screen.getByText('items', { selector: '.category-badge' })).toBeInTheDocument();
    expect(screen.getByText('-€8.00')).toBeInTheDocument();
    expect(screen.queryByText('Card payment')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sort by Amount' })).toBeInTheDocument();
  });
});
