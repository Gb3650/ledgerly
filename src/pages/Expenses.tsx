import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { unpaidBills } from '../lib/accounting';
import { money, shortDate, todayISO } from '../lib/format';
import { HubTabs, expensesHubTabs } from '../components/HubTabs';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { useBooks } from '../store/BooksContext';
import type { Expense } from '../types';

export function Expenses() {
  const { state, addExpense, payExpense } = useBooks();
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'all' | Expense['status']>('all');

  const [payeeName, setPayeeName] = useState('');
  const [payeeId, setPayeeId] = useState<string>('');
  const [paymentAccountId, setPaymentAccountId] = useState('acc_checking');
  const [categoryAccountId, setCategoryAccountId] = useState('acc_office');
  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState(0);
  const [status, setStatus] = useState<Expense['status']>('paid');
  const [memo, setMemo] = useState('');
  const [refNumber, setRefNumber] = useState('');

  useEffect(() => {
    if (params.get('new') === '1') {
      openNew();
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  const paymentAccounts = state.accounts.filter(
    (a) => a.type === 'bank' || a.type === 'credit_card' || a.type === 'accounts_payable',
  );
  const categories = state.accounts.filter(
    (a) => a.type === 'expense' || a.type === 'cogs' || a.type === 'other_expense',
  );

  const filtered = useMemo(() => {
    const list = [...state.expenses].sort((a, b) => b.date.localeCompare(a.date));
    if (tab === 'all') return list;
    return list.filter((e) => e.status === tab);
  }, [state.expenses, tab]);

  const totalPaid = state.expenses
    .filter((e) => e.status === 'paid')
    .reduce((s, e) => s + e.amount, 0);

  function openNew() {
    setPayeeName('');
    setPayeeId('');
    setPaymentAccountId('acc_checking');
    setCategoryAccountId(categories[0]?.id ?? 'acc_office');
    setDate(todayISO());
    setAmount(0);
    setStatus('paid');
    setMemo('');
    setRefNumber('');
    setOpen(true);
  }

  function onVendorPick(id: string) {
    setPayeeId(id);
    const v = state.vendors.find((x) => x.id === id);
    if (v) setPayeeName(v.name);
  }

  function onSave() {
    if (!payeeName || amount <= 0) return;
    addExpense({
      payeeId: payeeId || undefined,
      payeeName,
      paymentAccountId,
      categoryAccountId,
      date,
      amount,
      status,
      memo,
      refNumber,
    });
    setOpen(false);
  }

  const openBills = unpaidBills(state.bills ?? []).reduce((s, b) => s + b.balance, 0);

  return (
    <div>
      <HubTabs tabs={expensesHubTabs} />
      <div className="page-header">
        <div>
          <h1>Expenses</h1>
          <p>Track what you spend and keep categories clean for reports.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link className="btn btn-ghost" to="/bills?new=1">
            Bill
          </Link>
          <button className="btn btn-primary" onClick={openNew}>
            Add expense
          </button>
        </div>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 16 }}>
        <div className="panel stat">
          <div className="stat-label">Paid expenses</div>
          <div className="stat-value">{money(totalPaid)}</div>
          <div className="stat-hint">Cash / card expenses</div>
        </div>
        <div className={`panel stat ${openBills ? 'warning' : ''}`}>
          <div className="stat-label">Open bills</div>
          <div className="stat-value">{money(openBills)}</div>
          <div className="stat-hint">
            <Link to="/pay-bills" style={{ color: 'var(--sea)', fontWeight: 700 }}>
              Pay bills
            </Link>
          </div>
        </div>
        <div className="panel stat">
          <div className="stat-label">This month</div>
          <div className="stat-value">
            {money(
              state.expenses
                .filter((e) => e.date.startsWith('2026-11') && e.status === 'paid')
                .reduce((s, e) => s + e.amount, 0),
            )}
          </div>
          <div className="stat-hint">November paid</div>
        </div>
      </div>

      <div className="tabs">
        {(['all', 'paid', 'pending'] as const).map((t) => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'all' ? 'All' : t}
          </button>
        ))}
      </div>

      <div className="panel">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Date</th>
                <th>Payee</th>
                <th>Category</th>
                <th>Payment account</th>
                <th>Memo</th>
                <th>Status</th>
                <th className="num">Amount</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((exp) => (
                <tr key={exp.id}>
                  <td>{shortDate(exp.date)}</td>
                  <td style={{ fontWeight: 600 }}>{exp.payeeName}</td>
                  <td>{state.accounts.find((a) => a.id === exp.categoryAccountId)?.name}</td>
                  <td>{state.accounts.find((a) => a.id === exp.paymentAccountId)?.name}</td>
                  <td style={{ color: 'var(--muted)' }}>{exp.memo || '—'}</td>
                  <td>
                    <StatusBadge status={exp.status} />
                  </td>
                  <td className="num">{money(exp.amount)}</td>
                  <td>
                    {exp.status === 'pending' ? (
                      <button className="btn btn-primary btn-sm" onClick={() => payExpense(exp.id)}>
                        Mark paid
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {open ? (
        <Modal
          title="Expense"
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
                Save
              </button>
            </>
          }
        >
          <div className="form-grid two">
            <div className="field">
              <label>Vendor (optional)</label>
              <select
                value={payeeId}
                onChange={(e) => onVendorPick(e.target.value)}
              >
                <option value="">Custom payee</option>
                {state.vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Payee name</label>
              <input value={payeeName} onChange={(e) => setPayeeName(e.target.value)} />
            </div>
            <div className="field">
              <label>Payment account</label>
              <select
                value={paymentAccountId}
                onChange={(e) => setPaymentAccountId(e.target.value)}
              >
                {paymentAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
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
              <label>Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Expense['status'])}
              >
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
              </select>
            </div>
            <div className="field">
              <label>Ref #</label>
              <input value={refNumber} onChange={(e) => setRefNumber(e.target.value)} />
            </div>
          </div>
          <div className="field" style={{ marginTop: 14 }}>
            <label>Memo</label>
            <textarea value={memo} onChange={(e) => setMemo(e.target.value)} />
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
