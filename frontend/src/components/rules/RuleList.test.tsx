import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CategoryRule, ManagedRule } from '../../types';
import { RuleList } from './RuleList';
import type { RulesController } from './ruleTypes';

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

function controller(rules: CategoryRule[]): RulesController {
  const managedRules: ManagedRule[] = rules.map((rule) => ({
    rule,
    categoryLabel: rule.category,
    source: 'user',
  }));
  return {
    rules: managedRules,
    categories: [
      { value: 'items', label: 'items' },
      { value: 'groceries', label: 'groceries' },
    ],
    editableRules: rules,
    actions: {
      importRules: vi.fn(),
      updateRule: vi.fn(),
      deleteRule: vi.fn(),
      removeAllRules: vi.fn(),
    },
  };
}

describe('rule summary list', () => {
  it('shows all rules in the single rules view', () => {
    render(<RuleList rulesController={controller([newestRule, olderRule])} />);

    const list = screen.getByRole('list', { name: 'Categorization rule list' });
    const entries = Array.from(list.querySelectorAll('li'));
    expect(screen.getByRole('heading', { name: 'Categorization rules' })).toBeInTheDocument();
    expect(entries).toHaveLength(2);
    expect(entries[0]).toHaveTextContent('NEW SHOP');
    expect(entries[0]).toHaveTextContent('items');
    expect(entries[1]).toHaveTextContent('OLD SHOP');
    expect(entries[1]).toHaveTextContent('groceries');
  });

  it('shows the shared empty state', () => {
    render(<RuleList rulesController={controller([])} />);

    expect(screen.getByText('No rules match this filter.')).toBeInTheDocument();
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
    render(<RuleList rulesController={controller([olderRuleWithDate, newestRuleWithDate])} />);

    const list = screen.getByRole('list', { name: 'Categorization rule list' });
    expect(list.querySelector('li')).toHaveTextContent('NEW SHOP');
    fireEvent.change(screen.getByLabelText('Categorization rules sort order'), {
      target: { value: 'category' },
    });
    expect(list.querySelector('li')).toHaveTextContent('OLD SHOP');

    fireEvent.change(screen.getByLabelText('Categorization rules sort order'), {
      target: { value: 'name' },
    });
    expect(list.querySelector('li')).toHaveTextContent('NEW SHOP');

    fireEvent.click(screen.getByRole('button', { name: /OLD SHOP/ }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Edit rule' })).toBeInTheDocument();
    expect(
      within(screen.getByRole('dialog')).getByText('Jan 1, 2026, 12:00 PM'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close rule details' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
