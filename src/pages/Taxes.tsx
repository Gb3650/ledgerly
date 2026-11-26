import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Modal } from '../components/Modal';
import { money, shortDate, todayISO } from '../lib/format';
import { useBooks } from '../store/BooksContext';

export function Taxes() {
  const { state, recordSalesTaxPayment } = useBooks();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [periodFrom, setPeriodFrom] = useState(`${new Date().getFullYear()}-01-01`);
  const [periodTo, setPeriodTo] = useState(todayISO());
  const [agency, setAgency] = useState('Texas Comptroller');
  const [paymentAccountId, setPaymentAccountId] = useState(
    state.accounts.find((a) => a.type === 'bank')?.id ?? 'acc_checking',
  );
  const [amount, setAmount] = useState(0);
  const [memo, setMemo] = useState('');
  const [error, setError] = useState('');

  const banks = state.accounts.filter((a) => a.type === 'bank' || a.type === 'credit_card');
  const taxPayable = state.accounts.find((a) => a.id === 'acc_sales_tax')?.balance ?? 0;

  const collected = useMemo(() => {
    const inv = (state.invoices ?? [])
      .filter((i) => i.status !== 'draft' && i.status !== 'void')
      .reduce((s, i) => s + i.tax, 0);
    const rcpt = (state.salesReceipts ?? []).reduce((s, r) => s + r.tax, 0);
    return Math.round((inv + rcpt) * 100) / 100;
  }, [state.invoices, state.salesReceipts]);

  const credited = useMemo(
    () =>
      Math.round(
        (state.creditMemos ?? [])
          .filter((c) => c.status !== 'void')
          .reduce((s, c) => s + c.tax, 0) * 100,
      ) / 100,
    [state.creditMemos],
  );

  const filed = useMemo(
    () =>
      Math.round((state.salesTaxPayments ?? []).reduce((s, p) => s + p.amount, 0) * 100) / 100,
    [state.salesTaxPayments],
  );

  const payments = useMemo(
    () => [...(state.salesTaxPayments ?? [])].sort((a, b) => b.date.localeCompare(a.date)),
    [state.salesTaxPayments],
  );

  function openFile() {
    setAmount(Math.max(0, taxPayable));
    setError('');
    setOpen(true);
  }

  function onSave() {
    const id = recordSalesTaxPayment({
      date,
      periodFrom,
      periodTo,
      agency,
      paymentAccountId,
      amount,
      memo,
    });
    if (!id) {
      setError('Could not record payment.');
      return;
    }
    setOpen(false);
    setMemo('');
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Taxes</h1>
          <p>Sales tax center — liability, filings, and payments.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openFile}>
          Record tax payment
        </button>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 16 }}>
        <div className="panel stat">
          <div className="stat-label">Collected</div>
          <div className="stat-value">{money(collected)}</div>
          <div className="stat-hint">Invoices + sales receipts</div>
        </div>
        <div className="panel stat">
          <div className="stat-label">Credits &amp; filed</div>
          <div className="stat-value">{money(credited + filed)}</div>
          <div className="stat-hint">
            Credits {money(credited)} · Payments {money(filed)}
          </div>
        </div>
        <div className="panel stat positive">
          <div className="stat-label">Sales tax payable</div>
          <div className="stat-value">{money(taxPayable)}</div>
          <div className="stat-hint">Ready to file</div>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head">
          <h2>How it works</h2>
        </div>
        <div className="panel-pad" style={{ lineHeight: 1.7 }}>
          <p style={{ marginTop: 0 }}>
            Ledgerly accrues sales tax on invoices and sales receipts into{' '}
            <strong>Sales Tax Payable</strong>. Credit memos reduce the liability. Recording a tax
            payment reduces payable and the bank/credit card you pay from.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link className="btn btn-primary" to="/settings#sales-tax">
              Sales tax settings
            </Link>
            <Link className="btn btn-ghost" to="/accounts">
              Chart of accounts
            </Link>
            <Link className="btn btn-ghost" to="/credit-memos">
              Credit memos
            </Link>
            <Link className="btn btn-ghost" to="/reports">
              Reports
            </Link>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Filing history</h2>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Payment date</th>
                <th>Period</th>
                <th>Agency</th>
                <th>Paid from</th>
                <th className="num">Amount</th>
                <th>Memo</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ color: 'var(--muted)' }}>
                    No sales tax payments recorded yet.
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id}>
                    <td>{shortDate(p.date)}</td>
                    <td>
                      {shortDate(p.periodFrom)} – {shortDate(p.periodTo)}
                    </td>
                    <td>{p.agency}</td>
                    <td>{state.accounts.find((a) => a.id === p.paymentAccountId)?.name}</td>
                    <td className="num">{money(p.amount)}</td>
                    <td>{p.memo || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {open ? (
        <Modal
          title="Record sales tax payment"
          onClose={() => setOpen(false)}
          footer={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={onSave}>
                Save payment
              </button>
            </>
          }
        >
          <p style={{ marginTop: 0, color: 'var(--muted)' }}>
            Current payable: <strong>{money(taxPayable)}</strong>
          </p>
          <div className="form-grid two">
            <div className="field">
              <label>Payment date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="field">
              <label>Pay from</label>
              <select
                value={paymentAccountId}
                onChange={(e) => setPaymentAccountId(e.target.value)}
              >
                {banks.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Period start</label>
              <input
                type="date"
                value={periodFrom}
                onChange={(e) => setPeriodFrom(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Period end</label>
              <input type="date" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} />
            </div>
            <div className="field">
              <label>Agency</label>
              <input value={agency} onChange={(e) => setAgency(e.target.value)} />
            </div>
            <div className="field">
              <label>Amount</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value) || 0)}
              />
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Memo</label>
              <input value={memo} onChange={(e) => setMemo(e.target.value)} />
            </div>
          </div>
          {error ? (
            <div style={{ marginTop: 10, color: '#b42318', fontWeight: 600 }}>{error}</div>
          ) : null}
        </Modal>
      ) : null}
    </div>
  );
}
