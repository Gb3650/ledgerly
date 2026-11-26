import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  apAging,
  arAging,
  balanceSheet,
  inventoryValuation,
  profitAndLoss,
  salesByProduct,
  spendByVendor,
  type AgingSummaryRow,
} from '../lib/accounting';
import { money, shortDate } from '../lib/format';
import { useBooks } from '../store/BooksContext';

type ReportId =
  | 'pl'
  | 'bs'
  | 'ar'
  | 'ap'
  | 'product'
  | 'vendor'
  | 'inventory'
  | 'movement';

type ReportMeta = {
  id: ReportId;
  title: string;
  blurb: string;
  needsDates?: boolean;
};

const REPORT_GROUPS: { label: string; reports: ReportMeta[] }[] = [
  {
    label: 'Business overview',
    reports: [
      {
        id: 'pl',
        title: 'Profit and Loss',
        blurb: 'Income, COGS, expenses, and net income for a date range.',
        needsDates: true,
      },
      {
        id: 'bs',
        title: 'Balance Sheet',
        blurb: 'Assets, liabilities, and equity as of today.',
      },
    ],
  },
  {
    label: 'Who owes you',
    reports: [
      {
        id: 'ar',
        title: 'Accounts receivable aging',
        blurb: 'Open invoices by current, 1–30, 31–60, and 61+ days.',
      },
    ],
  },
  {
    label: 'What you owe',
    reports: [
      {
        id: 'ap',
        title: 'Accounts payable aging',
        blurb: 'Open bills by current, 1–30, 31–60, and 61+ days.',
      },
    ],
  },
  {
    label: 'Sales and customers',
    reports: [
      {
        id: 'product',
        title: 'Sales by product/service',
        blurb: 'Quantity, sales, COGS, and margin by item.',
        needsDates: true,
      },
    ],
  },
  {
    label: 'Expenses and vendors',
    reports: [
      {
        id: 'vendor',
        title: 'Expenses by vendor',
        blurb: 'Cash expenses, bills, and purchase orders by vendor.',
        needsDates: true,
      },
    ],
  },
  {
    label: 'Inventory',
    reports: [
      {
        id: 'inventory',
        title: 'Inventory valuation summary',
        blurb: 'On-hand quantity valued at cost and retail.',
      },
      {
        id: 'movement',
        title: 'Inventory stock movement',
        blurb: 'Quantity changes by product, location, and reason.',
        needsDates: true,
      },
    ],
  },
];

const ALL_REPORTS = REPORT_GROUPS.flatMap((g) => g.reports);
const VALID_IDS = new Set<string>(ALL_REPORTS.map((r) => r.id));

function agingTotals(summary: AgingSummaryRow[]) {
  return summary.reduce(
    (acc, r) => ({
      current: acc.current + r.current,
      d30: acc.d30 + r.d30,
      d60: acc.d60 + r.d60,
      d90: acc.d90 + r.d90,
      total: acc.total + r.total,
    }),
    { current: 0, d30: 0, d60: 0, d90: 0, total: 0 },
  );
}

