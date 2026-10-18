export const APP_TABS = ['dashboard', 'plan', 'unknown', 'categories', 'all', 'account'] as const;
export type AppTab = (typeof APP_TABS)[number];
