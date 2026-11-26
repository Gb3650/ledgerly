import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  BookOpen,
  Building2,
  CreditCard,
  FileText,
  Grid3x3,
  HelpCircle,
  LayoutDashboard,
  Menu,
  Percent,
  Plus,
  Search,
  Settings,
  Wallet,
  X,
} from 'lucide-react';
import { Modal } from './Modal';
import { useBooks } from '../store/BooksContext';

/** QBO Accountant View — left navigation */
const navItems: Array<{
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
  end?: boolean;
}> = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/banking', icon: Wallet, label: 'Banking' },
  { to: '/sales', icon: FileText, label: 'Sales' },
  { to: '/expenses', icon: CreditCard, label: 'Expenses' },
  { to: '/reports', icon: BarChart3, label: 'Reports' },
  { to: '/taxes', icon: Percent, label: 'Taxes' },
  { to: '/accounts', icon: BookOpen, label: 'Accounting' },
  { to: '/apps', icon: Grid3x3, label: 'Apps' },
];

/** QBO + New menu: Customers | Vendors | Other */
const newMenu = [
  {
    label: 'CUSTOMERS',
    items: [
      { to: '/invoices?new=1', label: 'Invoice' },
      { to: '/receive-payment', label: 'Receive payment' },
      { to: '/quotes?new=1', label: 'Estimate' },
      { to: '/sales-receipts?new=1', label: 'Sales receipt' },
      { to: '/customers?new=1', label: 'Customer' },
      { to: '/products', label: 'Product/service' },
    ],
  },
  {
    label: 'VENDORS',
    items: [
      { to: '/expenses?new=1', label: 'Expense' },
      { to: '/checks?new=1', label: 'Check' },
      { to: '/bills?new=1', label: 'Bill' },
      { to: '/pay-bills', label: 'Pay bills' },
      { to: '/purchase-orders?new=1', label: 'Purchase order' },
      { to: '/vendors?new=1', label: 'Vendor' },
    ],
  },
  {
    label: 'OTHER',
    items: [
      { to: '/bank-deposit', label: 'Bank deposit' },
      { to: '/transfer', label: 'Transfer' },
      { to: '/reconcile', label: 'Reconcile' },
      { to: '/inventory', label: 'Inventory qty adjustment' },
      { to: '/accounts', label: 'Chart of accounts' },
    ],
  },
];

const gearMenu = [
  {
    label: 'YOUR COMPANY',
    items: [
      { to: '/settings', label: 'Account and settings' },
      { to: '/settings#sales-tax', label: 'Sales tax' },
      { to: '/recurring', label: 'Recurring transactions' },
      { to: '/accounts', label: 'Chart of accounts' },
      { to: '/products', label: 'Products and services' },
      { to: '/reconcile', label: 'Reconcile' },
    ],
  },
  {
    label: 'LISTS',
    items: [
      { to: '/customers', label: 'All customers' },
      { to: '/vendors', label: 'All vendors' },
      { to: '/inventory', label: 'Inventory' },
      { to: '/reports', label: 'All reports' },
    ],
  },
];

