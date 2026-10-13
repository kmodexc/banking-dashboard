import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RuleManager, type ManagedRule } from './RuleManager';
import type { CategoryRule } from '../types';

const userRule: CategoryRule = {
  keyword: 'SPC.CAFE',
  category: 'groceries',
  column: 'recipient',
};
const rules: ManagedRule[] = [
  { rule: userRule, categoryLabel: 'groceries', source: 'user' },
  {
    rule: { keyword: 'REWE', category: 'groceries', column: 'recipient' },
    categoryLabel: 'groceries',
    source: 'global',
  },
  {
    rule: { keyword: 'EDEKA', category: 'groceries', column: 'recipient' },
    categoryLabel: 'groceries',
    source: 'community',
  },
];

describe('rule manager', () => {
  it('shows rule sources and only offers actions for user rules', () => {
    render(
      <RuleManager
        rules={rules}
        categories={[{ value: 'groceries', label: 'groceries' }]}
        rulesToExport={[userRule]}
        onImport={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText('Your rule')).toBeInTheDocument();
    expect(screen.getByText('Global')).toBeInTheDocument();
    expect(screen.getByText('Community')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Edit' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Delete' })).toHaveLength(1);
  });

  it('edits and deletes a user rule', () => {
    const onUpdate = vi.fn();
    const onDelete = vi.fn();
    render(
      <RuleManager
        rules={[rules[0]!]}
        categories={[
          { value: 'groceries', label: 'groceries' },
          { value: 'restaurant', label: 'restaurant' },
        ]}
        rulesToExport={[userRule]}
        onImport={vi.fn()}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Edit rule keyword' }), {
      target: { value: 'SPC.BAKERY' },
    });
    fireEvent.click(screen.getByRole('radio', { name: 'restaurant' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save rule' }));
    expect(onUpdate).toHaveBeenCalledWith(userRule, {
      keyword: 'SPC.BAKERY',
      category: 'restaurant',
      column: 'recipient',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledWith(userRule);
  });

  it('imports a validated replacement for editable rules', async () => {
    const onImport = vi.fn();
    render(
      <RuleManager
        rules={rules}
        categories={[{ value: 'groceries', label: 'groceries' }]}
        rulesToExport={[userRule]}
        onImport={onImport}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const file = new File(
      [JSON.stringify([{ keyword: 'SPC.BAKERY', category: 'groceries', column: 'recipient' }])],
      'rules.json',
      { type: 'application/json' },
    );
    fireEvent.change(screen.getByLabelText('Import rules'), { target: { files: [file] } });

    await waitFor(() => {
      expect(onImport).toHaveBeenCalledWith([
        { keyword: 'SPC.BAKERY', category: 'groceries', column: 'recipient' },
      ]);
    });
    expect(screen.getByText('Rules imported.')).toBeInTheDocument();
  });
});
