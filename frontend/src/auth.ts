import { z } from 'zod';
import type { AppConfig, AuthSnapshot, UserClaims } from './types';

const DiscoverySchema = z
  .object({
    authorization_endpoint: z.string().url(),
    token_endpoint: z.string().url(),
    end_session_endpoint: z.string().url().optional(),
  })
  .passthrough();
type Discovery = z.infer<typeof DiscoverySchema>;
type Navigation = Pick<Location, 'assign' | 'reload'>;

const TokenResponseSchema = z
  .object({
    access_token: z.string().min(1),
    refresh_token: z.string().min(1).optional(),
    expires_in: z.number().positive().optional(),
  })
  .passthrough();

const PersistedTokenSchema = z
  .object({
    access_token: z.string().min(1),
    refresh_token: z.string().min(1).nullable(),
    expires_at: z.number().finite().positive(),
  })
  .strict();

export const OIDC_SESSION_STORAGE_KEY = 'dkb-dashboard-oidc-session-v1';

const UserClaimsSchema = z
  .object({
    sub: z.string().optional(),
    name: z.string().optional(),
    preferred_username: z.string().optional(),
    email: z.string().optional(),
  })
  .passthrough();

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomString(bytes = 32): string {
  const values = new Uint8Array(bytes);
  crypto.getRandomValues(values);
  return base64Url(values);
}

async function sha256(value: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
}

function decodeJwt(token: string): UserClaims {
  try {
    const payload = token.split('.')[1];
    if (!payload) return {};
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const result = UserClaimsSchema.safeParse(JSON.parse(decoded) as unknown);
    return result.success ? result.data : {};
  } catch {
    return {};
  }
}

function assertResponse(response: Response): Response {
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response;
}

export class OidcClient {
  private readonly config: AppConfig;
  private readonly navigation: Navigation;
  private discovery: Discovery | null = null;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private expiresAt = 0;
  private user: UserClaims | null = null;
  private initialization: Promise<AuthSnapshot> | null = null;

  public constructor(config: AppConfig, navigation: Navigation = window.location) {
    this.config = config;
    this.navigation = navigation;
  }

  public get snapshot(): AuthSnapshot {
    return { token: this.accessToken, user: this.user, setupError: null };
  }

  public initialize(): Promise<AuthSnapshot> {
    if (!this.initialization) this.initialization = this.initializeOnce();
    return this.initialization;
  }

