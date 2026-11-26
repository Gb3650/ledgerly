import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import {
  monthlyIncomeSeries,
  profitAndLoss,
  unpaidBills,
  unpaidInvoices,
} from '../lib/accounting';
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
  const openPayables = unpaidBills(state.bills ?? []);
  const apBalance = openPayables.reduce((s, b) => s + b.balance, 0);
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
  const expenseSeries = chartMonths.map((m) =>
    Math.max(0, m.income - m.net),
  );
  const maxBar = Math.max(1, ...incomeSeries, ...expenseSeries);

  const catTotal = pl.byCategory.reduce((s, c) => s + c.amount, 0) || 1;
  const topCats = pl.byCategory.slice(0, 4);
  const stops = topCats.reduce<number[]>((acc, c) => {
    const prev = acc.length ? acc[acc.length - 1] : 0;
    acc.push(prev + (c.amount / catTotal) * 100);
    return acc;
  }, []);
  const colors = ['var(--sea)', 'var(--amber)', 'var(--sky)', 'var(--mist)'];

  return (
    <div className="bo">
      <div className="page-header">
        <div>
          <h1>Business overview</h1>
          <p>
            {state.company.name} · This year
            {lowStock.length ? ` · ${lowStock.length} items at reorder point` : ''}
          </p>
        </div>
      </div>

      <div className="bo-grid">
        {/* Profit and Loss — QBO primary widget */}
        <section className="panel bo-widget bo-span-2">
          <div className="panel-head">
            <h2>Profit and Loss</h2>
            <Link className="bo-link" to="/reports?r=pl">
              View report
            </Link>
          </div>
          <div className="panel-pad bo-pl">
            <div className="bo-pl-summary">
              <div>
                <div className="stat-label">Net income</div>
                <div
                  className="stat-value"
                  style={{ color: pl.net >= 0 ? 'var(--sea)' : 'var(--coral)' }}
                >
                  {money(pl.net)}
                </div>
              </div>
              <div className="bo-pl-breakdown">
                <div>
                  <span>Income</span>
                  <strong>{money(pl.income)}</strong>
                </div>
                <div>
                  <span>COGS</span>
                  <strong>{money(pl.cogs)}</strong>
                </div>
                <div>
                  <span>Expenses</span>
                  <strong>{money(pl.expenses)}</strong>
                </div>
              </div>
            </div>
            <div className="chart-bars bo-bars">
              {months.map((m, i) => (
                <div className="chart-bar" key={m}>
                  <div className="chart-bar-track bo-bar-pair">
                    <div
                      className="fill bo-fill-income"
                      style={{ height: `${Math.max(4, (incomeSeries[i] / maxBar) * 100)}%` }}
                      title={`Income ${money(incomeSeries[i])}`}
                    />
                    <div
                      className="fill bo-fill-expense"
                      style={{ height: `${Math.max(4, (expenseSeries[i] / maxBar) * 100)}%` }}
                      title={`Expenses ${money(expenseSeries[i])}`}
                    />
                  </div>
                  <div className="lbl">{m}</div>
                </div>
              ))}
            </div>
            <div className="bo-legend-inline">
              <span>
                <i className="bo-dot income" /> Income
              </span>
              <span>
                <i className="bo-dot expense" /> Expenses
              </span>
            </div>
          </div>
        </section>

        {/* Expenses donut */}
        <section className="panel bo-widget">
          <div className="panel-head">
            <h2>Expenses</h2>
            <Link className="bo-link" to="/reports?r=pl">
              View report
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
              <div className="bo-expense-total">{money(pl.expenses)}</div>
              {topCats.length === 0 ? (
                <div className="empty">No expenses yet</div>
              ) : (
                topCats.map((c, i) => (
                  <div className="legend-item" key={c.name}>
                    <div className="legend-left">
                      <span className="swatch" style={{ background: colors[i] }} />
                      <span
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {c.name}
                      </span>
                    </div>
                    <strong>{money(c.amount)}</strong>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        {/* Bank accounts */}
        <section className="panel bo-widget">
          <div className="panel-head">
            <h2>Bank accounts</h2>
            <Link className="bo-link" to="/banking">
              Go to Banking
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
            {banks.length === 0 ? <div className="empty">No bank accounts</div> : null}
          </div>
        </section>

        {/* Invoices (A/R) */}
        <section className="panel bo-widget">
          <div className="panel-head">
            <h2>Invoices</h2>
            <Link className="bo-link" to="/reports?r=ar">
              A/R aging
            </Link>
          </div>
          <div className="bo-widget-stat">
            <div>
              <div className="stat-label">Unpaid</div>
              <div className={`stat-value ${overdue.length ? 'warn' : ''}`}>{money(openBalance)}</div>
              <div className="stat-hint">
                {overdue.length
                  ? `${overdue.length} overdue · ${openInvoices.length} open`
                  : `${openInvoices.length} awaiting payment`}
              </div>
            </div>
            <Link className="btn btn-sm btn-ghost" to="/invoices?new=1">
              Create invoice
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
        </section>

        {/* Bills (A/P) */}
        <section className="panel bo-widget">
          <div className="panel-head">
            <h2>Bills</h2>
            <Link className="bo-link" to="/reports?r=ap">
              A/P aging
            </Link>
          </div>
          <div className="bo-widget-stat">
            <div>
              <div className="stat-label">Unpaid</div>
              <div className={`stat-value ${apBalance ? 'warn' : ''}`}>{money(apBalance)}</div>
              <div className="stat-hint">
                {openPayables.length
                  ? `${openPayables.length} to pay`
                  : 'No open bills'}
              </div>
            </div>
            <Link className="btn btn-sm btn-ghost" to="/pay-bills">
              Pay bills
            </Link>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Vendor</th>
                  <th>Due</th>
                  <th>Status</th>
                  <th className="num">Balance</th>
                </tr>
              </thead>
              <tbody>
                {openPayables.slice(0, 5).map((bill) => {
                  const vendor = state.vendors.find((v) => v.id === bill.vendorId);
                  return (
                    <tr key={bill.id}>
                      <td>#{bill.number}</td>
                      <td>{vendor?.name}</td>
                      <td>{shortDate(bill.dueDate)}</td>
                      <td>
                        <StatusBadge status={bill.status} />
                      </td>
                      <td className="num">{money(bill.balance)}</td>
                    </tr>
                  );
                })}
                {openPayables.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="empty">
                      No bills to pay.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div style={{ marginTop: 20 }}>
        <QuickOrder />
      </div>
    </div>
  );
}
