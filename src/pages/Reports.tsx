import { useMemo, useState } from 'react';
import { arAging, balanceSheet, profitAndLoss } from '../lib/accounting';
import { money } from '../lib/format';
import { useBooks } from '../store/BooksContext';

export function Reports() {
  const { state } = useBooks();
  const [report, setReport] = useState<'pl' | 'bs' | 'ar'>('pl');
  const [from, setFrom] = useState('2026-01-01');
  const [to, setTo] = useState('2026-12-31');

  const pl = useMemo(() => profitAndLoss(state, from, to), [state, from, to]);
  const bs = useMemo(() => balanceSheet(state), [state]);
  const ar = useMemo(() => arAging(state.invoices, state.customers), [state]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Reports</h1>
          <p>Profit &amp; loss, balance sheet, and A/R aging.</p>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${report === 'pl' ? 'active' : ''}`} onClick={() => setReport('pl')}>
          Profit &amp; Loss
        </button>
        <button className={`tab ${report === 'bs' ? 'active' : ''}`} onClick={() => setReport('bs')}>
          Balance Sheet
        </button>
        <button className={`tab ${report === 'ar' ? 'active' : ''}`} onClick={() => setReport('ar')}>
          A/R Aging
        </button>
      </div>

      {report === 'pl' ? (
        <div className="panel">
          <div className="panel-head" style={{ paddingBottom: 12, flexWrap: 'wrap' }}>
            <h2>Profit &amp; Loss</h2>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              <span style={{ color: 'var(--muted)' }}>to</span>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          <div className="panel-pad">
            <div className="account-row">
              <strong>Income</strong>
              <strong>{money(pl.income)}</strong>
            </div>
            <div style={{ paddingLeft: 12, color: 'var(--ink-soft)' }}>
              <div className="account-row">
                <span>Design &amp; product sales (paid invoices)</span>
                <span>{money(pl.income)}</span>
              </div>
            </div>
            <div className="account-row" style={{ marginTop: 8 }}>
              <strong>Expenses</strong>
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
              <div className="account-row" style={{ fontWeight: 700, borderTop: '1px solid var(--line)', marginTop: 8, paddingTop: 12 }}>
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
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Liabilities</div>
              {bs.liabilities.map((a) => (
                <div className="account-row" key={a.id}>
                  <span>
                    {a.number} · {a.name}
                  </span>
                  <span>{money(Math.abs(a.balance))}</span>
                </div>
              ))}
              <div className="account-row" style={{ fontWeight: 700 }}>
                <span>Total liabilities</span>
                <span>{money(Math.abs(bs.totalLiabilities))}</span>
              </div>
              <div style={{ fontWeight: 700, margin: '16px 0 4px' }}>Equity</div>
              {bs.equity.map((a) => (
                <div className="account-row" key={a.id}>
                  <span>
                    {a.number} · {a.name}
                  </span>
                  <span>{money(a.balance)}</span>
                </div>
              ))}
              <div className="account-row" style={{ fontWeight: 700, borderTop: '1px solid var(--line)', marginTop: 8, paddingTop: 12 }}>
                <span>Total liabilities &amp; equity</span>
                <span>{money(Math.abs(bs.totalLiabilities) + bs.totalEquity)}</span>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {report === 'ar' ? (
        <div>
          <div className="grid grid-4" style={{ marginBottom: 16 }}>
            {(
              [
                ['Current', ar.buckets.current],
                ['1–30', ar.buckets.d30],
                ['31–60', ar.buckets.d60],
                ['90+', ar.buckets.d90],
              ] as const
            ).map(([label, val]) => (
              <div className="panel stat" key={label}>
                <div className="stat-label">{label}</div>
                <div className="stat-value">{money(val)}</div>
              </div>
            ))}
          </div>
          <div className="panel">
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Invoice</th>
                    <th>Due</th>
                    <th>Days past due</th>
                    <th className="num">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {ar.rows.map((r) => (
                    <tr key={r.invoice.id}>
                      <td style={{ fontWeight: 600 }}>{r.customerName}</td>
                      <td>#{r.invoice.number}</td>
                      <td>{r.invoice.dueDate}</td>
                      <td>{Math.max(0, r.days)}</td>
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
    </div>
  );
}
