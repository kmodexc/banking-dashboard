import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OIDC_SESSION_STORAGE_KEY, OidcClient } from './auth';
import type { AppConfig } from './types';

const config: AppConfig = {
  keycloakIssuer: 'https://login.example.test/realms/dashboard',
  keycloakClientId: 'dashboard-client',
  apiBaseUrl: '',
};

const discovery = {
  authorization_endpoint: 'https://login.example.test/realms/dashboard/auth',
  token_endpoint: 'https://login.example.test/realms/dashboard/token',
};

function token(): string {
  const payload = btoa(JSON.stringify({ sub: 'reload-user', preferred_username: 'reload-user' }));
  return `header.${payload}.signature`;
}

function response(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

describe('OIDC session persistence', () => {
  beforeEach(() => {
    sessionStorage.clear();
    history.replaceState({}, '', '/');
  });

  it('restores the app-scoped token set when a new client initializes after reload', async () => {
    const accessToken = token();
    const fetchMock = vi.fn((input: RequestInfo | URL): Promise<Response> => {
      const url =
        input instanceof Request ? input.url : input instanceof URL ? input.toString() : input;
      if (url.endsWith('/.well-known/openid-configuration')) {
        return Promise.resolve(response(discovery));
      }
      return Promise.resolve(
        response({ access_token: accessToken, refresh_token: 'reload-refresh', expires_in: 3600 }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    sessionStorage.setItem('oidc_state', 'state');
    sessionStorage.setItem('oidc_verifier', 'verifier');
    history.replaceState({}, '', '/?code=one-time-code&state=state');
    const firstClient = new OidcClient(config);
    await expect(firstClient.initialize()).resolves.toMatchObject({
      token: accessToken,
      user: { sub: 'reload-user' },
      setupError: null,
    });

    history.replaceState({}, '', '/');
    const reloadedClient = new OidcClient(config);
    await expect(reloadedClient.initialize()).resolves.toMatchObject({
      token: accessToken,
      user: { sub: 'reload-user' },
      setupError: null,
    });
    expect(sessionStorage.getItem(OIDC_SESSION_STORAGE_KEY)).toContain('reload-refresh');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('removes persisted tokens on logout', async () => {
    sessionStorage.setItem(
      OIDC_SESSION_STORAGE_KEY,
      JSON.stringify({
        access_token: token(),
        refresh_token: 'reload-refresh',
        expires_at: Date.now() + 3_600_000,
      }),
    );
    const navigation = { assign: vi.fn(), reload: vi.fn() };
    const client = new OidcClient(config, navigation);
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(response(discovery))),
    );
    await client.initialize();

    client.logout();

    expect(sessionStorage.getItem(OIDC_SESSION_STORAGE_KEY)).toBeNull();
    expect(navigation.reload).toHaveBeenCalledOnce();
  });
});
