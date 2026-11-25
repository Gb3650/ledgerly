import { useMemo, useState } from 'react';
import {
  arAging,
  balanceSheet,
  inventoryValuation,
  profitAndLoss,
  salesByProduct,
  spendByVendor,
} from '../lib/accounting';
import { money, shortDate } from '../lib/format';
import { useBooks } from '../store/BooksContext';

export function Reports() {
  const { state } = useBooks();
  const [report, setReport] = useState<
    'pl' | 'bs' | 'ar' | 'product' | 'vendor' | 'inventory' | 'movement'
  >('pl');
  const [from, setFrom] = useState('2026-01-01');
  const [to, setTo] = useState('2026-12-31');

  const pl = useMemo(() => profitAndLoss(state, from, to), [state, from, to]);
  const bs = useMemo(() => balanceSheet(state), [state]);
  const ar = useMemo(() => arAging(state.invoices, state.customers), [state]);
  const byProduct = useMemo(() => salesByProduct(state, from, to), [state, from, to]);
  const byVendor = useMemo(() => spendByVendor(state, from, to), [state, from, to]);
  const valuation = useMemo(() => inventoryValuation(state), [state]);
  const movements = useMemo(
    () =>
      [...(state.stockMovements ?? [])]
        .filter((m) => m.date >= from && m.date <= to)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [state.stockMovements, from, to],
  );

  const dateFilter = (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
      <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
      <span style={{ color: 'var(--muted)' }}>to</span>
      <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Reports</h1>
          <p>
            Accrual P&amp;L with COGS, balance sheet, A/R, inventory valuation, and stock movement.
          </p>
        </div>
      </div>

      <div className="tabs" style={{ flexWrap: 'wrap' }}>
        {(
          [
            ['pl', 'Profit & Loss'],
            ['bs', 'Balance Sheet'],
            ['ar', 'A/R Aging'],
            ['product', 'By product'],
            ['vendor', 'By vendor'],
            ['inventory', 'Inventory value'],
            ['movement', 'Stock movement'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            className={`tab ${report === key ? 'active' : ''}`}
            onClick={() => setReport(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {report === 'pl' ? (
        <div className="panel">
          <div className="panel-head" style={{ paddingBottom: 12, flexWrap: 'wrap' }}>
            <h2>Profit &amp; Loss</h2>
            {dateFilter}
          </div>
          <div className="panel-pad">
            <div className="account-row">
              <strong>Income</strong>
              <strong>{money(pl.income)}</strong>
            </div>
            {pl.byIncome.map((c) => (
              <div className="account-row" key={c.name} style={{ paddingLeft: 12 }}>
                <span style={{ color: 'var(--ink-soft)' }}>{c.name}</span>
                <span>{money(c.amount)}</span>
              </div>
            ))}
            <div className="account-row" style={{ paddingLeft: 12, color: 'var(--muted)' }}>
              <span>Invoices {money(pl.invoiceIncome)} · Cash sales {money(pl.receiptIncome)}</span>
              <span />
            </div>

            <div className="account-row" style={{ marginTop: 10 }}>
              <strong>Cost of goods sold</strong>
              <strong>{money(pl.cogs)}</strong>
            </div>
            <div className="account-row" style={{ marginTop: 4 }}>
              <strong>Gross profit</strong>
              <strong style={{ color: 'var(--sea)' }}>{money(pl.grossProfit)}</strong>
            </div>

            <div className="account-row" style={{ marginTop: 12 }}>
              <strong>Operating expenses</strong>
              <strong>{money(pl.expenses)}</strong>
            </div>
            {pl.byCategory.map((c) => (
              <div className="account-row" key={c.name} style={{ paddingLeft: 12 }}>
                <span style={{ color: 'var(--ink-soft)' }}>{c.name}</span>
                <span>{money(c.amount)}</span>
              </div>
            ))}

            <div
              className="account-row"
              style={{
                marginTop: 12,
                paddingTop: 16,
                borderTop: '2px solid var(--ink)',
                fontFamily: 'var(--display)',
                fontSize: '1.25rem',
              }}
            >
              <strong>Net income</strong>
              <strong style={{ color: pl.net >= 0 ? 'var(--sea)' : 'var(--coral)' }}>
                {money(pl.net)}
              </strong>
            </div>
            <div style={{ marginTop: 10, color: 'var(--muted)', fontSize: '0.85rem' }}>
              Cash collected in period (payments + receipts): {money(pl.cashCollected)}. Sales tax
              on sales: {money(pl.taxCollected)} (liability, not income).
            </div>
          </div>
        </div>
      ) : null}

      {report === 'bs' ? (
        <div className="grid grid-2">
          <div className="panel">
            <div className="panel-head">
              <h2>Assets</h2>
            </div>
            <div className="panel-pad">
              {bs.assets.map((a) => (
                <div className="account-row" key={a.id}>
                  <span>
                    {a.number} · {a.name}
                  </span>
                  <span>{money(a.balance)}</span>
                </div>
              ))}
              <div className="account-row" style={{ marginTop: 10, fontWeight: 700 }}>
                <span>Total assets</span>
                <span>{money(bs.totalAssets)}</span>
              </div>
            </div>
          </div>
          <div className="panel">
            <div className="panel-head">
              <h2>Liabilities &amp; equity</h2>
            </div>
            <div className="panel-pad">
              {bs.liabilities.map((a) => (
                <div className="account-row" key={a.id}>
                  <span>
                    {a.number} · {a.name}
                  </span>
                  <span>{money(a.balance)}</span>
                </div>
              ))}
              {bs.equity.map((a) => (
                <div className="account-row" key={a.id}>
                  <span>
                    {a.number} · {a.name}
                  </span>
                  <span>{money(a.balance)}</span>
                </div>
              ))}
              <div className="account-row">
                <span>Net income (YTD)</span>
                <span>{money(bs.netIncome)}</span>
              </div>
              <div className="account-row" style={{ marginTop: 10, fontWeight: 700 }}>
                <span>Total L + E</span>
                <span>{money(bs.totalLiabilities + bs.totalEquity)}</span>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {report === 'ar' ? (
        <div className="panel">
          <div className="panel-head">
            <h2>A/R Aging</h2>
          </div>
          <div className="panel-pad">
            <div className="grid grid-4" style={{ marginBottom: 16 }}>
              {(
                [
                  ['Current', ar.buckets.current],
                  ['1–30', ar.buckets.d30],
                  ['31–60', ar.buckets.d60],
                  ['61+', ar.buckets.d90],
                ] as const
              ).map(([label, amt]) => (
                <div key={label} className="panel stat">
                  <div className="stat-label">{label}</div>
                  <div className="stat-value" style={{ fontSize: '1.2rem' }}>
                    {money(amt)}
                  </div>
                </div>
              ))}
            </div>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Invoice</th>
                    <th>Due</th>
                    <th>Days</th>
                    <th className="num">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {ar.rows.map((r) => (
                    <tr key={r.invoice.id}>
                      <td>{r.customerName}</td>
                      <td>#{r.invoice.number}</td>
                      <td>{shortDate(r.invoice.dueDate)}</td>
                      <td>{r.days}</td>
                      <td className="num">{money(r.invoice.balance)}</td>
                    </tr>
                  ))}
                  {ar.rows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="empty">
                        No open receivables.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {report === 'product' ? (
        <div className="panel">
          <div className="panel-head" style={{ flexWrap: 'wrap' }}>
            <h2>Sales by product</h2>
            {dateFilter}
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="num">Qty</th>
                  <th className="num">Sales</th>
                  <th className="num">COGS</th>
                  <th className="num">Margin</th>
                </tr>
              </thead>
              <tbody>
                {byProduct.map((r) => (
                  <tr key={r.name}>
                    <td>{r.name}</td>
                    <td className="num">{r.qty}</td>
                    <td className="num">{money(r.amount)}</td>
                    <td className="num">{money(r.cogs)}</td>
                    <td className="num">{money(r.margin)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {report === 'vendor' ? (
        <div className="panel">
          <div className="panel-head" style={{ flexWrap: 'wrap' }}>
            <h2>Spend by vendor</h2>
            {dateFilter}
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th className="num">Expenses</th>
                  <th className="num">POs</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {byVendor.map((r) => (
                  <tr key={r.name}>
                    <td>{r.name}</td>
                    <td className="num">{money(r.expenses)}</td>
                    <td className="num">{money(r.pos)}</td>
                    <td className="num">{money(r.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {report === 'inventory' ? (
        <div className="panel">
          <div className="panel-head">
            <h2>Inventory valuation</h2>
            <div style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
              Asset {money(valuation.totalValue)} · retail {money(valuation.totalSaleValue)}
            </div>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="num">Qty</th>
                  <th className="num">Unit cost</th>
                  <th className="num">Asset value</th>
                  <th className="num">Retail value</th>
                </tr>
              </thead>
              <tbody>
                {valuation.rows.map((r) => (
                  <tr key={r.product.id}>
                    <td>{r.product.name}</td>
                    <td className="num">{r.qty}</td>
                    <td className="num">{money(r.cost)}</td>
                    <td className="num">{money(r.value)}</td>
                    <td className="num">{money(r.saleValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {report === 'movement' ? (
        <div className="panel">
          <div className="panel-head" style={{ flexWrap: 'wrap' }}>
            <h2>Stock movement</h2>
            {dateFilter}
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Product</th>
                  <th>Location</th>
                  <th>Reason</th>
                  <th className="num">Qty Δ</th>
                  <th>Memo</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => {
                  const product = state.products.find((p) => p.id === m.productId);
                  const loc = state.locations.find((l) => l.id === m.locationId);
                  return (
                    <tr key={m.id}>
                      <td>{shortDate(m.date)}</td>
                      <td>{product?.name}</td>
                      <td>{loc?.code}</td>
                      <td style={{ textTransform: 'capitalize' }}>
                        {m.reason.replace(/_/g, ' ')}
                      </td>
                      <td
                        className="num"
                        style={{ color: m.qtyDelta < 0 ? 'var(--coral)' : 'var(--sea)' }}
                      >
                        {m.qtyDelta > 0 ? `+${m.qtyDelta}` : m.qtyDelta}
                      </td>
                      <td>{m.memo || '—'}</td>
                    </tr>
                  );
                })}
                {movements.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="empty">
                      No movements in this range.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
