import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { money, shortDate } from '../lib/format';
import { HubTabs, salesHubTabs } from '../components/HubTabs';
import { StatusBadge } from '../components/StatusBadge';
import { useBooks } from '../store/BooksContext';

type RowType = 'Invoice' | 'Payment' | 'Estimate' | 'Sales receipt';

type Row = {
  id: string;
  date: string;
  type: RowType;
  number: string;
  customer: string;
  memo: string;
  status: string;
  dueDate?: string;
  total: number;
  balance: number;
  href: string;
};

const TYPE_FILTERS: Array<'All' | RowType> = [
  'All',
  'Invoice',
  'Payment',
  'Estimate',
  'Sales receipt',
];

/** QBO Sales → All sales list with type / status filters */
export function SalesAll() {
  const { state } = useBooks();
  const [params] = useSearchParams();
  const [typeFilter, setTypeFilter] = useState<(typeof TYPE_FILTERS)[number]>(
    (params.get('type') as RowType) || 'All',
  );
  const [statusFilter, setStatusFilter] = useState(params.get('status') || 'all');
  const [query, setQuery] = useState('');

  const rows: Row[] = useMemo(() => {
    const invoices: Row[] = state.invoices.map((inv) => ({
      id: inv.id,
      date: inv.date,
      type: 'Invoice',
      number: inv.number,
      customer: state.customers.find((c) => c.id === inv.customerId)?.name ?? '—',
      memo: inv.message?.slice(0, 48) || '',
      status: inv.status,
      dueDate: inv.dueDate,
      total: inv.total,
      balance: inv.balance,
      href: `/invoices?open=${inv.id}`,
    }));

    const payments: Row[] = state.payments.map((p) => {
      const inv = state.invoices.find((i) => i.id === p.invoiceId);
      const customer =
        state.customers.find((c) => c.id === inv?.customerId)?.name ??
        (inv ? '—' : '—');
      return {
        id: p.id,
        date: p.date,
        type: 'Payment' as const,
        number: inv?.number ? `PMT-${inv.number}` : p.id.slice(-6),
        customer,
        memo: p.memo || p.method,
        status: 'paid',
        total: p.amount,
        balance: 0,
        href: inv ? `/invoices?open=${inv.id}` : '/receive-payment',
      };
    });

    const estimates: Row[] = (state.quotes ?? []).map((q) => ({
      id: q.id,
      date: q.date,
      type: 'Estimate',
      number: q.number,
      customer: state.customers.find((c) => c.id === q.customerId)?.name ?? '—',
      memo: q.message?.slice(0, 48) || '',
      status: q.status,
      dueDate: q.expiryDate,
      total: q.total,
      balance: 0,
      href: `/quotes`,
    }));

    const receipts: Row[] = (state.salesReceipts ?? []).map((r) => ({
      id: r.id,
      date: r.date,
      type: 'Sales receipt',
      number: r.number,
      customer: r.customerName,
      memo: r.memo || r.paymentMethod,
      status: 'paid',
      total: r.total,
      balance: 0,
      href: `/sales-receipts`,
    }));

    return [...invoices, ...payments, ...estimates, ...receipts].sort((a, b) =>
      b.date.localeCompare(a.date),
    );
  }, [state]);

  const filtered = useMemo(() => {
    let list = rows;
    if (typeFilter !== 'All') list = list.filter((r) => r.type === typeFilter);
    if (statusFilter !== 'all') list = list.filter((r) => r.status === statusFilter);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          r.number.toLowerCase().includes(q) ||
          r.customer.toLowerCase().includes(q) ||
          r.memo.toLowerCase().includes(q) ||
          r.type.toLowerCase().includes(q),
      );
    }
    return list;
  }, [rows, typeFilter, statusFilter, query]);

  const statuses = useMemo(() => {
    const set = new Set(rows.map((r) => r.status));
    return ['all', ...Array.from(set).sort()];
  }, [rows]);

  return (
    <div>
      <HubTabs tabs={salesHubTabs} />
      <div className="page-header">
        <div>
          <h1>All sales</h1>
          <p>Invoices, payments, estimates, and sales receipts in one list.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link className="btn btn-ghost" to="/receive-payment">
            Receive payment
          </Link>
          <Link className="btn btn-ghost" to="/sales-receipts?new=1">
            Sales receipt
          </Link>
          <Link className="btn btn-primary" to="/invoices?new=1">
            New invoice
          </Link>
        </div>
      </div>

      <div className="list-toolbar">
        <div className="tabs" style={{ marginBottom: 0 }}>
          {TYPE_FILTERS.map((t) => (
            <button
              key={t}
              type="button"
              className={`tab ${typeFilter === t ? 'active' : ''}`}
              onClick={() => setTypeFilter(t)}
            >
              {t === 'All' ? 'All types' : t}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            className="list-search"
            style={{ minWidth: 140, borderRadius: 10 }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
          >
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s === 'all' ? 'All statuses' : s}
              </option>
            ))}
          </select>
          <input
            className="list-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search customer, #, memo"
            aria-label="Filter sales"
          />
        </div>
      </div>

      <div className="panel">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>No.</th>
                <th>Customer</th>
                <th>Memo</th>
                <th>Due date</th>
                <th>Status</th>
                <th className="num">Total</th>
                <th className="num">Balance</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={`${row.type}-${row.id}`}>
                  <td>{shortDate(row.date)}</td>
                  <td>{row.type}</td>
                  <td>
                    <Link to={row.href} className="linkish">
                      #{row.number}
                    </Link>
                  </td>
                  <td>{row.customer}</td>
                  <td style={{ color: 'var(--muted)', maxWidth: 180 }} className="truncate">
                    {row.memo || '—'}
                  </td>
                  <td>{row.dueDate ? shortDate(row.dueDate) : '—'}</td>
                  <td>
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="num">{money(row.total)}</td>
                  <td className="num">{money(row.balance)}</td>
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="empty">
                    <div className="empty-cta">
                      <div>No sales match this filter.</div>
                      <Link className="btn btn-primary" to="/invoices?new=1">
                        Create invoice
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
