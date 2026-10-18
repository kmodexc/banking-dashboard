import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { saveBudgetPlan } from '../data/budgets';
import { DEFAULT_BUDGET_PREFERENCES, saveBudgetPreferences } from '../data/preferences';
import type { AuthSnapshot } from '../types';
import { useBudgetSync } from './useBudgetSync';

const signedIn: AuthSnapshot = {
  token: 'token',
  user: { sub: 'alice' },
  setupError: null,
};

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('useBudgetSync', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('uploads local budgets on first sign-in when server storage is enabled by default', async () => {
    saveBudgetPlan({ defaults: { Food: 450 }, monthly: {} });
    const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url =
          typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        calls.push({ url, init });
        if (init?.method === 'PUT') return Promise.resolve(response({ budgets: null }));
        return Promise.resolve(response({ budgets: null }));
      }),
    );

    const view = renderHook(() => useBudgetSync(signedIn, 'alice'));
    await waitFor(() => expect(calls.some(({ init }) => init?.method === 'PUT')).toBe(true));
    expect(view.result.current.budgetPreferences).toEqual(DEFAULT_BUDGET_PREFERENCES);
    expect(
      JSON.parse((calls.find(({ init }) => init?.method === 'PUT')?.init?.body as string) ?? '{}'),
    ).toEqual({ budgets: { defaults: { Food: 450 }, monthly: {} } });
  });

  it('does not call the server when the account preference is local-only', async () => {
    saveBudgetPreferences({ storePrivateBudgets: false }, 'alice');
    const fetchMock = vi.fn(() => Promise.resolve(response({ budgets: null })));
    vi.stubGlobal('fetch', fetchMock);

    const view = renderHook(() => useBudgetSync(signedIn, 'alice'));
    expect(view.result.current.budgetPreferences.storePrivateBudgets).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    act(() => {
      view.result.current.updateBudgetPreferences({ storePrivateBudgets: true });
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  });
});
