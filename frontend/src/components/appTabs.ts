export const APP_TABS = ['dashboard', 'unknown', 'categories', 'all'] as const;
export type AppTab = (typeof APP_TABS)[number];
