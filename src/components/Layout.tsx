import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  BookOpen,
  Building2,
  ClipboardList,
  CreditCard,
  FileText,
  LayoutDashboard,
  MapPin,
  Menu,
  Package,
  Plus,
  Receipt,
  Search,
  Settings,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { useBooks } from '../store/BooksContext';

const nav = [
  {
    label: 'Overview',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
      { to: '/banking', icon: Wallet, label: 'Cash activity' },
    ],
  },
  {
    label: 'Sales',
    items: [
      { to: '/sales', icon: FileText, label: 'All sales' },
      { to: '/invoices', icon: Receipt, label: 'Invoices' },
      { to: '/customers', icon: Users, label: 'Customers' },
      { to: '/products', icon: Package, label: 'Products & services' },
    ],
  },
  {
    label: 'Purchasing & stock',
    items: [
      { to: '/purchase-orders', icon: ClipboardList, label: 'Purchase orders' },
      { to: '/inventory', icon: MapPin, label: 'Inventory by location' },
      { to: '/expenses', icon: CreditCard, label: 'Expenses' },
      { to: '/vendors', icon: Building2, label: 'Vendors' },
    ],
  },
  {
    label: 'Books',
    items: [
      { to: '/reports', icon: BarChart3, label: 'Reports' },
      { to: '/accounts', icon: BookOpen, label: 'Chart of accounts' },
      { to: '/settings', icon: Settings, label: 'Settings' },
    ],
  },
];

export function Layout() {
  const { state, resetSampleData } = useBooks();
  const [menuOpen, setMenuOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [query, setQuery] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
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
    const inv = state.invoices.find(
      (i) => i.number.includes(q) || `inv-${i.number}`.includes(q),
    );
    if (inv) {
      navigate('/invoices');
      setQuery('');
      return;
    }
    navigate('/sales');
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <button
          className="btn btn-ghost btn-sm mobile-nav-toggle"
          onClick={() => setNavOpen((v) => !v)}
          aria-label="Menu"
        >
          {navOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
        <div className="brand">
          <div className="brand-mark">L</div>
          <div className="brand-text">
            <div className="brand-name">Ledgerly</div>
            <div className="brand-sub">Online books</div>
          </div>
        </div>
        <div className="company-pill">
          <Building2 size={14} />
          {state.company.name}
        </div>
        <form className="search" onSubmit={onSearch}>
          <Search size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search customers, vendors, invoices…"
            aria-label="Search"
          />
        </form>
        <div className="top-actions">
          <div className="rel" ref={menuRef}>
            <button className="btn btn-primary" onClick={() => setMenuOpen((v) => !v)}>
              <Plus size={16} /> New
            </button>
            {menuOpen ? (
              <div className="menu-pop">
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    navigate('/invoices?new=1');
                  }}
                >
                  Invoice
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    navigate('/purchase-orders');
                  }}
                >
                  Purchase order
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    navigate('/expenses?new=1');
                  }}
                >
                  Expense
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    navigate('/customers?new=1');
                  }}
                >
                  Customer
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    navigate('/vendors?new=1');
                  }}
                >
                  Vendor
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <aside className={`sidebar ${navOpen ? 'open' : ''}`}>
        {nav.map((section) => (
          <div className="nav-section" key={section.label}>
            <div className="nav-label">{section.label}</div>
            {section.items.map((item) => (
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
          </div>
        ))}
      </aside>

      <main className="main">
        <div className="sample-banner">
          <span>
            Testing as <strong>{state.company.name}</strong> — data saves in this browser. Use
            Settings → Download backup. Private app; not affiliated with Intuit QuickBooks.
          </span>
          <button className="btn btn-ghost btn-sm" onClick={resetSampleData}>
            Reset starter data
          </button>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
