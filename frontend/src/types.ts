import { z } from 'zod';

// Kept only for the legacy community-contribution compatibility path. New users
// never receive these as categories; personal categories start empty.
export const LEGACY_COMMUNITY_CATEGORIES = [
  'groceries',
  'restaurant',
  'paypal',
  'vacation',
  'items',
  'entertainment',
  'rent/insurance/elec/mobility',
  'bargeld',
  'umbuchung',
  'mix',
] as const;

export const RuleColumnSchema = z.enum(['recipient', 'purpose', 'both']);
export type RuleColumn = z.infer<typeof RuleColumnSchema>;

export const CategoryRuleSchema = z
  .object({
    keyword: z.string().min(3).max(200),
    category: z.string().min(1).max(80),
    column: RuleColumnSchema,
    confidence: z.number().min(0).max(1).optional(),
  })
  .strict();
export type CategoryRule = z.infer<typeof CategoryRuleSchema>;

export const RulePreferencesSchema = z
  .object({
    storePrivateRules: z.boolean(),
    useCommunityRules: z.boolean(),
    contributeRules: z.boolean(),
  })
  .strict();
export type RulePreferences = z.infer<typeof RulePreferencesSchema>;

export const TransactionSchema = z
  .object({
    id: z.string(),
    date: z.string(),
    period: z.string(),
    recipient: z.string(),
    purpose: z.string(),
    type: z.string(),
    amount: z.number(),
    category: z.string(),
  })
  .strict();

export const ClassificationRuleSchema = CategoryRuleSchema.extend({
  confidence: z.number().min(0).max(1),
});
export type ClassificationRule = z.infer<typeof ClassificationRuleSchema>;

export const ClassificationResponseSchema = z
  .object({
    rules: z.array(ClassificationRuleSchema),
  })
  .strict();

export const ClassificationRequestSchema = z
  .object({
    transactions: z
      .array(
        z
          .object({
            id: z.union([z.string(), z.number()]).nullable().optional(),
            recipient: z.string().max(500),
            purpose: z.string().max(2000),
          })
          .strict(),
      )
      .min(1)
      .max(500),
    categories: z.array(z.string().min(1).max(80)).min(1).max(50),
    confidence_threshold: z.number().min(0).max(1),
  })
  .strict();

export interface Transaction {
  id: string;
  date: string;
  period: string;
  recipient: string;
  purpose: string;
  type: string;
  amount: number;
  category: string;
}

export interface AppConfig {
  keycloakIssuer: string;
  keycloakClientId: string;
  apiBaseUrl: string;
}

export interface AuthSnapshot {
  token: string | null;
  user: UserClaims | null;
  setupError: string | null;
}

export interface UserClaims {
  sub?: string | undefined;
  name?: string | undefined;
  preferred_username?: string | undefined;
  email?: string | undefined;
}