export function Reports() {
  const { state } = useBooks();
  const [params, setParams] = useSearchParams();
  const raw = params.get('r') ?? '';
  const reportId = (VALID_IDS.has(raw) ? raw : null) as ReportId | null;
  const [query, setQuery] = useState('');
  const [from, setFrom] = useState('2026-01-01');
  const [to, setTo] = useState('2026-12-31');
  const [agingView, setAgingView] = useState<'summary' | 'detail'>('summary');

  const meta = ALL_REPORTS.find((r) => r.id === reportId) ?? null;

  const openReport = (id: ReportId) => {
    setParams({ r: id });
    setAgingView('summary');
  };
  const closeReport = () => setParams({});

  const pl = useMemo(() => profitAndLoss(state, from, to), [state, from, to]);
  const bs = useMemo(() => balanceSheet(state), [state]);
  const ar = useMemo(() => arAging(state.invoices, state.customers), [state]);
  const ap = useMemo(() => apAging(state.bills ?? [], state.vendors), [state]);
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

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return REPORT_GROUPS;
    return REPORT_GROUPS.map((g) => ({
      ...g,
      reports: g.reports.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.blurb.toLowerCase().includes(q) ||
          g.label.toLowerCase().includes(q),
      ),
    })).filter((g) => g.reports.length > 0);
  }, [query]);

  const dateFilter = (
    <div className="rpt-dates">
      <label>
        <span>From</span>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
      </label>
      <label>
        <span>To</span>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </label>
    </div>
  );

  if (!reportId || !meta) {
    return (
      <div className="rpt">
        <div className="page-header">
          <div>
            <h1>Reports</h1>
            <p>Standard reports for {state.company.name} — same groups as QuickBooks Online.</p>
          </div>
        </div>

        <div className="rpt-search">
          <input
            type="search"
            placeholder="Search report list"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search reports"
          />
        </div>

        <div className="rpt-groups">
          {filteredGroups.map((group) => (
            <section key={group.label} className="rpt-group">
              <h2>{group.label}</h2>
              <ul className="rpt-list">
                {group.reports.map((r) => (
                  <li key={r.id}>
                    <button type="button" className="rpt-link" onClick={() => openReport(r.id)}>
                      <span className="rpt-link-title">{r.title}</span>
                      <span className="rpt-link-blurb">{r.blurb}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {filteredGroups.length === 0 ? (
            <p className="empty" style={{ padding: '24px 0' }}>
              No reports match “{query}”.
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  const arTotals = agingTotals(ar.summary);
  const apTotals = agingTotals(ap.summary);

  return (
    <div className="rpt">
      <div className="page-header">
        <div>
          <button type="button" className="rpt-back" onClick={closeReport}>
            ← Reports
          </button>
          <h1>{meta.title}</h1>
          <p>
            {state.company.name}
            {meta.needsDates ? ` · ${shortDate(from)} – ${shortDate(to)}` : ' · As of today'}
          </p>
        </div>
        <div className="rpt-toolbar">
          {meta.needsDates ? dateFilter : null}
          {(reportId === 'ar' || reportId === 'ap') && (
            <div className="rpt-seg">
              <button
                type="button"
                className={agingView === 'summary' ? 'active' : ''}
                onClick={() => setAgingView('summary')}
              >
                Summary
              </button>
              <button
                type="button"
                className={agingView === 'detail' ? 'active' : ''}
                onClick={() => setAgingView('detail')}
              >
                Detail
              </button>
            </div>
          )}
        </div>
      </div>

      {reportId === 'pl' ? (
        <div className="panel">
          <div className="panel-pad rpt-body">
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
              <span>
                Invoices {money(pl.invoiceIncome)} · Cash sales {money(pl.receiptIncome)}
              </span>
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
              <strong>Expenses</strong>
              <strong>{money(pl.expenses)}</strong>
            </div>
            {pl.byCategory.map((c) => (
              <div className="account-row" key={c.name} style={{ paddingLeft: 12 }}>
                <span style={{ color: 'var(--ink-soft)' }}>{c.name}</span>
                <span>{money(c.amount)}</span>
              </div>
            ))}

            <div className="account-row rpt-net">
              <strong>Net income</strong>
              <strong style={{ color: pl.net >= 0 ? 'var(--sea)' : 'var(--coral)' }}>
                {money(pl.net)}
              </strong>
            </div>
            <div className="rpt-footnote">
              Cash collected in period (payments + receipts): {money(pl.cashCollected)}. Sales tax
              on sales: {money(pl.taxCollected)} (liability, not income).
            </div>
          </div>
        </div>
      ) : null}

      {reportId === 'bs' ? (
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
              <h2>Liabilities and equity</h2>
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
                <span>Net income</span>
                <span>{money(bs.netIncome)}</span>
              </div>
              <div className="account-row" style={{ marginTop: 10, fontWeight: 700 }}>
                <span>Total liabilities and equity</span>
                <span>{money(bs.totalLiabilities + bs.totalEquity)}</span>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {reportId === 'ar' ? (
        <div className="panel">
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
            {agingView === 'summary' ? (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th className="num">Current</th>
                      <th className="num">1–30</th>
                      <th className="num">31–60</th>
                      <th className="num">61+</th>
                      <th className="num">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ar.summary.map((r) => (
                      <tr key={r.id}>
                        <td>{r.name}</td>
                        <td className="num">{money(r.current)}</td>
                        <td className="num">{money(r.d30)}</td>
                        <td className="num">{money(r.d60)}</td>
                        <td className="num">{money(r.d90)}</td>
                        <td className="num">{money(r.total)}</td>
                      </tr>
                    ))}
                    {ar.summary.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="empty">
                          No open receivables.
                        </td>
                      </tr>
                    ) : (
                      <tr className="rpt-total-row">
                        <td>Total</td>
                        <td className="num">{money(arTotals.current)}</td>
                        <td className="num">{money(arTotals.d30)}</td>
                        <td className="num">{money(arTotals.d60)}</td>
                        <td className="num">{money(arTotals.d90)}</td>
                        <td className="num">{money(arTotals.total)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
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
                        <td>
                          <Link to="/invoices">{`#${r.invoice.number}`}</Link>
                        </td>
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
            )}
          </div>
        </div>
      ) : null}

      {reportId === 'ap' ? (
        <div className="panel">
          <div className="panel-pad">
            <div className="grid grid-4" style={{ marginBottom: 16 }}>
              {(
                [
                  ['Current', ap.buckets.current],
                  ['1–30', ap.buckets.d30],
                  ['31–60', ap.buckets.d60],
                  ['61+', ap.buckets.d90],
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
            {agingView === 'summary' ? (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Vendor</th>
                      <th className="num">Current</th>
                      <th className="num">1–30</th>
                      <th className="num">31–60</th>
                      <th className="num">61+</th>
                      <th className="num">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ap.summary.map((r) => (
                      <tr key={r.id}>
                        <td>{r.name}</td>
                        <td className="num">{money(r.current)}</td>
                        <td className="num">{money(r.d30)}</td>
                        <td className="num">{money(r.d60)}</td>
                        <td className="num">{money(r.d90)}</td>
                        <td className="num">{money(r.total)}</td>
                      </tr>
                    ))}
                    {ap.summary.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="empty">
                          No open payables.
                        </td>
                      </tr>
                    ) : (
                      <tr className="rpt-total-row">
                        <td>Total</td>
                        <td className="num">{money(apTotals.current)}</td>
                        <td className="num">{money(apTotals.d30)}</td>
                        <td className="num">{money(apTotals.d60)}</td>
                        <td className="num">{money(apTotals.d90)}</td>
                        <td className="num">{money(apTotals.total)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Vendor</th>
                      <th>Bill</th>
                      <th>Due</th>
                      <th>Days</th>
                      <th className="num">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ap.rows.map((r) => (
                      <tr key={r.bill.id}>
                        <td>{r.vendorName}</td>
                        <td>
                          <Link to="/bills">{`#${r.bill.number}`}</Link>
                        </td>
                        <td>{shortDate(r.bill.dueDate)}</td>
                        <td>{r.days}</td>
                        <td className="num">{money(r.bill.balance)}</td>
                      </tr>
                    ))}
                    {ap.rows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="empty">
                          No open payables.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {reportId === 'product' ? (
        <div className="panel">
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
                {byProduct.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="empty">
                      No sales in this range.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {reportId === 'vendor' ? (
        <div className="panel">
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th className="num">Expenses</th>
                  <th className="num">Bills</th>
                  <th className="num">POs</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {byVendor.map((r) => (
                  <tr key={r.name}>
                    <td>{r.name}</td>
                    <td className="num">{money(r.expenses)}</td>
                    <td className="num">{money(r.bills)}</td>
                    <td className="num">{money(r.pos)}</td>
                    <td className="num">{money(r.total)}</td>
                  </tr>
                ))}
                {byVendor.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="empty">
                      No vendor spend in this range.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {reportId === 'inventory' ? (
        <div className="panel">
          <div className="panel-head">
            <h2>Valuation</h2>
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

      {reportId === 'movement' ? (
        <div className="panel">
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
