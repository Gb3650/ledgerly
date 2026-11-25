import { Link } from 'react-router-dom';
import { unpaidInvoices } from '../lib/accounting';
import { money, shortDate } from '../lib/format';
import { StatusBadge } from '../components/StatusBadge';
import { useBooks } from '../store/BooksContext';

type Row = {
  id: string;
  date: string;
  type: 'Invoice' | 'Sales receipt' | 'Estimate';
  number: string;
  customer: string;
  status: string;
  total: number;
  balance: number;
  href: string;
};

export function Sales() {
  const { state } = useBooks();
  const open = unpaidInvoices(state.invoices);
  const paid = state.invoices.filter((i) => i.status === 'paid');
  const draft = state.invoices.filter((i) => i.status === 'draft');
  const receiptsTotal = (state.salesReceipts ?? []).reduce((s, r) => s + r.total, 0);

  const sales: Row[] = [
    ...state.invoices.map((inv) => ({
      id: inv.id,
      date: inv.date,
      type: 'Invoice' as const,
      number: inv.number,
      customer: state.customers.find((c) => c.id === inv.customerId)?.name ?? '—',
      status: inv.status,
      total: inv.total,
      balance: inv.balance,
      href: `/invoices?open=${inv.id}`,
    })),
    ...(state.salesReceipts ?? []).map((r) => ({
      id: r.id,
      date: r.date,
      type: 'Sales receipt' as const,
      number: r.number,
      customer: r.customerName,
      status: 'paid',
      total: r.total,
      balance: 0,
      href: `/sales-receipts`,
    })),
    ...(state.quotes ?? []).map((q) => ({
      id: q.id,
      date: q.date,
      type: 'Estimate' as const,
      number: q.number,
      customer: state.customers.find((c) => c.id === q.customerId)?.name ?? '—',
      status: q.status,
      total: q.total,
      balance: 0,
      href: `/quotes`,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Sales</h1>
          <p>Invoices, estimates, and cash sales in one place.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link className="btn btn-ghost" to="/quotes?new=1">
            Estimate
          </Link>
          <Link className="btn btn-ghost" to="/sales-receipts?new=1">
            Sales receipt
          </Link>
          <Link className="btn btn-primary" to="/invoices?new=1">
            New invoice
          </Link>
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <div className="panel stat">
          <div className="stat-label">Open invoices</div>
          <div className="stat-value">{money(open.reduce((s, i) => s + i.balance, 0))}</div>
          <div className="stat-hint">{open.length} invoices</div>
        </div>
        <div className="panel stat positive">
          <div className="stat-label">Paid invoices</div>
          <div className="stat-value">{money(paid.reduce((s, i) => s + i.total, 0))}</div>
          <div className="stat-hint">{paid.length} invoices</div>
        </div>
        <div className="panel stat">
          <div className="stat-label">Cash sales</div>
          <div className="stat-value">{money(receiptsTotal)}</div>
          <div className="stat-hint">{state.salesReceipts?.length ?? 0} receipts</div>
        </div>
        <div className="panel stat warning">
          <div className="stat-label">Drafts</div>
          <div className="stat-value">{draft.length}</div>
          <div className="stat-hint">Ready to send</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>All sales</h2>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>No.</th>
                <th>Customer</th>
                <th>Status</th>
                <th className="num">Total</th>
                <th className="num">Balance</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((row) => (
                <tr key={`${row.type}-${row.id}`}>
                  <td>{shortDate(row.date)}</td>
                  <td>{row.type}</td>
                  <td>
                    <Link to={row.href} style={{ color: 'var(--sea)', fontWeight: 700 }}>
                      #{row.number}
                    </Link>
                  </td>
                  <td>{row.customer}</td>
                  <td>
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="num">{money(row.total)}</td>
                  <td className="num">{money(row.balance)}</td>
                </tr>
              ))}
              {sales.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty">
                    No sales yet.
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
