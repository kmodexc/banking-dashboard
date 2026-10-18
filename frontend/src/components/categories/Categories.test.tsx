import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { categoryEntries, type UserCategoryState } from '../../data/categories';
import type { RulesController } from '../rules/ruleTypes';
import { Categories } from './Categories';

const testState: UserCategoryState = {
  categories: [{ id: 'category-groceries', name: 'groceries', aliases: [] }],
  deletedIds: [],
};
const entries = categoryEntries(testState);
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

function props(overrides: Record<string, unknown> = {}) {
  return {
    entries,
    state: testState,
    onAdd: vi.fn(),
    onRename: vi.fn(),
    onDelete: vi.fn(),
    onImport: vi.fn(),
    rulesController,
    ...overrides,
  };
}

describe('categories page', () => {
  it('allows local category changes and import/export while signed out', async () => {
    const onAdd = vi.fn();
    const onRename = vi.fn();
    const onDelete = vi.fn();
    const onImport = vi.fn();
    render(<Categories {...props({ onAdd, onRename, onDelete, onImport })} />);

    expect(screen.getByRole('button', { name: 'Add category' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Export categories' })).toBeEnabled();
    expect(screen.getByLabelText('Import categories')).toBeEnabled();
    expect(screen.getByLabelText('groceries category name')).toBeEnabled();
    fireEvent.change(screen.getByLabelText('New category name'), { target: { value: 'health' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add category' }));
    expect(onAdd).toHaveBeenCalledWith('health');
    fireEvent.change(screen.getByLabelText('groceries category name'), {
      target: { value: 'Food' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
    expect(onRename).toHaveBeenCalledWith(entries[0], 'Food');
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledWith(entries[0]);
    fireEvent.change(screen.getByLabelText('Import categories'), {
      target: {
        files: [
          new File([JSON.stringify({ categories: [], deletedIds: [] })], 'categories.json', {
            type: 'application/json',
          }),
        ],
      },
    });
    await waitFor(() => expect(onImport).toHaveBeenCalledWith({ categories: [], deletedIds: [] }));
  });

  it('allows users to add and rename categories', () => {
    const onAdd = vi.fn();
    const onRename = vi.fn();
    render(<Categories {...props({ onAdd, onRename })} />);

    fireEvent.change(screen.getByLabelText('New category name'), { target: { value: 'health' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add category' }));
    expect(onAdd).toHaveBeenCalledWith('health');

    fireEvent.change(screen.getByLabelText('groceries category name'), {
      target: { value: 'Food' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Rename' })[0]!);
    expect(onRename).toHaveBeenCalledWith(entries[0], 'Food');
  });

  it('imports a valid personal category file when signed in', async () => {
    const onImport = vi.fn();
    render(<Categories {...props({ onImport })} />);

    fireEvent.change(screen.getByLabelText('Import categories'), {
      target: {
        files: [
          new File(
            [
              JSON.stringify({
                categories: [{ id: 'health', name: 'health', aliases: [] }],
                deletedIds: [],
              }),
            ],
            'categories.json',
            { type: 'application/json' },
          ),
        ],
      },
    });

    await waitFor(() =>
      expect(onImport).toHaveBeenCalledWith({
        categories: [{ id: 'health', name: 'health', aliases: [] }],
        deletedIds: [],
      }),
    );
  });
});
