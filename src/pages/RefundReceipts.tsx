import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { HubTabs, salesHubTabs } from '../components/HubTabs';
import { Modal } from '../components/Modal';
import { money, shortDate, todayISO } from '../lib/format';
import { useBooks } from '../store/BooksContext';

export function RefundReceipts() {
  const { state, createRefundReceipt } = useBooks();
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState(state.customers[0]?.id ?? '');
  const [paymentAccountId, setPaymentAccountId] = useState(
    state.accounts.find((a) => a.type === 'bank')?.id ?? 'acc_checking',
  );
  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState(0);
  const [memo, setMemo] = useState('');
  const [creditMemoId, setCreditMemoId] = useState('');
  const [error, setError] = useState('');

  const banks = state.accounts.filter((a) => a.type === 'bank' || a.type === 'credit_card');
  const openCredits = useMemo(
    () =>
      (state.creditMemos ?? []).filter(
        (c) => c.customerId === customerId && c.status !== 'void' && c.balance > 0,
      ),
    [state.creditMemos, customerId],
  );
  const refunds = useMemo(
    () => [...(state.refundReceipts ?? [])].sort((a, b) => b.date.localeCompare(a.date)),
    [state.refundReceipts],
  );

  useEffect(() => {
    const credit = params.get('credit');
    if (credit) {
      const cm = (state.creditMemos ?? []).find((c) => c.id === credit);
      if (cm) {
        setCustomerId(cm.customerId);
        setCreditMemoId(cm.id);
        setAmount(cm.balance);
        setOpen(true);
      }
      setParams({}, { replace: true });
    } else if (params.get('new') === '1') {
      setOpen(true);
      setParams({}, { replace: true });
    }
  }, [params, setParams, state.creditMemos]);

  function onSave() {
    const id = createRefundReceipt({
      customerId,
      paymentAccountId,
      date,
      amount,
      memo,
      creditMemoId: creditMemoId || undefined,
    });
    if (!id) {
      setError('Could not save refund. Check amount and credit balance.');
      return;
    }
    setOpen(false);
    setError('');
    setAmount(0);
    setMemo('');
    setCreditMemoId('');
  }

  return (
    <div>
      <HubTabs tabs={salesHubTabs} />
      <div className="page-header">
        <div>
          <h1>Refund receipts</h1>
          <p>Refund a customer from bank or credit card; optionally close a credit memo.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
          <Plus size={16} /> New refund
        </button>
      </div>

      <div className="panel">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Date</th>
                <th>No.</th>
                <th>Customer</th>
                <th>Account</th>
                <th className="num">Amount</th>
                <th>Memo</th>
              </tr>
            </thead>
            <tbody>
              {refunds.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ color: 'var(--muted)' }}>
                    No refunds yet.
                  </td>
                </tr>
              ) : (
                refunds.map((r) => (
                  <tr key={r.id}>
                    <td>{shortDate(r.date)}</td>
                    <td style={{ fontWeight: 600 }}>RF-{r.number}</td>
                    <td>{state.customers.find((c) => c.id === r.customerId)?.name ?? '—'}</td>
                    <td>{state.accounts.find((a) => a.id === r.paymentAccountId)?.name}</td>
                    <td className="num">{money(r.amount)}</td>
                    <td>{r.memo || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {open ? (
        <Modal
          title="Refund receipt"
          onClose={() => setOpen(false)}
          footer={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={onSave}>
                Save
              </button>
            </>
          }
        >
          <div className="form-grid two">
            <div className="field">
              <label>Customer</label>
              <select
                value={customerId}
                onChange={(e) => {
                  setCustomerId(e.target.value);
                  setCreditMemoId('');
                }}
              >
                {state.customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Refund from</label>
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
              <label>Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
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
              <label>Apply against credit memo (optional)</label>
              <select
                value={creditMemoId}
                onChange={(e) => {
                  setCreditMemoId(e.target.value);
                  const cm = openCredits.find((c) => c.id === e.target.value);
                  if (cm) setAmount(cm.balance);
                }}
              >
                <option value="">None</option>
                {openCredits.map((c) => (
                  <option key={c.id} value={c.id}>
                    CM-{c.number} · {money(c.balance)} unapplied
                  </option>
                ))}
              </select>
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
