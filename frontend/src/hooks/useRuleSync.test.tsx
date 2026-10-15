import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseImportedRules, saveLocalRules } from '../data/rules';
import { saveRulePreferences } from '../data/preferences';
import type { AuthSnapshot, CategoryRule, ClassificationRule } from '../types';
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

const updatedRule: CategoryRule = {
  keyword: 'PRIVATE SHOP UPDATED',
  category: 'my-category',
  column: 'both',
};

const aiRule: ClassificationRule = {
  keyword: 'CLASSIFIED SHOP',
  category: 'items',
  column: 'recipient',
  confidence: 0.94,
};

const importedRuleSet = [globalRule, privateRule];
const ruleOrigins = ['created', 'imported'] as const;
const localOnlyPreferences = {
  storePrivateRules: false,
  useCommunityRules: false,
  contributeRules: false,
};
type SyncPreferences = Pick<
  (typeof syncCombinations)[number],
  'storePrivateRules' | 'useCommunityRules' | 'contributeRules'
>;

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

function preferenceValues(preferences: SyncPreferences): SyncPreferences {
  return {
    storePrivateRules: preferences.storePrivateRules,
    useCommunityRules: preferences.useCommunityRules,
    contributeRules: preferences.contributeRules,
  };
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
    preferences: SyncPreferences,
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
    if (!preferences.storePrivateRules) {
      expect(
        calls.some(({ url, init }) => url.endsWith('/api/rules') && init?.method === 'PUT'),
      ).toBe(false);
    }
    if (!preferences.contributeRules) {
      expect(
        calls.some(
          ({ url, init }) => url.endsWith('/api/community/rules') && init?.method === 'POST',
        ),
      ).toBe(false);
    }
  }

  it('keeps local rules local until opted in, then separates private and community uploads', async () => {
    saveLocalRules([globalRule, privateRule]);
    saveRulePreferences(localOnlyPreferences, 'alice');
    const { result } = renderHook(() => useRuleSync(signedIn, 'alice'));

    await waitFor(() =>
      expect(calls.some(({ url }) => url.endsWith('/default-rules.json'))).toBe(true),
    );
    expect(calls.filter(({ url }) => url.includes('/api/'))).toHaveLength(0);

    act(() => {
      result.current.updateRulePreferences({
        ...localOnlyPreferences,
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

  it('automatically syncs pre-login rules on login with all default destinations enabled', async () => {
    saveLocalRules([globalRule, privateRule]);
    const view = renderHook(
      ({ auth }: { auth: AuthSnapshot }) =>
        useRuleSync(auth, auth.user?.sub ?? 'authenticated-user'),
      { initialProps: { auth: signedOut } },
    );

    await waitFor(() =>
      expect(calls.some(({ url }) => url.endsWith('/default-rules.json'))).toBe(true),
    );
    view.rerender({ auth: signedIn });

    await waitFor(() =>
      expect(
        calls.some(({ url, init }) => url.endsWith('/api/rules') && init?.method === 'PUT'),
      ).toBe(true),
    );
    await waitFor(() =>
      expect(
        calls.some(
          ({ url, init }) => url.endsWith('/api/community/rules') && init?.method === 'POST',
        ),
      ).toBe(true),
    );
    expect(
      requestBody(
        calls.find(({ url, init }) => url.endsWith('/api/rules') && init?.method === 'PUT')?.init,
      ),
    ).toEqual({ rules: [globalRule, privateRule] });
    expect(
      requestBody(
        calls.find(
          ({ url, init }) => url.endsWith('/api/community/rules') && init?.method === 'POST',
        )?.init,
      ),
    ).toEqual({ rules: [globalRule] });
  });

  it('keeps local state and exposes a useful status when a server sync fails', async () => {
    saveLocalRules([privateRule]);
    saveRulePreferences(
      { storePrivateRules: true, useCommunityRules: false, contributeRules: false },
      'alice',
    );
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
      saveRulePreferences({ storePrivateRules, useCommunityRules, contributeRules }, 'alice');
      saveRulePreferences({ storePrivateRules, useCommunityRules, contributeRules }, 'bob');
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
      await expectConfiguredSync(
        { storePrivateRules, useCommunityRules, contributeRules },
        [globalRule, privateRule],
        [globalRule],
      );

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
      saveRulePreferences(
        {
          storePrivateRules: preferences.storePrivateRules,
          useCommunityRules: preferences.useCommunityRules,
          contributeRules: preferences.contributeRules,
        },
        'alice',
      );
      saveRulePreferences(
        {
          storePrivateRules: preferences.storePrivateRules,
          useCommunityRules: preferences.useCommunityRules,
          contributeRules: preferences.contributeRules,
        },
        'bob',
      );
      const view = renderHook(
        ({ auth }: { auth: AuthSnapshot }) =>
          useRuleSync(auth, auth.user?.sub ?? 'authenticated-user'),
        { initialProps: { auth: signedOut } },
      );

      await waitFor(() =>
        expect(calls.some(({ url }) => url.endsWith('/default-rules.json'))).toBe(true),
      );
      view.rerender({ auth: signedIn });
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
    ['before login', 'after login'].flatMap((timing) =>
      syncCombinations.map((preferences) => ({ timing, preferences })),
    ),
  )(
    'syncs updated rules made $timing for the $preferences.name combination',
    async ({ timing, preferences }) => {
      const originalRules = [privateRule, globalRule];
      saveLocalRules(originalRules);
      saveRulePreferences(preferenceValues(preferences), 'alice');
      const view = renderHook(
        ({ auth }: { auth: AuthSnapshot }) =>
          useRuleSync(auth, auth.user?.sub ?? 'authenticated-user'),
        { initialProps: { auth: signedOut } },
      );

      await waitFor(() =>
        expect(calls.some(({ url }) => url.endsWith('/default-rules.json'))).toBe(true),
      );
      if (timing === 'after login') {
        view.rerender({ auth: signedIn });
        await expectConfiguredSync(preferences, originalRules, [globalRule]);
        calls.length = 0;
      }

      act(() => view.result.current.updateUserRule(privateRule, updatedRule));
      expect(view.result.current.localRules).toEqual([updatedRule, globalRule]);
      if (timing === 'before login') view.rerender({ auth: signedIn });

      await expectConfiguredSync(
        preferences,
        [updatedRule, globalRule],
        [globalRule],
        timing === 'before login',
      );
    },
  );

  it.each(
    ['before login', 'after login'].flatMap((timing) =>
      syncCombinations.map((preferences) => ({ timing, preferences })),
    ),
  )(
    'syncs deleted rules made $timing for the $preferences.name combination',
    async ({ timing, preferences }) => {
      const originalRules = [privateRule, globalRule];
      saveLocalRules(originalRules);
      saveRulePreferences(preferenceValues(preferences), 'alice');
      const view = renderHook(
        ({ auth }: { auth: AuthSnapshot }) =>
          useRuleSync(auth, auth.user?.sub ?? 'authenticated-user'),
        { initialProps: { auth: signedOut } },
      );

      await waitFor(() =>
        expect(calls.some(({ url }) => url.endsWith('/default-rules.json'))).toBe(true),
      );
      if (timing === 'after login') {
        view.rerender({ auth: signedIn });
        await expectConfiguredSync(preferences, originalRules, [globalRule]);
        calls.length = 0;
      }

      act(() => view.result.current.deleteUserRule(privateRule));
      expect(view.result.current.localRules).toEqual([globalRule]);
      if (timing === 'before login') view.rerender({ auth: signedIn });

      await expectConfiguredSync(
        preferences,
        [globalRule],
        [globalRule],
        timing === 'before login',
      );
    },
  );

  it.each(syncCombinations)(
    'syncs AI-created rules after login for the $name combination',
    async (preferences) => {
      saveRulePreferences(preferenceValues(preferences), 'alice');
      const view = renderHook(
        ({ auth }: { auth: AuthSnapshot }) =>
          useRuleSync(auth, auth.user?.sub ?? 'authenticated-user'),
        { initialProps: { auth: signedOut } },
      );

      await waitFor(() =>
        expect(calls.some(({ url }) => url.endsWith('/default-rules.json'))).toBe(true),
      );
      view.rerender({ auth: signedIn });
      if (preferences.useCommunityRules) {
        await waitFor(() =>
          expect(
            calls.some(
              ({ url, init }) => url.includes('/api/rules?include_community=true') && !init?.method,
            ),
          ).toBe(true),
        );
      }
      calls.length = 0;

      act(() => view.result.current.addRules([aiRule]));
      await expectConfiguredSync(preferences, [aiRule], [aiRule], false);
      expect(view.result.current.localRules).toEqual([aiRule]);
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
      saveRulePreferences(
        {
          storePrivateRules: preferences.storePrivateRules,
          useCommunityRules: preferences.useCommunityRules,
          contributeRules: preferences.contributeRules,
        },
        'alice',
      );
      saveRulePreferences(
        {
          storePrivateRules: preferences.storePrivateRules,
          useCommunityRules: preferences.useCommunityRules,
          contributeRules: preferences.contributeRules,
        },
        'bob',
      );
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
      await expectConfiguredSync(preferences, rules, origin === 'imported' ? [globalRule] : []);
      expect(view.result.current.localRules).toEqual(rules);
    },
  );
});
