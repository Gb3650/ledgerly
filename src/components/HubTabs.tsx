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

export const salesHubTabs: HubTab[] = [
  { to: '/sales', label: 'All sales', end: true },
  { to: '/invoices', label: 'Invoices' },
  { to: '/quotes', label: 'Estimates' },
  { to: '/sales-receipts', label: 'Sales receipts' },
  { to: '/customers', label: 'Customers' },
  { to: '/products', label: 'Products & services' },
  { to: '/receive-payment', label: 'Receive payment' },
];

export const expensesHubTabs: HubTab[] = [
  { to: '/expenses', label: 'Expenses', end: true },
  { to: '/bills', label: 'Bills' },
  { to: '/vendors', label: 'Vendors' },
  { to: '/purchase-orders', label: 'Purchase orders' },
  { to: '/pay-bills', label: 'Pay bills' },
  { to: '/inventory', label: 'Inventory' },
];
