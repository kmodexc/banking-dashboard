import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseImportedRules, saveLocalRules } from '../data/rules';
import { DEFAULT_RULE_PREFERENCES, saveRulePreferences } from '../data/preferences';
import type { AuthSnapshot, CategoryRule } from '../types';
import { useRuleSync } from './useRuleSync';

const signedIn: AuthSnapshot = {
  token: 'test-token',
  user: { sub: 'alice' },
  setupError: null,
};

const signedOut: AuthSnapshot = { token: null, user: null, setupError: null };
const signedInAsBob: AuthSnapshot = {
  token: 'bob-token',
  user: { sub: 'bob' },
  setupError: null,
};

const syncCombinations = [
  {
    name: 'local only',
    storePrivateRules: false,
    useCommunityRules: false,
    contributeRules: false,
  },
  {
    name: 'private only',
    storePrivateRules: true,
    useCommunityRules: false,
    contributeRules: false,
  },
  {
    name: 'community sharing only',
    storePrivateRules: false,
    useCommunityRules: false,
    contributeRules: true,
  },
  {
    name: 'community consumption only',
    storePrivateRules: false,
    useCommunityRules: true,
    contributeRules: false,
  },
  {
    name: 'private plus community sharing',
    storePrivateRules: true,
    useCommunityRules: false,
    contributeRules: true,
  },
  {
    name: 'private plus community consumption',
    storePrivateRules: true,
    useCommunityRules: true,
    contributeRules: false,
  },
  {
    name: 'community sharing plus consumption',
    storePrivateRules: false,
    useCommunityRules: true,
    contributeRules: true,
  },
  {
    name: 'private plus both community options',
    storePrivateRules: true,
    useCommunityRules: true,
    contributeRules: true,
  },
] as const;

const globalRule: CategoryRule = {
  keyword: 'REWE',
  category: 'groceries',
  column: 'recipient',
};

const privateRule: CategoryRule = {
  keyword: 'PRIVATE SHOP',
  category: 'my-category',
  column: 'recipient',
};

const importedRuleSet = [globalRule, privateRule];
const ruleOrigins = ['created', 'imported'] as const;

