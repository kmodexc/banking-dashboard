import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CategoryRule, ManagedRule } from '../../types';
import { RuleSummaryList } from './RuleSummaryList';

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
    source: 'user',
  },
  {
    rule: { keyword: 'EDEKA', category: 'groceries', column: 'recipient' },
    categoryLabel: 'groceries',
    source: 'user',
  },
];

describe('manageable rule summary list', () => {
  it('shows personal rules in the shared summary panel', () => {
    render(
      <RuleSummaryList
        rules={rules}
        categories={[{ value: 'groceries', label: 'groceries' }]}
        title="Categorization rules"
        listLabel="Categorization rule list"
        rulesToExport={[userRule]}
        onImport={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        onRemoveAll={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Categorization rules' })).toBeInTheDocument();
    expect(screen.getByText('Manage rules')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
  });

  it('keeps the supplied newest-first order in the rule list', () => {
    const newest: ManagedRule = {
      rule: { keyword: 'NEW SHOP', category: 'groceries', column: 'recipient' },
      categoryLabel: 'groceries',
      source: 'user',
    };
    const older: ManagedRule = {
      rule: { keyword: 'OLD SHOP', category: 'groceries', column: 'recipient' },
      categoryLabel: 'groceries',
      source: 'user',
    };
    render(
      <RuleSummaryList
        rules={[newest, older]}
        categories={[{ value: 'groceries', label: 'groceries' }]}
        listLabel="Categorization rule list"
        rulesToExport={[newest.rule, older.rule]}
        onImport={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        onRemoveAll={vi.fn()}
      />,
    );

    const rows = Array.from(
      screen.getByLabelText('Categorization rule list').querySelectorAll('.rule-row'),
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('NEW SHOP');
    expect(rows[1]).toHaveTextContent('OLD SHOP');
  });

  it('edits and deletes a rule from its details modal', () => {
    const onUpdate = vi.fn();
    const onDelete = vi.fn();
    render(
      <RuleSummaryList
        rules={[rules[0]!]}
        categories={[
          { value: 'groceries', label: 'groceries' },
          { value: 'restaurant', label: 'restaurant' },
        ]}
        rulesToExport={[userRule]}
        onImport={vi.fn()}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onRemoveAll={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /SPC\.CAFE/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit rule' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Edit rule keyword' }), {
      target: { value: 'SPC.BAKERY' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save rule' }));
    expect(onUpdate).toHaveBeenCalledWith(userRule, {
      keyword: 'SPC.BAKERY',
      category: 'groceries',
      column: 'recipient',
    });

    fireEvent.click(screen.getByRole('button', { name: /SPC\.CAFE/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete rule' }));
    expect(screen.getByText(/This cannot be undone/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));
    expect(onDelete).toHaveBeenCalledWith(userRule);
  });

  it('imports a validated replacement for editable rules', async () => {
    const onImport = vi.fn();
    render(
      <RuleSummaryList
        rules={rules}
        categories={[{ value: 'groceries', label: 'groceries' }]}
        rulesToExport={[userRule]}
        onImport={onImport}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        onRemoveAll={vi.fn()}
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

  it('exports the editable rules without shared read-only rules', async () => {
    const createObjectURL = vi.fn((blob: Blob) =>
      blob instanceof Blob ? 'blob:rules' : 'invalid',
    );
    const revokeObjectURL = vi.fn();
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    render(
      <RuleSummaryList
        rules={rules}
        categories={[{ value: 'groceries', label: 'groceries' }]}
        rulesToExport={[userRule]}
        onImport={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        onRemoveAll={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Export rules' }));

    expect(createObjectURL).toHaveBeenCalledOnce();
    const exported = createObjectURL.mock.calls[0]?.[0] as Blob;
    await expect(exported.text()).resolves.toContain('SPC.CAFE');
    await expect(exported.text()).resolves.not.toContain('EDEKA');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:rules');
    expect(screen.getByText('Rules exported.')).toBeInTheDocument();
    click.mockRestore();
    vi.unstubAllGlobals();
  });

  it('requires typing delete and supports cancel before removing all user rules', () => {
    const onRemoveAll = vi.fn();
    render(
      <RuleSummaryList
        rules={[rules[0]!]}
        categories={[{ value: 'groceries', label: 'groceries' }]}
        rulesToExport={[userRule]}
        onImport={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        onRemoveAll={onRemoveAll}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Remove all rules' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'OK' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Type delete to confirm/), {
      target: { value: 'DELETE' },
    });
    expect(screen.getByRole('button', { name: 'OK' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onRemoveAll).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Remove all rules' }));
    fireEvent.change(screen.getByLabelText(/Type delete to confirm/), {
      target: { value: 'delete' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(onRemoveAll).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
