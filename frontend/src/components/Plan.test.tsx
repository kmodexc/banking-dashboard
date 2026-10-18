import { fireEvent, render, screen } from '@testing-library/react';
import { useState, type ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import type { BudgetPlan } from '../data/budgets';
import type { BudgetPreferences } from '../data/preferences';
import type { AuthSnapshot } from '../types';
import type { Transaction } from '../types';
import { Plan } from './Plan';

const transactions: Transaction[] = [
  {
    id: 'food-previous-1',
    date: '2025-12-02',
    period: '2025-12',
    recipient: 'GROCERY SHOP',
    purpose: 'Food',
    type: 'Ausgang',
    amount: -70,
    category: 'Food',
  },
  {
    id: 'food-previous-2',
    date: '2025-11-02',
    period: '2025-11',
    recipient: 'GROCERY SHOP',
    purpose: 'Food',
    type: 'Ausgang',
    amount: -30,
    category: 'Food',
  },
  {
    id: 'food-1',
    date: '2026-01-02',
    period: '2026-01',
    recipient: 'GROCERY SHOP',
    purpose: 'Food',
    type: 'Ausgang',
    amount: -50,
    category: 'Food',
  },
  {
    id: 'rent-1',
    date: '2026-01-03',
    period: '2026-01',
    recipient: 'LANDLORD',
    purpose: 'Rent',
    type: 'Ausgang',
    amount: -400,
    category: 'Rent',
  },
];

function PlanHarness(): ReactElement {
  const [budgets, setBudgets] = useState<BudgetPlan>({
    defaults: { Food: 100, Rent: 500 },
    monthly: {},
  });
  const signedOut: AuthSnapshot = { token: null, user: null, setupError: null };
  const preferences: BudgetPreferences = { storePrivateBudgets: true };
  return (
    <Plan
      transactions={transactions}
      categories={['Food', 'Rent']}
      initialPeriod="2026-01"
      auth={signedOut}
      budgets={budgets}
      budgetPreferences={preferences}
      budgetSyncStatus=""
      onBudgetsChange={setBudgets}
      onBudgetPreferencesChange={() => undefined}
      onDeleteServerBudgets={() => undefined}
    />
  );
}

describe('plan tab', () => {
  it('shows default spending progress and allows a month-specific override', () => {
    render(<PlanHarness />);

    expect(screen.getByRole('heading', { name: 'January 2026' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Food spending progress' })).toHaveAttribute(
      'aria-valuenow',
      '50',
    );
    expect(screen.getByText('€50.00 spent')).toBeInTheDocument();
    expect(screen.getByText('Total planned for January 2026').parentElement).toHaveTextContent(
      '€600.00 / month',
    );

    fireEvent.click(screen.getByRole('tab', { name: 'This month' }));
    expect(screen.getByText('Using default: €100.00')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Food monthly budget' }), {
      target: { value: '80' },
    });

    expect(screen.getByRole('progressbar', { name: 'Food spending progress' })).toHaveAttribute(
      'aria-valuenow',
      '63',
    );
    expect(screen.getByText('€80.00 planned')).toBeInTheDocument();
    expect(screen.getByText('Total planned for January 2026').parentElement).toHaveTextContent(
      '€580.00 / month',
    );
    expect(screen.getByText('€80.00 planned').parentElement).toHaveTextContent('month-specific');

    fireEvent.change(screen.getByRole('spinbutton', { name: 'Food monthly budget' }), {
      target: { value: '40' },
    });
    expect(screen.getByRole('progressbar', { name: 'Food spending progress' })).toHaveAttribute(
      'aria-valuenow',
      '125',
    );
    expect(screen.getByRole('progressbar', { name: 'Food spending progress' })).toHaveClass(
      'over-budget',
    );
    expect(screen.getByText('€10.00 over budget')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reset month-specific budgets' }));
    expect(screen.getByText('€100.00 planned')).toBeInTheDocument();
    expect(screen.getByText('€100.00 planned').parentElement).not.toHaveTextContent(
      'month-specific',
    );
    expect(screen.getByRole('button', { name: 'Reset month-specific budgets' })).toBeDisabled();
  });

  it('switches from the progress list to the bar chart view', () => {
    const { container } = render(<PlanHarness />);

    expect(screen.getByRole('progressbar', { name: 'Food spending progress' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Bar chart' }));

    expect(screen.getByRole('img', { name: 'Budget spending bar chart' })).toBeInTheDocument();
    expect(
      screen.queryByRole('progressbar', { name: 'Food spending progress' }),
    ).not.toBeInTheDocument();
    expect(container.querySelector('.plan-chart-canvas')).toBeInTheDocument();
  });

  it('can move to a future month without imported transactions', () => {
    render(<PlanHarness />);

    fireEvent.click(screen.getByRole('button', { name: 'Next plan month' }));

    expect(screen.getByRole('heading', { name: 'February 2026' })).toBeInTheDocument();
    expect(screen.getByText('0 outgoing transactions in this month')).toBeInTheDocument();
  });

  it('shows historical spending in the box plot view', () => {
    render(<PlanHarness />);

    fireEvent.click(screen.getByRole('tab', { name: 'History box plot' }));

    expect(screen.getByRole('img', { name: 'Historical spending box plot' })).toBeInTheDocument();
    expect(screen.getByText(/middle 50% of spending across 2 previous months/)).toBeInTheDocument();
  });
});
