import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CategoryRule, ManagedRule } from '../../types';
import { RuleList } from './RuleList';
import type { RuleActions, RulesController } from './ruleTypes';

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

function controller(
  managedRules: ManagedRule[] = rules,
  actionOverrides: Partial<RuleActions> = {},
): RulesController {
  return {
    rules: managedRules,
    categories: [
      { value: 'groceries', label: 'groceries' },
      { value: 'restaurant', label: 'restaurant' },
    ],
    editableRules: managedRules.map((entry) => entry.rule),
    actions: {
      importRules: vi.fn(),
      updateRule: vi.fn(),
      deleteRule: vi.fn(),
      removeAllRules: vi.fn(),
      ...actionOverrides,
    },
  };
}

describe('rule summary list management', () => {
  it('shows all rules in the shared summary panel', () => {
    render(<RuleList rulesController={controller()} />);

    expect(screen.getByRole('heading', { name: 'Categorization rules' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export rules' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove all rules' })).toBeInTheDocument();
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
    render(<RuleList rulesController={controller([newest, older])} />);

    const rows = Array.from(
      screen.getByLabelText('Categorization rule list').querySelectorAll('.rule-row'),
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('NEW SHOP');
    expect(rows[1]).toHaveTextContent('OLD SHOP');
  });

  it('edits a rule in its details modal and deletes it from the list', () => {
    const onUpdate = vi.fn();
    const onDelete = vi.fn();
    render(
      <RuleList
        rulesController={controller([rules[0]!], { updateRule: onUpdate, deleteRule: onDelete })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /^SPC\.CAFE/ }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Keyword' }), {
      target: { value: 'SPC.BAKERY' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save rule' }));
    expect(onUpdate).toHaveBeenCalledWith(userRule, {
      keyword: 'SPC.BAKERY',
      category: 'groceries',
      column: 'recipient',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Delete rule SPC.CAFE' }));
    expect(screen.getByRole('heading', { name: 'Delete rule?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Delete rule$/ }));
    expect(onDelete).toHaveBeenCalledWith(userRule);
  });

  it('imports a validated replacement for editable rules', async () => {
    const onImport = vi.fn();
    render(<RuleList rulesController={controller(rules, { importRules: onImport })} />);

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

  it('exports the editable rules', async () => {
    const createObjectURL = vi.fn((blob: Blob) =>
      blob instanceof Blob ? 'blob:rules' : 'invalid',
    );
    const revokeObjectURL = vi.fn();
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    render(<RuleList rulesController={controller()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Export rules' }));

    expect(createObjectURL).toHaveBeenCalledOnce();
    const exported = createObjectURL.mock.calls[0]?.[0] as Blob;
    await expect(exported.text()).resolves.toContain('SPC.CAFE');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:rules');
    expect(screen.getByText('Rules exported.')).toBeInTheDocument();
    click.mockRestore();
    vi.unstubAllGlobals();
  });

  it('requires typing delete and supports cancel before removing all rules', () => {
    const onRemoveAll = vi.fn();
    render(<RuleList rulesController={controller([rules[0]!], { removeAllRules: onRemoveAll })} />);

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