export function Layout() {
  const { state, resetSampleData } = useBooks();
  const [menuOpen, setMenuOpen] = useState(false);
  const [gearOpen, setGearOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [resetFlash, setResetFlash] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const gearRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  function confirmReset() {
    resetSampleData();
    setResetOpen(false);
    setResetFlash(true);
    navigate('/');
    window.setTimeout(() => setResetFlash(false), 3500);
  }

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t)) setMenuOpen(false);
      if (!gearRef.current?.contains(t)) setGearOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim().toLowerCase();
    if (!q) return;
    const customer = state.customers.find(
      (c) => c.name.toLowerCase().includes(q) || c.company?.toLowerCase().includes(q),
    );
    if (customer) {
      navigate(`/customers/${customer.id}`);
      setQuery('');
      return;
    }
    const vendor = state.vendors.find((v) => v.name.toLowerCase().includes(q));
    if (vendor) {
      navigate(`/vendors/${vendor.id}`);
      setQuery('');
      return;
    }
    const bill = (state.bills ?? []).find(
      (b) => b.number.includes(q.replace(/^#/, '')) || `bill-${b.number}`.includes(q),
    );
    if (bill) {
      navigate(`/bills?open=${bill.id}`);
      setQuery('');
      return;
    }
    const po = state.purchaseOrders.find(
      (p) =>
        p.number.includes(q.replace(/^#/, '')) ||
        p.id === q ||
        `po-${p.number}`.includes(q) ||
        `po #${p.number}`.includes(q),
    );
    if (po) {
      navigate(`/purchase-orders?open=${po.id}`);
      setQuery('');
      return;
    }
    if (q.includes('po') || q.includes('purchase')) {
      navigate('/purchase-orders');
      setQuery('');
      return;
    }
    const inv = state.invoices.find(
      (i) => i.number.includes(q) || `inv-${i.number}`.includes(q),
    );
    if (inv) {
      navigate(`/invoices?open=${inv.id}`);
      setQuery('');
      return;
    }
    navigate('/sales');
  };

  return (
    <div className="app-shell qbo-shell">
      <aside className={`sidebar ${navOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-mark">L</div>
          <div className="brand-text">
            <div className="brand-name">Ledgerly</div>
            <div className="brand-sub">Online</div>
          </div>
        </div>

        <div className="rel sidebar-new" ref={menuRef}>
          <button
            type="button"
            className="btn btn-new"
            onClick={() => {
              setMenuOpen((v) => !v);
              setGearOpen(false);
            }}
            aria-expanded={menuOpen}
          >
            <Plus size={18} strokeWidth={2.5} /> New
          </button>
          {menuOpen ? (
            <div className="menu-pop menu-pop-qbo menu-pop-3 menu-pop-new">
              {newMenu.map((col) => (
                <div className="menu-col" key={col.label}>
                  <div className="menu-col-label">{col.label}</div>
                  {col.items.map((item) => (
                    <button
                      type="button"
                      key={item.to + item.label}
                      onClick={() => {
                        setMenuOpen(false);
                        navigate(item.to);
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <nav className="sidebar-nav" aria-label="Primary">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              onClick={() => setNavOpen(false)}
            >
              <item.icon />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <header className="topbar">
        <button
          type="button"
          className="btn btn-ghost btn-sm mobile-nav-toggle"
          onClick={() => setNavOpen((v) => !v)}
          aria-label="Menu"
        >
          {navOpen ? <X size={18} /> : <Menu size={18} />}
        </button>

        <button
          type="button"
          className="company-switcher"
          onClick={() => navigate('/settings')}
          title="Company"
        >
          <Building2 size={16} />
          <span>{state.company.name}</span>
        </button>

        <form className="search" onSubmit={onSearch}>
          <Search size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search transactions, customers, vendors…"
            aria-label="Search"
          />
        </form>

        <div className="top-actions">
          <button type="button" className="icon-btn" aria-label="Help" title="Help">
            <HelpCircle size={18} />
          </button>
          <div className="rel" ref={gearRef}>
            <button
              type="button"
              className="icon-btn"
              aria-label="Settings"
              aria-expanded={gearOpen}
              onClick={() => {
                setGearOpen((v) => !v);
                setMenuOpen(false);
              }}
            >
              <Settings size={18} />
            </button>
            {gearOpen ? (
              <div className="menu-pop menu-pop-gear">
                {gearMenu.map((col) => (
                  <div className="menu-col" key={col.label}>
                    <div className="menu-col-label">{col.label}</div>
                    {col.items.map((item) => (
                      <button
                        type="button"
                        key={item.to + item.label}
                        onClick={() => {
                          setGearOpen(false);
                          navigate(item.to);
                        }}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                ))}
                <div className="menu-col">
                  <div className="menu-col-label">TOOLS</div>
                  <button
                    type="button"
                    onClick={() => {
                      setGearOpen(false);
                      setResetOpen(true);
                    }}
                  >
                    Reset starter data
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <main className="main">
        <div className="sample-banner">
          <span>
            Sample company <strong>{state.company.name}</strong>
            {resetFlash ? (
              <>
                {' '}
                · <strong className="ok-flash">Starter data restored</strong>
              </>
            ) : (
              <> — Not affiliated with Intuit QuickBooks. Gear → Account and settings for backup.</>
            )}
          </span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setResetOpen(true)}>
            Reset starter data
          </button>
        </div>
        <Outlet />
      </main>

      {resetOpen ? (
        <Modal
          title="Reset starter data?"
          onClose={() => setResetOpen(false)}
          footer={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setResetOpen(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={confirmReset}>
                Reset to sample books
              </button>
            </>
          }
        >
          <p style={{ marginTop: 0, lineHeight: 1.6 }}>
            This replaces invoices, inventory, POs, and other books with the ABC LLC starter set.
            It updates this browser and cloud sync when available. Download a backup in Settings
            first if you want to keep current data.
          </p>
        </Modal>
      ) : null}
    </div>
  );
}
