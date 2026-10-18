import { describe, expect, it, vi } from 'vitest';
import {
  classifyTransactions,
  getStoredBudgets,
  getStoredRules,
  replaceStoredBudgets,
} from './api';
import type { AppConfig } from './types';

const config: AppConfig = { keycloakIssuer: '', keycloakClientId: 'client', apiBaseUrl: '' };
const request = {
  transactions: [{ id: '2026-01-02-1', recipient: 'UNKNOWN SHOP', purpose: 'Sonstiges' }],
  categories: ['items'],
  confidence_threshold: 0.7,
};

describe('classification API boundary', () => {
  it('validates and returns typed classification rules', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              rules: [
                {
                  keyword: 'UNKNOWN SHOP',
                  category: 'items',
                  column: 'recipient',
                  confidence: 0.95,
                },
              ],
            }),
            { status: 200 },
          ),
        ),
      ),
    );
    await expect(classifyTransactions(config, 'token', request)).resolves.toEqual([
      {
        keyword: 'UNKNOWN SHOP',
        category: 'items',
        column: 'recipient',
        confidence: 0.95,
      },
    ]);
  });

  it('rejects malformed provider responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ rules: [{ category: 'items' }] }), { status: 200 }),
        ),
      ),
    );
    await expect(classifyTransactions(config, 'token', request)).rejects.toThrow();
  });

  it('validates private and community rule collections', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              private: [{ keyword: 'REWE', category: 'groceries', column: 'recipient' }],
              community: [{ keyword: 'DB Bahn', category: 'mobility', column: 'recipient' }],
            }),
            { status: 200 },
          ),
        ),
      ),
    );

    await expect(getStoredRules(config, 'token', true)).resolves.toEqual({
      private: [{ keyword: 'REWE', category: 'groceries', column: 'recipient' }],
      community: [{ keyword: 'DB Bahn', category: 'mobility', column: 'recipient' }],
    });
  });
});

describe('budget API boundary', () => {
  it('loads and stores a private budget plan', async () => {
    const fetchMock = vi.fn((_: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        return Promise.resolve(
          new Response(JSON.stringify({ budgets: { defaults: { Food: 450 }, monthly: {} } }), {
            status: 200,
          }),
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify({ budgets: { defaults: { Food: 450 }, monthly: {} } }), {
          status: 200,
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(getStoredBudgets(config, 'token')).resolves.toEqual({
      defaults: { Food: 450 },
      monthly: {},
    });
    await replaceStoredBudgets(config, 'token', { defaults: { Food: 450 }, monthly: {} });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/budgets',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ budgets: { defaults: { Food: 450 }, monthly: {} } }),
      }),
    );
  });
});
