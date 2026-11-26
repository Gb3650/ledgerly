import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { unpaidBills } from '../lib/accounting';
import { money, shortDate, todayISO } from '../lib/format';
import { HubTabs, expensesHubTabs } from '../components/HubTabs';
import { StatusBadge } from '../components/StatusBadge';
import { useBooks } from '../store/BooksContext';

export function PayBills() {
  const { state, payBills } = useBooks();
  const [params, setParams] = useSearchParams();
  const [paymentAccountId, setPaymentAccountId] = useState('acc_checking');
  const [date, setDate] = useState(todayISO());
  const [method, setMethod] = useState('Check');
  const [memo, setMemo] = useState('');
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [vendorFilter, setVendorFilter] = useState('');
  const [saved, setSaved] = useState(false);

  const banks = state.accounts.filter((a) => a.type === 'bank' || a.type === 'credit_card');
  const open = useMemo(() => unpaidBills(state.bills ?? []), [state.bills]);

  useEffect(() => {
    const preset: Record<string, number> = {};
    for (const b of open) preset[b.id] = 0;
    const billId = params.get('bill');
    const vendorId = params.get('vendor');
    if (billId) {
      const bill = open.find((b) => b.id === billId);
      if (bill) {
        preset[bill.id] = bill.balance;
        setVendorFilter(bill.vendorId);
      }
      setParams({}, { replace: true });
    } else if (vendorId) {
      setVendorFilter(vendorId);
      setParams({}, { replace: true });
    }
    setAmounts(preset);
  }, [open, params, setParams]);

  const filtered = useMemo(() => {
    if (!vendorFilter) return open;
    return open.filter((b) => b.vendorId === vendorFilter);
  }, [open, vendorFilter]);

  const selectedTotal = Object.entries(amounts).reduce((s, [id, amt]) => {
    if (!filtered.some((b) => b.id === id)) return s;
    return s + (amt || 0);
  }, 0);

  function setAmount(billId: string, value: number, max: number) {
    setAmounts((prev) => ({ ...prev, [billId]: Math.max(0, Math.min(max, value)) }));
  }

  function selectAll() {
    const next: Record<string, number> = { ...amounts };
    for (const b of filtered) next[b.id] = b.balance;
    setAmounts(next);
  }

  function clearAll() {
    const next: Record<string, number> = { ...amounts };
    for (const b of filtered) next[b.id] = 0;
    setAmounts(next);
  }

  function onPay() {
    const allocations = filtered
      .map((b) => ({ billId: b.id, amount: amounts[b.id] || 0 }))
      .filter((a) => a.amount > 0);
    if (!allocations.length) return;
    payBills({ paymentAccountId, date, method, memo, allocations });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    setMemo('');
  }

  return (
    <div>
      <HubTabs tabs={expensesHubTabs} />
      <div className="page-header">
        <div>
          <h1>Pay bills</h1>
          <p>
            Choose open bills, set payment amounts, and pay from one bank or credit card account.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link className="btn btn-ghost" to="/bills">
            Bills
          </Link>
          <Link className="btn btn-ghost" to="/bills?new=1">
            Create bill
          </Link>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-pad">
          <div className="form-grid two">
            <div className="field">
              <label>Payment account</label>
              <select
                value={paymentAccountId}
                onChange={(e) => setPaymentAccountId(e.target.value)}
              >
                {banks.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({money(a.balance)})
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
              <label>Filter vendor</label>
              <select value={vendorFilter} onChange={(e) => setVendorFilter(e.target.value)}>
                <option value="">All vendors</option>
                {state.vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field" style={{ marginTop: 12 }}>
            <label>Memo</label>
            <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Optional" />
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head" style={{ flexWrap: 'wrap', gap: 10 }}>
          <h2>Open bills</h2>
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}>
            <button className="btn btn-ghost btn-sm" onClick={selectAll}>
              Select all
            </button>
            <button className="btn btn-ghost btn-sm" onClick={clearAll}>
              Clear
            </button>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Due</th>
                <th>Bill</th>
                <th>Vendor</th>
                <th>Status</th>
                <th className="num">Open balance</th>
                <th className="num">Payment</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((bill) => {
                const vendor = state.vendors.find((v) => v.id === bill.vendorId);
                return (
                  <tr key={bill.id}>
                    <td>{shortDate(bill.dueDate)}</td>
                    <td style={{ fontWeight: 700 }}>
                      <Link to={`/bills?open=${bill.id}`} style={{ color: 'var(--sea)' }}>
                        #{bill.number}
                      </Link>
                    </td>
                    <td>{vendor?.name ?? '—'}</td>
                    <td>
                      <StatusBadge status={bill.status} />
                    </td>
                    <td className="num">{money(bill.balance)}</td>
                    <td className="num">
                      <input
                        type="number"
                        min={0}
                        max={bill.balance}
                        step={0.01}
                        value={amounts[bill.id] ?? 0}
                        onChange={(e) => setAmount(bill.id, Number(e.target.value), bill.balance)}
                        style={{ width: 110, textAlign: 'right' }}
                      />
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty">
                    No open bills —{' '}
                    <Link to="/bills?new=1" style={{ color: 'var(--sea)', fontWeight: 700 }}>
                      create a bill
                    </Link>
                    .
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="panel-pad" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>
            Total payment {money(selectedTotal)}
            {saved ? (
              <span style={{ marginLeft: 12, color: 'var(--sea)', fontWeight: 600 }}>Paid</span>
            ) : null}
          </div>
          <button
            className="btn btn-primary"
            disabled={selectedTotal <= 0}
            onClick={onPay}
          >
            Pay bills
          </button>
        </div>
      </div>
    </div>
  );
}
