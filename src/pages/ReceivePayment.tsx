import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { unpaidInvoices } from '../lib/accounting';
import { money, shortDate, todayISO } from '../lib/format';
import { HubTabs, salesHubTabs } from '../components/HubTabs';
import { StatusBadge } from '../components/StatusBadge';
import { useBooks } from '../store/BooksContext';

export function ReceivePayment() {
  const { state, receivePayments } = useBooks();
  const [params, setParams] = useSearchParams();
  const [customerId, setCustomerId] = useState(state.customers[0]?.id ?? '');
  const [date, setDate] = useState(todayISO());
  const [method, setMethod] = useState('Check');
  const [memo, setMemo] = useState('');
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const c = params.get('customer');
    if (c && state.customers.some((x) => x.id === c)) {
      setCustomerId(c);
      setParams({}, { replace: true });
    }
  }, [params, setParams, state.customers]);

  const openForCustomer = useMemo(
    () => unpaidInvoices(state.invoices).filter((i) => i.customerId === customerId),
    [state.invoices, customerId],
  );

  useEffect(() => {
    const next: Record<string, number> = {};
    for (const inv of openForCustomer) next[inv.id] = 0;
    setAmounts(next);
  }, [openForCustomer]);

  const selectedTotal = Object.values(amounts).reduce((s, n) => s + (n || 0), 0);
  const openTotal = openForCustomer.reduce((s, i) => s + i.balance, 0);

  function setAmount(invoiceId: string, value: number, max: number) {
    setAmounts((prev) => ({ ...prev, [invoiceId]: Math.max(0, Math.min(max, value)) }));
  }

  function selectAll() {
    const next: Record<string, number> = {};
    for (const inv of openForCustomer) next[inv.id] = inv.balance;
    setAmounts(next);
  }

  function onSave() {
    const allocations = openForCustomer
      .map((inv) => ({ invoiceId: inv.id, amount: amounts[inv.id] || 0 }))
      .filter((a) => a.amount > 0);
    if (!allocations.length || !customerId) return;
    receivePayments({ customerId, date, method, memo, allocations });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    setMemo('');
  }

  return (
    <div>
      <HubTabs tabs={salesHubTabs} />
      <div className="page-header">
        <div>
          <h1>Receive payment</h1>
          <p>Record a customer payment and apply it across one or more open invoices.</p>
        </div>
        <Link className="btn btn-ghost" to="/invoices?new=1">
          Create invoice
        </Link>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 16 }}>
        <div className="panel stat">
          <div className="stat-label">Customer open</div>
          <div className="stat-value">{money(openTotal)}</div>
          <div className="stat-hint">{openForCustomer.length} invoices</div>
        </div>
        <div className="panel stat positive">
          <div className="stat-label">This payment</div>
          <div className="stat-value">{money(selectedTotal)}</div>
          <div className="stat-hint">Applied amount</div>
        </div>
        <div className="panel stat">
          <div className="stat-label">Holds in</div>
          <div className="stat-value" style={{ fontSize: '1.25rem' }}>
            Undeposited Funds
          </div>
          <div className="stat-hint">
            Then <Link to="/bank-deposit" style={{ color: 'var(--sea)', fontWeight: 700 }}>Bank deposit</Link>
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-pad">
          <div className="form-grid two">
            <div className="field">
              <label>Customer</label>
              <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                {state.customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.balance > 0 ? ` (${money(c.balance)} open)` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Payment date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="field">
              <label>Payment method</label>
              <select value={method} onChange={(e) => setMethod(e.target.value)}>
                <option>Check</option>
                <option>ACH / Wire</option>
                <option>Credit card</option>
                <option>Cash</option>
              </select>
            </div>
            <div className="field">
              <label>Memo</label>
              <input value={memo} onChange={(e) => setMemo(e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head" style={{ flexWrap: 'wrap', gap: 10 }}>
          <h2>Outstanding invoices</h2>
          <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={selectAll}>
            Pay all
          </button>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Date</th>
                <th>Invoice</th>
                <th>Due</th>
                <th>Status</th>
                <th className="num">Open balance</th>
                <th className="num">Payment</th>
              </tr>
            </thead>
            <tbody>
              {openForCustomer.map((inv) => (
                <tr key={inv.id}>
                  <td>{shortDate(inv.date)}</td>
                  <td style={{ fontWeight: 700 }}>
                    <Link to={`/invoices?open=${inv.id}`} style={{ color: 'var(--sea)' }}>
                      #{inv.number}
                    </Link>
                  </td>
                  <td>{shortDate(inv.dueDate)}</td>
                  <td>
                    <StatusBadge status={inv.status} />
                  </td>
                  <td className="num">{money(inv.balance)}</td>
                  <td className="num">
                    <input
                      type="number"
                      min={0}
                      max={inv.balance}
                      step={0.01}
                      value={amounts[inv.id] ?? 0}
                      onChange={(e) => setAmount(inv.id, Number(e.target.value), inv.balance)}
                      style={{ width: 110, textAlign: 'right' }}
                    />
                  </td>
                </tr>
              ))}
              {openForCustomer.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty">
                    No open invoices for this customer.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div
          className="panel-pad"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>
            Amount received {money(selectedTotal)}
            {saved ? (
              <span style={{ marginLeft: 12, color: 'var(--sea)', fontWeight: 600 }}>Saved</span>
            ) : null}
          </div>
          <button className="btn btn-primary" disabled={selectedTotal <= 0} onClick={onSave}>
            Receive payment
          </button>
        </div>
      </div>
    </div>
  );
}