function response(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function requestBody(init: RequestInit | undefined): unknown {
  const body = init?.body;
  if (typeof body !== 'string') throw new Error('Expected a JSON request body');
  return JSON.parse(body) as unknown;
}

describe('useRuleSync', () => {
  let calls: Array<{ url: string; init: RequestInit | undefined }>;
  let fetchMock: ReturnType<typeof vi.fn>;
  let failPrivatePut = false;

  beforeEach(() => {
    localStorage.clear();
    calls = [];
    failPrivatePut = false;
    fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = requestUrl(input);
      calls.push({ url, init });
      if (url.endsWith('/default-rules.json')) return Promise.resolve(response([]));
      if (url.includes('/api/rules') && (init?.method ?? 'GET') === 'GET') {
        return Promise.resolve(response({ private: [], community: [] }));
      }
      if (url.endsWith('/api/rules') && init?.method === 'PUT' && failPrivatePut) {
        return Promise.resolve(response({ detail: 'offline' }, 503));
      }
      if (url.endsWith('/api/rules'))
        return Promise.resolve(response({ private: [], community: [] }));
      if (url.endsWith('/api/community/rules')) {
        return Promise.resolve(response({ private: [], community: [] }));
      }
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  async function expectConfiguredSync(
    preferences: (typeof syncCombinations)[number],
    expectedPrivate: CategoryRule[],
    expectedCommunity: CategoryRule[],
    expectCommunityFetch = true,
  ): Promise<void> {
    if (preferences.useCommunityRules && expectCommunityFetch) {
      await waitFor(() =>
        expect(
          calls.some(
            ({ url, init }) => url.includes('/api/rules?include_community=true') && !init?.method,
          ),
        ).toBe(true),
      );
    }
    if (preferences.storePrivateRules) {
      await waitFor(() =>
        expect(
          calls.some(({ url, init }) => url.endsWith('/api/rules') && init?.method === 'PUT'),
        ).toBe(true),
      );
      const privateUpload = calls.find(
        ({ url, init }) => url.endsWith('/api/rules') && init?.method === 'PUT',
      );
      expect(requestBody(privateUpload?.init)).toEqual({ rules: expectedPrivate });
    }
    if (preferences.contributeRules) {
      await waitFor(() =>
        expect(
          calls.some(
            ({ url, init }) => url.endsWith('/api/community/rules') && init?.method === 'POST',
          ),
        ).toBe(true),
      );
      const communityUpload = calls.find(
        ({ url, init }) => url.endsWith('/api/community/rules') && init?.method === 'POST',
      );
      expect(requestBody(communityUpload?.init)).toEqual({ rules: expectedCommunity });
    }
  }

  it('keeps local rules local until opted in, then separates private and community uploads', async () => {
    saveLocalRules([globalRule, privateRule]);
    const { result } = renderHook(() => useRuleSync(signedIn, 'alice'));

    await waitFor(() =>
      expect(calls.some(({ url }) => url.endsWith('/default-rules.json'))).toBe(true),
    );
    expect(calls.filter(({ url }) => url.includes('/api/'))).toHaveLength(0);

    act(() => {
      result.current.updateRulePreferences({
        ...DEFAULT_RULE_PREFERENCES,
        storePrivateRules: true,
        contributeRules: true,
      });
    });

    await waitFor(() =>
      expect(
        calls.some(({ url, init }) => url.endsWith('/api/rules') && init?.method === 'PUT'),
      ).toBe(true),
    );
    const privateUpload = calls.find(
      ({ url, init }) => url.endsWith('/api/rules') && init?.method === 'PUT',
    );
    const communityUpload = calls.find(
      ({ url, init }) => url.endsWith('/api/community/rules') && init?.method === 'POST',
    );
    expect(requestBody(privateUpload?.init)).toEqual({
      rules: [globalRule, privateRule],
    });
    expect(requestBody(communityUpload?.init)).toEqual({ rules: [globalRule] });
  });

  it('keeps local state and exposes a useful status when a server sync fails', async () => {
    saveLocalRules([privateRule]);
    saveRulePreferences({ ...DEFAULT_RULE_PREFERENCES, storePrivateRules: true }, 'alice');
    failPrivatePut = true;

    const { result } = renderHook(() => useRuleSync(signedIn, 'alice'));
    await waitFor(() =>
      expect(calls.some(({ url, init }) => url.endsWith('/api/rules') && !init?.method)).toBe(true),
    );

    act(() => {
      void result.current.replaceRules([privateRule]);
    });

    await waitFor(() => expect(result.current.ruleSyncStatus).toContain('Could not sync rules'));
    expect(result.current.localRules).toEqual([privateRule]);
  });

  it('keeps custom browser rules across reload, logout, and another login', async () => {
    saveLocalRules([privateRule]);
    const first = renderHook(
      ({ auth }: { auth: AuthSnapshot }) =>
        useRuleSync(auth, auth.user?.sub ?? 'authenticated-user'),
      { initialProps: { auth: signedIn } },
    );

    await waitFor(() => expect(first.result.current.localRules).toEqual([privateRule]));
    first.rerender({ auth: signedOut });
    expect(first.result.current.localRules).toEqual([privateRule]);
    first.rerender({ auth: signedInAsBob });
    expect(first.result.current.localRules).toEqual([privateRule]);
    first.unmount();

    const reloaded = renderHook(() => useRuleSync(signedInAsBob, 'bob'));
    expect(reloaded.result.current.localRules).toEqual([privateRule]);
  });

  it.each(syncCombinations)(
    'syncs rules created before login for the $name combination',
    async ({ storePrivateRules, useCommunityRules, contributeRules }) => {
      saveLocalRules([globalRule, privateRule]);
      const view = renderHook(
        ({ auth }: { auth: AuthSnapshot }) =>
          useRuleSync(auth, auth.user?.sub ?? 'authenticated-user'),
        { initialProps: { auth: signedOut } },
      );

      await waitFor(() =>
        expect(calls.some(({ url }) => url.endsWith('/default-rules.json'))).toBe(true),
      );
      expect(calls.filter(({ url }) => url.includes('/api/'))).toHaveLength(0);

      view.rerender({ auth: signedIn });
      act(() => {
        view.result.current.updateRulePreferences({
          storePrivateRules,
          useCommunityRules,
          contributeRules,
        });
      });

      if (useCommunityRules) {
        await waitFor(() =>
          expect(
            calls.some(
              ({ url, init }) => url.includes('/api/rules?include_community=true') && !init?.method,
            ),
          ).toBe(true),
        );
      }

      if (storePrivateRules) {
        await waitFor(() =>
          expect(
            calls.some(({ url, init }) => url.endsWith('/api/rules') && init?.method === 'PUT'),
          ).toBe(true),
        );
        const privateUpload = calls.find(
          ({ url, init }) => url.endsWith('/api/rules') && init?.method === 'PUT',
        );
        expect(requestBody(privateUpload?.init)).toEqual({ rules: [globalRule, privateRule] });
      }
      if (contributeRules) {
        await waitFor(() =>
          expect(
            calls.some(
              ({ url, init }) => url.endsWith('/api/community/rules') && init?.method === 'POST',
            ),
          ).toBe(true),
        );
        const communityUpload = calls.find(
          ({ url, init }) => url.endsWith('/api/community/rules') && init?.method === 'POST',
        );
        expect(requestBody(communityUpload?.init)).toEqual({ rules: [globalRule] });
      }
      if (!storePrivateRules && !contributeRules) {
        expect(
          calls.some(({ url, init }) => url.endsWith('/api/rules') && init?.method === 'PUT'),
        ).toBe(false);
        expect(
          calls.some(
            ({ url, init }) => url.endsWith('/api/community/rules') && init?.method === 'POST',
          ),
        ).toBe(false);
      }

      view.rerender({ auth: signedOut });
      expect(view.result.current.localRules).toEqual([globalRule, privateRule]);
      view.rerender({ auth: signedInAsBob });
      expect(view.result.current.localRules).toEqual([globalRule, privateRule]);
    },
  );

  it.each(syncCombinations)(
    'syncs imported rules made before login for the $name combination',
    async (preferences) => {
      const imported = parseImportedRules(JSON.stringify(importedRuleSet));
      if (!imported) throw new Error('test fixture should be valid');
      saveLocalRules(imported);
      const view = renderHook(
        ({ auth }: { auth: AuthSnapshot }) =>
          useRuleSync(auth, auth.user?.sub ?? 'authenticated-user'),
        { initialProps: { auth: signedOut } },
      );

      await waitFor(() =>
        expect(calls.some(({ url }) => url.endsWith('/default-rules.json'))).toBe(true),
      );
      view.rerender({ auth: signedIn });
      act(() => view.result.current.updateRulePreferences(preferences));
      await expectConfiguredSync(preferences, imported, [globalRule]);
      expect(view.result.current.localRules).toEqual(imported);
    },
  );

  it.each(syncCombinations)(
    'syncs rules created after login for the $name combination',
    async (preferences) => {
      const view = renderHook(
        ({ auth }: { auth: AuthSnapshot }) =>
          useRuleSync(auth, auth.user?.sub ?? 'authenticated-user'),
        { initialProps: { auth: signedOut } },
      );
      await waitFor(() =>
        expect(calls.some(({ url }) => url.endsWith('/default-rules.json'))).toBe(true),
      );
      view.rerender({ auth: signedIn });
      act(() => view.result.current.updateRulePreferences(preferences));
      await expectConfiguredSync(preferences, [], []);
      calls.length = 0;

      act(() => view.result.current.addRule(privateRule));
      await expectConfiguredSync(preferences, [privateRule], [], false);
      expect(view.result.current.localRules).toEqual([privateRule]);
    },
  );

  it.each(syncCombinations)(
    'syncs rules imported after login for the $name combination',
    async (preferences) => {
      const view = renderHook(
        ({ auth }: { auth: AuthSnapshot }) =>
          useRuleSync(auth, auth.user?.sub ?? 'authenticated-user'),
        { initialProps: { auth: signedOut } },
      );
      await waitFor(() =>
        expect(calls.some(({ url }) => url.endsWith('/default-rules.json'))).toBe(true),
      );
      view.rerender({ auth: signedIn });
      act(() => view.result.current.updateRulePreferences(preferences));
      await expectConfiguredSync(preferences, [], []);
      calls.length = 0;

      const imported = parseImportedRules(JSON.stringify(importedRuleSet));
      if (!imported) throw new Error('test fixture should be valid');
      act(() => view.result.current.replaceLocalRules(imported));
      await expectConfiguredSync(preferences, imported, [globalRule], false);
      expect(view.result.current.localRules).toEqual(imported);
    },
  );

  it.each(
    ruleOrigins.flatMap((origin) =>
      syncCombinations.map((preferences) => ({ origin, preferences })),
    ),
  )(
    'syncs $origin rules after logout and a second login for the $preferences.name combination',
    async ({ origin, preferences }) => {
      const rules =
        origin === 'created'
          ? [privateRule]
          : (parseImportedRules(JSON.stringify(importedRuleSet)) ?? []);
      saveLocalRules(rules);
      const view = renderHook(
        ({ auth }: { auth: AuthSnapshot }) =>
          useRuleSync(auth, auth.user?.sub ?? 'authenticated-user'),
        { initialProps: { auth: signedOut } },
      );
      await waitFor(() =>
        expect(calls.some(({ url }) => url.endsWith('/default-rules.json'))).toBe(true),
      );
      view.rerender({ auth: signedIn });
      view.rerender({ auth: signedOut });
      view.rerender({ auth: signedInAsBob });
      act(() => view.result.current.updateRulePreferences(preferences));
      await expectConfiguredSync(preferences, rules, origin === 'imported' ? [globalRule] : []);
      expect(view.result.current.localRules).toEqual(rules);
    },
  );
});
