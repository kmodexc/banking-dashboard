import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Categories } from './Categories';
import { categoryEntries, EMPTY_USER_CATEGORY_STATE } from '../data/categories';
import { DEFAULT_RULE_PREFERENCES } from '../data/preferences';
import type { AuthSnapshot } from '../types';

const signedOut: AuthSnapshot = { token: null, user: null, setupError: null };
const signedIn: AuthSnapshot = { token: 'token', user: { name: 'Test user' }, setupError: null };
const entries = categoryEntries(EMPTY_USER_CATEGORY_STATE);

function props(auth: AuthSnapshot, overrides: Record<string, unknown> = {}) {
  return {
    auth,
    entries,
    state: EMPTY_USER_CATEGORY_STATE,
    onAdd: vi.fn(),
    onRename: vi.fn(),
    onDelete: vi.fn(),
    onImport: vi.fn(),
    rulePreferences: DEFAULT_RULE_PREFERENCES,
    onRulePreferencesChange: vi.fn(),
    onSyncRules: vi.fn(),
    onDeleteServerRules: vi.fn(),
    ruleSyncStatus: '',
    ...overrides,
  };
}

describe('categories page', () => {
  it('keeps category changes and import/export disabled while signed out', () => {
    render(<Categories {...props(signedOut)} />);

    expect(screen.getByRole('button', { name: 'Add category' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Export categories' })).toBeDisabled();
    expect(screen.getByLabelText('Import categories')).toBeDisabled();
    expect(screen.getByLabelText('groceries category name')).toBeDisabled();
    expect(
      screen.getByRole('checkbox', { name: /Save my categories and rules privately/ }),
    ).toBeDisabled();
    expect(
      screen.getByText(/Sign in to add, rename, delete, import, or export/),
    ).toBeInTheDocument();
  });

  it('allows signed-in users to add and rename categories', () => {
    const onAdd = vi.fn();
    const onRename = vi.fn();
    render(<Categories {...props(signedIn, { onAdd, onRename })} />);

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
    render(<Categories {...props(signedIn, { onImport })} />);

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

  it('allows signed-in users to enable private storage and sync explicitly', () => {
    const onPreferencesChange = vi.fn();
    const onSyncRules = vi.fn();
    render(
      <Categories
        {...props(signedIn, { onRulePreferencesChange: onPreferencesChange, onSyncRules })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Sync privately now' }));
    expect(onSyncRules).toHaveBeenCalledOnce();
    fireEvent.click(
      screen.getByRole('checkbox', { name: /Save my categories and rules privately/ }),
    );
    expect(onPreferencesChange).toHaveBeenCalledWith({
      ...DEFAULT_RULE_PREFERENCES,
      storePrivateRules: false,
    });
  });

  it('announces a rule synchronization failure as a visible warning', () => {
    render(
      <Categories
        {...props(signedIn, {
          ruleSyncStatus: 'Could not sync rules: Request failed (503)',
        })}
      />,
    );

    const warning = screen.getByRole('status');
    expect(warning).toHaveTextContent('Warning: Could not sync rules: Request failed (503)');
    expect(warning).toHaveClass('rule-sync-status-error');
  });
});
