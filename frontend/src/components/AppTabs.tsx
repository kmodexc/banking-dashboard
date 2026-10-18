import type { ReactElement } from 'react';
import { APP_TABS, type AppTab } from './appTabs';

const TAB_LABELS: Record<AppTab, string> = {
  dashboard: 'Dashboard',
  plan: 'Plan',
  unknown: 'Categorize unknown',
  categories: 'Categories',
  all: 'All transactions',
};

export function AppTabs({
  activeTab,
  onChange,
}: {
  activeTab: AppTab;
  onChange: (tab: AppTab) => void;
}): ReactElement {
  return (
    <nav className="tabs" aria-label="Dashboard sections">
      {APP_TABS.map((tab) => (
        <button
          className={`tab${activeTab === tab ? ' active' : ''}`}
          data-tab={tab}
          key={tab}
          onClick={() => onChange(tab)}
        >
          {TAB_LABELS[tab]}
        </button>
      ))}
    </nav>
  );
}
