import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { CategoryRule } from '../../types';
import { RuleSummaryList } from './RuleSummaryList';

const newestRule: CategoryRule = {
  keyword: 'NEW SHOP',
  category: 'items',
  column: 'recipient',
};
const olderRule: CategoryRule = {
  keyword: 'OLD SHOP',
  category: 'groceries',
  column: 'purpose',
};

describe('rule summary list', () => {
  it('preserves the supplied newest-first order and summarizes each rule', () => {
    render(<RuleSummaryList rules={[newestRule, olderRule]} />);

    const list = screen.getByRole('list', { name: 'Recently added rules' });
    const entries = Array.from(list.querySelectorAll('li'));
    expect(entries).toHaveLength(2);
    expect(entries[0]).toHaveTextContent('NEW SHOP');
    expect(entries[0]).toHaveTextContent('items');
    expect(entries[1]).toHaveTextContent('OLD SHOP');
    expect(entries[1]).toHaveTextContent('groceries');
  });

  it('shows an empty state when no user rules exist', () => {
    render(<RuleSummaryList rules={[]} />);

    expect(screen.getByText('No rules added yet.')).toBeInTheDocument();
  });

  it('sorts rules and opens a details modal', () => {
    const newestRuleWithDate: CategoryRule = {
      ...newestRule,
      createdAt: '2026-01-02T12:00:00.000Z',
    };
    const olderRuleWithDate: CategoryRule = {
      ...olderRule,
      createdAt: '2026-01-01T12:00:00.000Z',
    };
    render(<RuleSummaryList rules={[olderRuleWithDate, newestRuleWithDate]} />);

    const list = screen.getByRole('list', { name: 'Recently added rules' });
    expect(list.querySelector('li')).toHaveTextContent('NEW SHOP');
    fireEvent.change(screen.getByLabelText('Recently added rules sort order'), {
      target: { value: 'category' },
    });
    expect(list.querySelector('li')).toHaveTextContent('OLD SHOP');

    fireEvent.change(screen.getByLabelText('Recently added rules sort order'), {
      target: { value: 'name' },
    });
    expect(list.querySelector('li')).toHaveTextContent('NEW SHOP');

    fireEvent.click(screen.getByRole('button', { name: /OLD SHOP/ }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'OLD SHOP' })).toBeInTheDocument();
    expect(
      within(screen.getByRole('dialog')).getByText('Jan 1, 2026, 12:00 PM'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close rule details' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
