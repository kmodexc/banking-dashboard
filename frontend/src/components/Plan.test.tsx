import { fireEvent, render, screen } from '@testing-library/react';
import { useState, type ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import type { BudgetPlan } from '../data/budgets';
import type { Transaction } from '../types';
import { Plan } from './Plan';

const transactions: Transaction[] = [
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
  return (
    <Plan
      transactions={transactions}
      categories={['Food', 'Rent']}
      initialPeriod="2026-01"
      budgets={budgets}
      onBudgetsChange={setBudgets}
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
    expect(screen.getByText('€80.00 planned').parentElement).toHaveTextContent('month-specific');
  });

  it('can move to a future month without imported transactions', () => {
    render(<PlanHarness />);

    fireEvent.click(screen.getByRole('button', { name: 'Next plan month' }));

    expect(screen.getByRole('heading', { name: 'February 2026' })).toBeInTheDocument();
    expect(screen.getByText('0 outgoing transactions in this month')).toBeInTheDocument();
  });
});
