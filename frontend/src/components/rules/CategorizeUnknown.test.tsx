import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { OidcClient } from '../../auth';
import type { AuthSnapshot, Transaction } from '../../types';
import { CategorizeUnknown } from './CategorizeUnknown';
import type { RulesController } from './ruleTypes';

const signedOut: AuthSnapshot = { token: null, user: null, setupError: null };
const transaction: Transaction = {
  id: '2026-01-01-1',
  date: '2026-01-01',
  period: '2026-01',
  recipient: 'UNKNOWN SHOP',
  purpose: 'Sonstiges',
  type: 'Ausgang',
  amount: -8,
  category: 'unknown',
};
const previousTransaction: Transaction = {
  ...transaction,
  id: '2025-12-31-1',
  date: '2025-12-31',
  period: '2025-12',
  recipient: 'PREVIOUS SHOP',
};
const rulesController: RulesController = {
  rules: [],
  categories: [],
  editableRules: [],
  actions: {
    importRules: vi.fn(),
    updateRule: vi.fn(),
    deleteRule: vi.fn(),
    removeAllRules: vi.fn(),
  },
};

describe('categorize unknown', () => {
  function renderPage(transactions: Transaction[] = [transaction]): void {
    render(
      <CategorizeUnknown
        transactions={transactions}
        rules={[]}
        auth={signedOut}
        client={{} as OidcClient}
        onAddRule={vi.fn()}
        onAddRules={vi.fn()}
        rulesController={rulesController}
      />,
    );
  }

  it('renders the reusable recent-rules component below the form', () => {
    renderPage();

    expect(screen.getByText('No rules match this filter.')).toBeInTheDocument();
    const heading = screen.getByRole('heading', { name: 'Categorization rules' });
    expect(heading.closest('.content-grid')).toBeNull();
    expect(heading.closest('.recent-rules')).toHaveClass('panel');
  });

  it('moves through unknown transactions with previous and next buttons', () => {
    renderPage([transaction, previousTransaction]);

    expect(screen.getByLabelText('Keyword')).toHaveValue('UNKNOWN SHOP');
    expect(screen.getByRole('button', { name: 'Previous unknown transaction' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next unknown transaction' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Next unknown transaction' }));
    expect(screen.getByLabelText('Keyword')).toHaveValue('PREVIOUS SHOP');
    expect(screen.getByRole('button', { name: 'Previous unknown transaction' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Next unknown transaction' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Previous unknown transaction' }));
    expect(screen.getByLabelText('Keyword')).toHaveValue('UNKNOWN SHOP');
  });
});