  private async initializeOnce(): Promise<AuthSnapshot> {
    if (!this.config.keycloakIssuer || !this.config.keycloakClientId) {
      return {
        token: null,
        user: null,
        setupError:
          'Set KEYCLOAK_ISSUER and KEYCLOAK_CLIENT_ID on the API before enabling sign-in.',
      };
    }

    try {
      const response = await fetch(
        `${this.config.keycloakIssuer.replace(/\/$/, '')}/.well-known/openid-configuration`,
      );
      this.discovery = DiscoverySchema.parse((await assertResponse(response).json()) as unknown);
      this.restoreTokens();
      const params = new URLSearchParams(location.search);
      if (params.has('error'))
        throw new Error(params.get('error_description') || params.get('error') || 'Sign-in failed');
      const code = params.get('code');
      if (code) await this.exchangeCode(code, params.get('state'));
      else if (this.accessToken && this.refreshToken && Date.now() >= this.expiresAt - 30_000) {
        try {
          await this.token();
        } catch {
          // A stale persisted session is treated as signed out.
        }
      }
      return this.snapshot;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        token: null,
        user: null,
        setupError: `Sign-in setup failed: ${message}`,
      };
    }
  }

  public async login(): Promise<void> {
    if (!this.discovery) return;
    const verifier = randomString();
    const state = randomString(16);
    const challenge = base64Url(new Uint8Array(await sha256(verifier)));
    sessionStorage.setItem('oidc_state', state);
    sessionStorage.setItem('oidc_verifier', verifier);
    const params = new URLSearchParams({
      client_id: this.config.keycloakClientId,
      redirect_uri: this.redirectUri(),
      response_type: 'code',
      scope: 'openid profile email',
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });
    location.assign(`${this.discovery.authorization_endpoint}?${params}`);
  }

  public logout(): void {
    const endpoint = this.discovery?.end_session_endpoint;
    const params = new URLSearchParams({
      post_logout_redirect_uri: this.redirectUri(),
      client_id: this.config.keycloakClientId,
    });
    this.clearTokens();
    if (endpoint) this.navigation.assign(`${endpoint}?${params}`);
    else this.navigation.reload();
  }

  public async token(): Promise<string> {
    if (!this.accessToken) throw new Error('Please sign in first');
    if (Date.now() < this.expiresAt - 30_000 || !this.refreshToken) return this.accessToken;
    if (!this.discovery) throw new Error('Sign-in is not initialized');

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: this.config.keycloakClientId,
      refresh_token: this.refreshToken,
    });
    const response = await fetch(this.discovery.token_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!response.ok) {
      this.clearTokens();
      throw new Error('Your session expired; sign in again');
    }
    this.setTokens((await response.json()) as unknown);
    return this.accessToken;
  }

  private async exchangeCode(code: string, returnedState: string | null): Promise<void> {
    if (!this.discovery) throw new Error('Sign-in is not initialized');
    const expectedState = sessionStorage.getItem('oidc_state');
    const verifier = sessionStorage.getItem('oidc_verifier');
    sessionStorage.removeItem('oidc_state');
    sessionStorage.removeItem('oidc_verifier');
    if (!expectedState || expectedState !== returnedState || !verifier)
      throw new Error('Invalid sign-in state');

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.config.keycloakClientId,
      redirect_uri: this.redirectUri(),
      code,
      code_verifier: verifier,
    });
    const response = await fetch(this.discovery.token_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!response.ok) throw new Error('Keycloak rejected the sign-in code');
    this.setTokens((await response.json()) as unknown);
    history.replaceState({}, document.title, location.pathname);
  }

  private setTokens(value: unknown): void {
    const tokens = TokenResponseSchema.parse(value);
    this.accessToken = tokens.access_token;
    this.refreshToken = tokens.refresh_token ?? null;
    this.expiresAt = Date.now() + (tokens.expires_in ?? 60) * 1000;
    this.user = decodeJwt(this.accessToken);
    this.persistTokens();
  }

  private restoreTokens(): void {
    try {
      const value = sessionStorage.getItem(OIDC_SESSION_STORAGE_KEY);
      if (!value) return;
      const tokens = PersistedTokenSchema.safeParse(JSON.parse(value) as unknown);
      if (!tokens.success || (tokens.data.expires_at <= Date.now() && !tokens.data.refresh_token)) {
        this.clearTokens();
        return;
      }
      this.accessToken = tokens.data.access_token;
      this.refreshToken = tokens.data.refresh_token;
      this.expiresAt = tokens.data.expires_at;
      this.user = decodeJwt(this.accessToken);
    } catch {
      this.clearTokens();
    }
  }

  private persistTokens(): void {
    if (!this.accessToken) return;
    try {
      sessionStorage.setItem(
        OIDC_SESSION_STORAGE_KEY,
        JSON.stringify({
          access_token: this.accessToken,
          refresh_token: this.refreshToken,
          expires_at: this.expiresAt,
        }),
      );
    } catch {
      // Session persistence is best effort; the in-memory session remains usable.
    }
  }

  private clearTokens(): void {
    this.accessToken = null;
    this.refreshToken = null;
    this.expiresAt = 0;
    this.user = null;
    try {
      sessionStorage.removeItem(OIDC_SESSION_STORAGE_KEY);
    } catch {
      // Storage may be unavailable; the in-memory session is still cleared.
    }
  }

  private redirectUri(): string {
    return `${location.origin}${location.pathname}`;
  }
}
