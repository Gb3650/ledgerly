import { NavLink } from 'react-router-dom';

export type HubTab = { to: string; label: string; end?: boolean };

export function HubTabs({ tabs }: { tabs: HubTab[] }) {
  return (
    <nav className="hub-tabs" aria-label="Section">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) => `hub-tab ${isActive ? 'active' : ''}`}
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}

/** QBO Sales hub: Overview / Invoices / Estimates / Customers / Products & services */
export const salesHubTabs: HubTab[] = [
  { to: '/sales', label: 'Overview', end: true },
  { to: '/invoices', label: 'Invoices' },
  { to: '/quotes', label: 'Estimates' },
  { to: '/sales-receipts', label: 'Sales receipts' },
  { to: '/credit-memos', label: 'Credit memos' },
  { to: '/refunds', label: 'Refunds' },
  { to: '/customers', label: 'Customers' },
  { to: '/products', label: 'Products & services' },
];

/** QBO Expenses center: Expenses · Vendors · Bills · Purchase orders · Inventory */
export const expensesHubTabs: HubTab[] = [
  { to: '/expenses', label: 'Expenses', end: true },
  { to: '/vendors', label: 'Vendors' },
  { to: '/bills', label: 'Bills' },
  { to: '/vendor-credits', label: 'Vendor credits' },
  { to: '/purchase-orders', label: 'Purchase orders' },
  { to: '/inventory', label: 'Inventory' },
];

export const bankingHubTabs: HubTab[] = [
  { to: '/banking', label: 'Bank transactions', end: true },
  { to: '/checks', label: 'Checks' },
  { to: '/bank-deposit', label: 'Bank deposit' },
  { to: '/transfer', label: 'Transfer' },
  { to: '/reconcile', label: 'Reconcile' },
];

export const accountingHubTabs: HubTab[] = [
  { to: '/accounts', label: 'Chart of accounts', end: true },
  { to: '/journals', label: 'Journal entries' },
  { to: '/reconcile', label: 'Reconcile' },
];
