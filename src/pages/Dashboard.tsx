import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { monthlyIncomeSeries, profitAndLoss, unpaidInvoices } from '../lib/accounting';
import { inventoryMatrix } from '../lib/inventory';
import { money, shortDate } from '../lib/format';
import { QuickOrder } from '../components/QuickOrder';
import { StatusBadge } from '../components/StatusBadge';
import { useBooks } from '../store/BooksContext';

export function Dashboard() {
  const { state } = useBooks();
  const from = '2026-01-01';
  const to = '2026-12-31';
  const pl = profitAndLoss(state, from, to);
  const openInvoices = unpaidInvoices(state.invoices);
  const openBalance = openInvoices.reduce((s, i) => s + i.balance, 0);
  const overdue = state.invoices.filter((i) => i.status === 'overdue');
  const banks = state.accounts.filter((a) => a.type === 'bank' || a.type === 'credit_card');
  const lowStock = inventoryMatrix(state).filter(
    (r) => r.product.reorderPoint != null && r.total <= r.product.reorderPoint,
  );

  const yearSeries = monthlyIncomeSeries(state, 2026);
  const chartMonths = yearSeries.slice(5, 11);
  const months = chartMonths.map((m) =>
    new Date(2026, m.month - 1, 1).toLocaleString('en-US', { month: 'short' }),
  );
  const incomeSeries = chartMonths.map((m) => m.income);
  const maxIncome = Math.max(1, ...incomeSeries);

  const catTotal = pl.byCategory.reduce((s, c) => s + c.amount, 0) || 1;
  const topCats = pl.byCategory.slice(0, 4);
  const stops = topCats.reduce<number[]>((acc, c) => {
    const prev = acc.length ? acc[acc.length - 1] : 0;
    acc.push(prev + (c.amount / catTotal) * 100);
    return acc;
  }, []);
  const colors = ['var(--sea)', 'var(--amber)', 'var(--sky)', 'var(--mist)'];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Profit, cash, inventory, and open invoices for {state.company.name}</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link className="btn btn-ghost" to="/inventory">
            {lowStock.length ? `${lowStock.length} low stock` : 'Inventory'}
          </Link>
          <Link className="btn btn-primary" to="/invoices?new=1">
            Create invoice
          </Link>
        </div>
      </div>

      <QuickOrder />

      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <div className="panel stat positive">
          <div className="stat-label">Profit &amp; loss</div>
          <div className="stat-value">{money(pl.net)}</div>
          <div className="stat-hint">YTD net income</div>
        </div>
        <div className="panel stat">
          <div className="stat-label">Gross profit</div>
          <div className="stat-value">{money(pl.grossProfit)}</div>
          <div className="stat-hint">
            Sales {money(pl.income)} − COGS {money(pl.cogs)}
          </div>
        </div>
        <div className="panel stat">
          <div className="stat-label">Expenses</div>
          <div className="stat-value">{money(pl.expenses)}</div>
          <div className="stat-hint">Paid operating expenses YTD</div>
        </div>
        <div className={`panel stat ${overdue.length ? 'warning' : ''}`}>
          <div className="stat-label">Open invoices</div>
          <div className="stat-value">{money(openBalance)}</div>
          <div className="stat-hint">
            {overdue.length ? `${overdue.length} overdue` : `${openInvoices.length} awaiting payment`}
          </div>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 16 }}>
        <div className="panel">
          <div className="panel-head">
            <h2>Income</h2>
            <Link to="/reports" style={{ color: 'var(--sea)', fontWeight: 600, fontSize: '0.85rem' }}>
              View report
            </Link>
          </div>
          <div className="panel-pad">
            <div className="chart-bars">
              {months.map((m, i) => (
                <div className="chart-bar" key={m}>
                  <div className="chart-bar-track">
                    <div
                      className="fill"
                      style={{ height: `${Math.max(8, (incomeSeries[i] / maxIncome) * 100)}%` }}
                    />
                  </div>
                  <div className="lbl">{m}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2>Expenses</h2>
            <Link to="/expenses" style={{ color: 'var(--sea)', fontWeight: 600, fontSize: '0.85rem' }}>
              See all
            </Link>
          </div>
          <div className="donut-row">
            <div
              className="donut"
              style={
                {
                  '--p1': `${stops[0] || 25}%`,
                  '--p2': `${stops[1] || 50}%`,
                  '--p3': `${stops[2] || 75}%`,
                } as CSSProperties
              }
            />
            <div className="legend">
              {topCats.length === 0 ? (
                <div className="empty">No expenses yet</div>
              ) : (
                topCats.map((c, i) => (
                  <div className="legend-item" key={c.name}>
                    <div className="legend-left">
                      <span className="swatch" style={{ background: colors[i] }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.name}
                      </span>
                    </div>
                    <strong>{money(c.amount)}</strong>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="panel">
          <div className="panel-head">
            <h2>Bank accounts</h2>
            <Link to="/banking" style={{ color: 'var(--sea)', fontWeight: 600, fontSize: '0.85rem' }}>
              Banking
            </Link>
          </div>
          <div className="panel-pad">
            {banks.map((a) => (
              <div className="account-row" key={a.id}>
                <div>
                  <div style={{ fontWeight: 700 }}>{a.name}</div>
                  <div style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>{a.detailType}</div>
                </div>
                <div className="num" style={{ fontFamily: 'var(--display)', fontSize: '1.15rem' }}>
                  {money(a.balance)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2>Invoices awaiting payment</h2>
            <Link to="/invoices" style={{ color: 'var(--sea)', fontWeight: 600, fontSize: '0.85rem' }}>
              All invoices
            </Link>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Customer</th>
                  <th>Due</th>
                  <th>Status</th>
                  <th className="num">Balance</th>
                </tr>
              </thead>
              <tbody>
                {openInvoices.slice(0, 5).map((inv) => {
                  const customer = state.customers.find((c) => c.id === inv.customerId);
                  return (
                    <tr key={inv.id}>
                      <td>#{inv.number}</td>
                      <td>{customer?.name}</td>
                      <td>{shortDate(inv.dueDate)}</td>
                      <td>
                        <StatusBadge status={inv.status} />
                      </td>
                      <td className="num">{money(inv.balance)}</td>
                    </tr>
                  );
                })}
                {openInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="empty">
                      You&apos;re all caught up.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
