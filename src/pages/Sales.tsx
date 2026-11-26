import { Link } from 'react-router-dom';
import { unpaidInvoices } from '../lib/accounting';
import { money, shortDate } from '../lib/format';
import { HubTabs, salesHubTabs } from '../components/HubTabs';
import { StatusBadge } from '../components/StatusBadge';
import { useBooks } from '../store/BooksContext';

/** QBO Sales → Overview: money bar + recent activity */
export function Sales() {
  const { state } = useBooks();
  const open = unpaidInvoices(state.invoices);
  const overdue = open.filter((i) => i.status === 'overdue' || i.dueDate < new Date().toISOString().slice(0, 10));
  const openNotOverdue = open.filter((i) => !overdue.some((o) => o.id === i.id));
  const estimates = (state.quotes ?? []).filter(
    (q) => q.status === 'draft' || q.status === 'sent' || q.status === 'accepted',
  );
  const recentlyPaid = [...state.invoices]
    .filter((i) => i.status === 'paid')
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8);
  const recentPayments = [...state.payments].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);

  const openAmt = openNotOverdue.reduce((s, i) => s + i.balance, 0);
  const overdueAmt = overdue.reduce((s, i) => s + i.balance, 0);
  const estimateAmt = estimates.reduce((s, q) => s + q.total, 0);
  const paidAmt = recentlyPaid.reduce((s, i) => s + i.total, 0);
  const unbilled = 0; // placeholder until delayed charges exist

  const moneyBar = [
    {
      key: 'estimates',
      label: 'Estimates',
      amount: estimateAmt,
      count: estimates.length,
      href: '/quotes',
      tone: '',
    },
    {
      key: 'unbilled',
      label: 'Unbilled activity',
      amount: unbilled,
      count: 0,
      href: '/sales/all',
      tone: '',
    },
    {
      key: 'overdue',
      label: 'Overdue',
      amount: overdueAmt,
      count: overdue.length,
      href: '/invoices',
      tone: 'danger',
    },
    {
      key: 'open',
      label: 'Open invoices',
      amount: openAmt,
      count: openNotOverdue.length,
      href: '/invoices',
      tone: 'warn',
    },
    {
      key: 'paid',
      label: 'Recently paid',
      amount: paidAmt,
      count: recentlyPaid.length,
      href: '/sales/all?type=Invoice&status=paid',
      tone: 'ok',
    },
  ];

  const recent = [
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
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8);

  return (
    <div>
      <HubTabs tabs={salesHubTabs} />
      <div className="page-header">
        <div>
          <h1>Sales</h1>
          <p>Overview of invoices, estimates, and cash sales.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link className="btn btn-ghost" to="/receive-payment">
            Receive payment
          </Link>
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

      <div className="money-bar" role="navigation" aria-label="Sales status">
        {moneyBar.map((cell) => (
          <Link key={cell.key} to={cell.href} className={`money-cell ${cell.tone}`}>
            <div className="money-cell-label">{cell.label}</div>
            <div className="money-cell-amount">{money(cell.amount)}</div>
            <div className="money-cell-count">
              {cell.count} {cell.count === 1 ? 'transaction' : 'transactions'}
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-2" style={{ marginBottom: 16 }}>
        <div className="panel">
          <div className="panel-head">
            <h2>Open invoices</h2>
            <Link className="btn btn-ghost btn-sm" to="/invoices">
              View all
            </Link>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Due</th>
                  <th>Status</th>
                  <th className="num">Balance</th>
                </tr>
              </thead>
              <tbody>
                {open.slice(0, 6).map((inv) => {
                  const customer = state.customers.find((c) => c.id === inv.customerId);
                  return (
                    <tr key={inv.id}>
                      <td>
                        <Link to={`/invoices?open=${inv.id}`} className="linkish">
                          {customer?.name ?? '—'} · #{inv.number}
                        </Link>
                      </td>
                      <td>{shortDate(inv.dueDate)}</td>
                      <td>
                        <StatusBadge status={inv.status} />
                      </td>
                      <td className="num">{money(inv.balance)}</td>
                    </tr>
                  );
                })}
                {open.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="empty">
                      No open invoices.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2>Recent payments</h2>
            <Link className="btn btn-ghost btn-sm" to="/receive-payment">
              Receive payment
            </Link>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Invoice</th>
                  <th>Method</th>
                  <th className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {recentPayments.map((p) => {
                  const inv = state.invoices.find((i) => i.id === p.invoiceId);
                  return (
                    <tr key={p.id}>
                      <td>{shortDate(p.date)}</td>
                      <td>
                        {inv ? (
                          <Link to={`/invoices?open=${inv.id}`} className="linkish">
                            #{inv.number}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>{p.method}</td>
                      <td className="num">{money(p.amount)}</td>
                    </tr>
                  );
                })}
                {recentPayments.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="empty">
                      No payments yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Recent sales</h2>
          <Link className="btn btn-ghost btn-sm" to="/sales/all">
            All sales
          </Link>
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
              {recent.map((row) => (
                <tr key={`${row.type}-${row.id}`}>
                  <td>{shortDate(row.date)}</td>
                  <td>{row.type}</td>
                  <td>
                    <Link to={row.href} className="linkish">
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
              {recent.length === 0 ? (
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
