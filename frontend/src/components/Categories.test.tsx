import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Categories } from './Categories';
import { categoryEntries, EMPTY_USER_CATEGORY_STATE } from '../data/categories';
import { DEFAULT_RULE_PREFERENCES } from '../data/preferences';
import type { AuthSnapshot } from '../types';

const signedOut: AuthSnapshot = { token: null, user: null, setupError: null };
const signedIn: AuthSnapshot = { token: 'token', user: { name: 'Test user' }, setupError: null };
const entries = categoryEntries(EMPTY_USER_CATEGORY_STATE);

describe('categories page', () => {
  it('keeps category changes and import/export disabled while signed out', () => {
    render(
      <Categories
        auth={signedOut}
        entries={entries}
        state={EMPTY_USER_CATEGORY_STATE}
        onAdd={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
        onImport={vi.fn()}
        rulePreferences={DEFAULT_RULE_PREFERENCES}
        onRulePreferencesChange={vi.fn()}
        onSyncRules={vi.fn()}
        onDeleteServerRules={vi.fn()}
        onDeleteCommunityRules={vi.fn()}
        ruleSyncStatus=""
      />,
    );

    expect(screen.getByRole('button', { name: 'Add category' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Export categories' })).toBeDisabled();
    expect(screen.getByLabelText('Import categories')).toBeDisabled();
    expect(screen.getByLabelText('groceries category name')).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: /Save a private copy/ })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: /Use rules from the community/ })).toBeDisabled();
    expect(
      screen.getByRole('checkbox', { name: /Share eligible rules with the community/ }),
    ).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Delete private server copy' })).toBeNull();
    expect(
      screen.getByText(/Sign in to add, rename, delete, import, or export/),
    ).toBeInTheDocument();
  });

  it('allows signed-in users to add and rename categories', () => {
    const onAdd = vi.fn();
    const onRename = vi.fn();
    render(
      <Categories
        auth={signedIn}
        entries={entries}
        state={EMPTY_USER_CATEGORY_STATE}
        onAdd={onAdd}
        onRename={onRename}
        onDelete={vi.fn()}
        onImport={vi.fn()}
        rulePreferences={DEFAULT_RULE_PREFERENCES}
        onRulePreferencesChange={vi.fn()}
        onSyncRules={vi.fn()}
        onDeleteServerRules={vi.fn()}
        onDeleteCommunityRules={vi.fn()}
        ruleSyncStatus=""
      />,
    );

    fireEvent.change(screen.getByLabelText('New category name'), {
      target: { value: 'health' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add category' }));
    expect(onAdd).toHaveBeenCalledWith('health');

    fireEvent.change(screen.getByLabelText('groceries category name'), {
      target: { value: 'Food' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Rename' })[0]!);
    expect(onRename).toHaveBeenCalledWith(entries[0], 'Food');
  });

  it('imports a valid user category file when signed in', async () => {
    const onImport = vi.fn();
    render(
      <Categories
        auth={signedIn}
        entries={entries}
        state={EMPTY_USER_CATEGORY_STATE}
        onAdd={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
        onImport={onImport}
        rulePreferences={DEFAULT_RULE_PREFERENCES}
        onRulePreferencesChange={vi.fn()}
        onSyncRules={vi.fn()}
        onDeleteServerRules={vi.fn()}
        onDeleteCommunityRules={vi.fn()}
        ruleSyncStatus=""
      />,
    );

    fireEvent.change(screen.getByLabelText('Import categories'), {
      target: {
        files: [
          new File(
            ['{"renamed":{"groceries":"Food"},"deleted":[],"added":["health"]}'],
            'categories.json',
            { type: 'application/json' },
          ),
        ],
      },
    });

    await waitFor(() =>
      expect(onImport).toHaveBeenCalledWith({
        renamed: { groceries: 'Food' },
        deleted: [],
        added: ['health'],
      }),
    );
  });

  it('lets signed-in users change sharing preferences and sync explicitly', () => {
    const onPreferencesChange = vi.fn();
    const onSyncRules = vi.fn();
    const view = render(
      <Categories
        auth={signedIn}
        entries={entries}
        state={EMPTY_USER_CATEGORY_STATE}
        onAdd={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
        onImport={vi.fn()}
        rulePreferences={DEFAULT_RULE_PREFERENCES}
        onRulePreferencesChange={onPreferencesChange}
        onSyncRules={onSyncRules}
        onDeleteServerRules={vi.fn()}
        onDeleteCommunityRules={vi.fn()}
        ruleSyncStatus=""
      />,
    );

    fireEvent.click(screen.getByRole('checkbox', { name: /Save a private copy/ }));
    expect(onPreferencesChange).toHaveBeenCalledWith({
      ...DEFAULT_RULE_PREFERENCES,
      storePrivateRules: true,
    });
    view.rerender(
      <Categories
        auth={signedIn}
        entries={entries}
        state={EMPTY_USER_CATEGORY_STATE}
        onAdd={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
        onImport={vi.fn()}
        rulePreferences={{ ...DEFAULT_RULE_PREFERENCES, storePrivateRules: true }}
        onRulePreferencesChange={onPreferencesChange}
        onSyncRules={onSyncRules}
        onDeleteServerRules={vi.fn()}
        onDeleteCommunityRules={vi.fn()}
        ruleSyncStatus=""
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Sync selected rules now' }));
    expect(onSyncRules).toHaveBeenCalledOnce();
  });

  it('announces a rule synchronization failure as a visible warning', () => {
    render(
      <Categories
        auth={signedIn}
        entries={entries}
        state={EMPTY_USER_CATEGORY_STATE}
        onAdd={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
        onImport={vi.fn()}
        rulePreferences={{ ...DEFAULT_RULE_PREFERENCES, storePrivateRules: true }}
        onRulePreferencesChange={vi.fn()}
        onSyncRules={vi.fn()}
        onDeleteServerRules={vi.fn()}
        onDeleteCommunityRules={vi.fn()}
        ruleSyncStatus="Could not sync rules: Request failed (503)"
      />,
    );

    const warning = screen.getByRole('alert');
    expect(warning).toHaveTextContent('Warning: Could not sync rules: Request failed (503)');
    expect(warning).toHaveAttribute('aria-live', 'assertive');
  });
});
