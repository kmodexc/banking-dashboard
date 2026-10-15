import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { CategoryRule } from '../types';
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
});
