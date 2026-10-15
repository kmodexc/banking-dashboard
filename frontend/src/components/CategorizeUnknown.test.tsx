import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { OidcClient } from '../auth';
import type { AuthSnapshot, Transaction } from '../types';
import { CategorizeUnknown } from './CategorizeUnknown';

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

describe('categorize unknown', () => {
  it('renders the reusable recent-rules component below the form', () => {
    render(
      <CategorizeUnknown
        transactions={[transaction]}
        rules={[]}
        userRules={[]}
        auth={signedOut}
        client={{} as OidcClient}
        onAddRule={vi.fn()}
        onAddRules={vi.fn()}
      />,
    );

    expect(screen.getByText('No rules added yet.')).toBeInTheDocument();
  });
});
