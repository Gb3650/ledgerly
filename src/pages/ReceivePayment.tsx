import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { unpaidInvoices } from '../lib/accounting';
import { money, shortDate, todayISO } from '../lib/format';
import { HubTabs, salesHubTabs } from '../components/HubTabs';
import { StatusBadge } from '../components/StatusBadge';
import { useBooks } from '../store/BooksContext';

/** QBO Receive payment: amount received → allocate across open invoices */
export function ReceivePayment() {
  const { state, receivePayments } = useBooks();
  const [params, setParams] = useSearchParams();
  const [customerId, setCustomerId] = useState(state.customers[0]?.id ?? '');
  const [date, setDate] = useState(todayISO());
  const [method, setMethod] = useState('Check');
  const [refNumber, setRefNumber] = useState('');
  const [memo, setMemo] = useState('');
  const [amountReceived, setAmountReceived] = useState(0);
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [saved, setSaved] = useState(false);

  const depositAccount =
    state.accounts.find((a) => a.name.toLowerCase().includes('undeposited')) ??
    state.accounts.find((a) => a.type === 'bank' && a.isActive);

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
    setAmountReceived(0);
  }, [openForCustomer]);

  const selectedTotal = Object.values(amounts).reduce((s, n) => s + (n || 0), 0);
  const openTotal = openForCustomer.reduce((s, i) => s + i.balance, 0);
  const creditLeft = Math.round((amountReceived - selectedTotal) * 100) / 100;

  function setAmount(invoiceId: string, value: number, max: number) {
    setAmounts((prev) => ({ ...prev, [invoiceId]: Math.max(0, Math.min(max, value)) }));
  }

  /** QBO-style: enter Amount received, then Auto-apply oldest first */
  function autoApply(received: number) {
    let left = Math.round(received * 100) / 100;
    const next: Record<string, number> = {};
    const ordered = [...openForCustomer].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    for (const inv of ordered) {
      const apply = Math.min(inv.balance, left);
      next[inv.id] = apply;
      left = Math.round((left - apply) * 100) / 100;
    }
    for (const inv of openForCustomer) {
      if (next[inv.id] == null) next[inv.id] = 0;
    }
    setAmounts(next);
  }

  function onAmountReceivedChange(value: number) {
    const v = Math.max(0, value);
    setAmountReceived(v);
    autoApply(v);
  }

  function selectAll() {
    const total = openForCustomer.reduce((s, i) => s + i.balance, 0);
    setAmountReceived(total);
    autoApply(total);
  }

  function clearPayments() {
    setAmountReceived(0);
    const next: Record<string, number> = {};
    for (const inv of openForCustomer) next[inv.id] = 0;
    setAmounts(next);
  }

  function onSave() {
    const allocations = openForCustomer
      .map((inv) => ({ invoiceId: inv.id, amount: amounts[inv.id] || 0 }))
      .filter((a) => a.amount > 0);
    if (!allocations.length || !customerId) return;
    receivePayments({
      customerId,
      date,
      method,
      memo: [refNumber && `Ref ${refNumber}`, memo].filter(Boolean).join(' · '),
      allocations,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    setMemo('');
    setRefNumber('');
    setAmountReceived(0);
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

      <div className="panel txn-form" style={{ marginBottom: 16 }}>
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
              <label>Reference no.</label>
              <input
                value={refNumber}
                onChange={(e) => setRefNumber(e.target.value)}
                placeholder="Check # / confirmation"
              />
            </div>
            <div className="field">
              <label>Amount received</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={amountReceived}
                onChange={(e) => onAmountReceivedChange(Number(e.target.value))}
                autoFocus
              />
            </div>
            <div className="field">
              <label>Deposit to</label>
              <select disabled value={depositAccount?.id ?? ''}>
                <option value={depositAccount?.id ?? ''}>
                  {depositAccount?.name ?? 'Undeposited Funds'}
                </option>
              </select>
              <div className="field-hint">Held until Bank deposit (QBO Undeposited Funds).</div>
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Memo</label>
              <input value={memo} onChange={(e) => setMemo(e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 16 }}>
        <div className="panel stat">
          <div className="stat-label">Customer open</div>
          <div className="stat-value">{money(openTotal)}</div>
          <div className="stat-hint">{openForCustomer.length} invoices</div>
        </div>
        <div className="panel stat positive">
          <div className="stat-label">Payment</div>
          <div className="stat-value">{money(amountReceived)}</div>
          <div className="stat-hint">Amount received</div>
        </div>
        <div className={`panel stat ${creditLeft > 0.009 ? 'warning' : ''}`}>
          <div className="stat-label">Amount to apply</div>
          <div className="stat-value">{money(selectedTotal)}</div>
          <div className="stat-hint">
            {creditLeft > 0.009
              ? `${money(creditLeft)} unapplied (enter less or apply more)`
              : 'Fully applied'}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head" style={{ flexWrap: 'wrap', gap: 10 }}>
          <h2>Outstanding invoices</h2>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={clearPayments}>
              Clear
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={selectAll}>
              Auto-apply
            </button>
          </div>
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
                    <Link to={`/invoices?open=${inv.id}`} className="linkish">
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
            Amount to credit {money(selectedTotal)}
            {saved ? (
              <span style={{ marginLeft: 12, color: 'var(--sea)', fontWeight: 600 }}>Saved</span>
            ) : null}
          </div>
          <button
            type="button"
            className="btn btn-primary"
            disabled={selectedTotal <= 0 || creditLeft < -0.009}
            onClick={onSave}
          >
            Receive payment
          </button>
        </div>
      </div>
    </div>
  );
}
