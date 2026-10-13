import { z } from 'zod';
import type { AppConfig } from './types';

const AppConfigSchema = z
  .object({
    keycloakIssuer: z.string(),
    keycloakClientId: z.string(),
    apiBaseUrl: z.string(),
  })
  .strict();

declare global {
  interface Window {
    APP_CONFIG?: unknown;
  }
}

export function getAppConfig(): AppConfig {
  const result = AppConfigSchema.safeParse(window.APP_CONFIG ?? {});
  return result.success
    ? result.data
    : { keycloakIssuer: '', keycloakClientId: '', apiBaseUrl: '' };
}
