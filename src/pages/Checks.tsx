import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { money, shortDate, todayISO } from '../lib/format';
import { HubTabs, bankingHubTabs } from '../components/HubTabs';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { useBooks } from '../store/BooksContext';

export function Checks() {
  const { state, writeCheck, voidCheck } = useBooks();
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(false);

  const banks = state.accounts.filter((a) => a.type === 'bank');
  const categories = state.accounts.filter(
    (a) => a.type === 'expense' || a.type === 'cogs' || a.type === 'other_expense',
  );

  const [bankAccountId, setBankAccountId] = useState(banks[0]?.id ?? 'acc_checking');
  const [payeeId, setPayeeId] = useState('');
  const [payeeName, setPayeeName] = useState('');
  const [categoryAccountId, setCategoryAccountId] = useState(categories[0]?.id ?? 'acc_office');
  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState(0);
  const [memo, setMemo] = useState('');
  const [number, setNumber] = useState(String(state.nextCheckNumber ?? 1001));

  useEffect(() => {
    if (params.get('new') === '1') {
      openNew();
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  const list = useMemo(
    () => [...(state.checks ?? [])].sort((a, b) => b.date.localeCompare(a.date)),
    [state.checks],
  );

  function openNew() {
    setBankAccountId(banks[0]?.id ?? 'acc_checking');
    setPayeeId('');
    setPayeeName('');
    setCategoryAccountId(categories[0]?.id ?? 'acc_office');
    setDate(todayISO());
    setAmount(0);
    setMemo('');
    setNumber(String(state.nextCheckNumber ?? 1001));
    setOpen(true);
  }

  function onVendorPick(id: string) {
    setPayeeId(id);
    const v = state.vendors.find((x) => x.id === id);
    if (v) setPayeeName(v.name);
  }

  function onSave() {
    if (!payeeName || amount <= 0) return;
    writeCheck({
      bankAccountId,
      payeeId: payeeId || undefined,
      payeeName,
      categoryAccountId,
      date,
      amount,
      memo,
      number,
    });
    setOpen(false);
  }

  return (
    <div>
      <HubTabs tabs={bankingHubTabs} />
      <div className="page-header">
        <div>
          <h1>Checks</h1>
          <p>Write a check from a bank account — same flow as QuickBooks Online.</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>
          Write check
        </button>
      </div>

      <div className="panel">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Date</th>
                <th>No.</th>
                <th>Payee</th>
                <th>Bank account</th>
                <th>Category</th>
                <th>Status</th>
                <th className="num">Amount</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((chk) => (
                <tr key={chk.id}>
                  <td>{shortDate(chk.date)}</td>
                  <td style={{ fontWeight: 700 }}>#{chk.number}</td>
                  <td>{chk.payeeName}</td>
                  <td>{state.accounts.find((a) => a.id === chk.bankAccountId)?.name}</td>
                  <td>{state.accounts.find((a) => a.id === chk.categoryAccountId)?.name}</td>
                  <td>
                    <StatusBadge status={chk.status} />
                  </td>
                  <td className="num">{money(chk.amount)}</td>
                  <td>
                    {chk.status === 'open' ? (
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          if (confirm(`Void check #${chk.number}?`)) voidCheck(chk.id);
                        }}
                      >
                        Void
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
              {list.length === 0 ? (
                <tr>
                  <td colSpan={8} className="empty">
                    No checks yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {open ? (
        <Modal
          title="Check"
          onClose={() => setOpen(false)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={onSave}
                disabled={!payeeName || amount <= 0}
              >
                Print check / Save
              </button>
            </>
          }
        >
          <div className="form-grid two">
            <div className="field">
              <label>Bank account</label>
              <select value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)}>
                {banks.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({money(a.balance)})
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Check no.</label>
              <input value={number} onChange={(e) => setNumber(e.target.value)} />
            </div>
            <div className="field">
              <label>Vendor (optional)</label>
              <select value={payeeId} onChange={(e) => onVendorPick(e.target.value)}>
                <option value="">Custom payee</option>
                {state.vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Payee</label>
              <input value={payeeName} onChange={(e) => setPayeeName(e.target.value)} />
            </div>
            <div className="field">
              <label>Category</label>
              <select
                value={categoryAccountId}
                onChange={(e) => setCategoryAccountId(e.target.value)}
              >
                {categories.map((a) => (
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
                min={0}
                step={0.01}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
              />
            </div>
            <div className="field">
              <label>Memo</label>
              <input value={memo} onChange={(e) => setMemo(e.target.value)} />
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
