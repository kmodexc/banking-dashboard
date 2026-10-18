import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Transaction } from '../../types';
import { TransactionDetailsModal } from './TransactionDetailsModal';
import type { RulesController } from '../rules/ruleTypes';

const transaction: Transaction = {
  id: 'expense-1',
  date: '2026-01-18',
  period: '2026-01',
  recipient: 'SPC.CAFE',
  purpose: 'Coffee',
  type: 'Ausgang',
  amount: -8.5,
  category: 'groceries',
};

const rulesController: RulesController = {
  rules: [
    {
      rule: {
        keyword: 'SPC.CAFE',
        category: 'groceries',
        column: 'recipient',
      },
      categoryLabel: 'groceries',
      source: 'user',
    },
  ],
  categories: [{ value: 'groceries', label: 'groceries' }],
  editableRules: [],
  actions: {
    importRules: vi.fn(),
    updateRule: vi.fn(),
    deleteRule: vi.fn(),
    removeAllRules: vi.fn(),
  },
};

describe('transaction details rule matching', () => {
  it('opens the matching rule and shows its current transaction matches', () => {
    const secondMatch = { ...transaction, id: 'expense-2', date: '2026-01-12' };

    render(
      <TransactionDetailsModal
        transaction={transaction}
        categories={['groceries']}
        transactions={[transaction, secondMatch]}
        rulesController={rulesController}
        onClose={vi.fn()}
        onCategoryChange={vi.fn()}
      />,
    );

    expect(screen.queryByText('January 2026')).not.toBeInTheDocument();
    expect(screen.getByText('expense-1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /SPC\.CAFE/ }));

    expect(screen.getByRole('heading', { name: 'Edit rule' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '2 transactions' })).toBeInTheDocument();
    fireEvent.click(screen.getByText('Show matching transactions'));
    expect(screen.getAllByText('SPC.CAFE')).toHaveLength(2);
  });
});
