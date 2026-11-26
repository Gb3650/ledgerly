import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { unpaidBills } from '../lib/accounting';
import { addDaysISO, money, shortDate, todayISO } from '../lib/format';
import { HubTabs, expensesHubTabs } from '../components/HubTabs';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { useBooks } from '../store/BooksContext';
import type { Bill } from '../types';

type LineDraft = {
  categoryAccountId: string;
  description: string;
  qty: number;
  rate: number;
};

export function Bills() {
  const { state, saveBill, voidBill } = useBooks();
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Bill | null>(null);
  const [tab, setTab] = useState<'all' | Bill['status']>('all');

  const categories = state.accounts.filter(
    (a) => a.type === 'expense' || a.type === 'cogs' || a.type === 'other_expense',
  );

  const [vendorId, setVendorId] = useState(state.vendors[0]?.id ?? '');
  const [date, setDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState(addDaysISO(todayISO(), 30));
  const [memo, setMemo] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([
    { categoryAccountId: categories[0]?.id ?? 'acc_office', description: '', qty: 1, rate: 0 },
  ]);

  useEffect(() => {
    if (params.get('new') === '1') {
      openNew(params.get('vendor') ?? undefined);
      setParams({}, { replace: true });
      return;
    }
    const openId = params.get('open');
    if (openId) {
      const bill = (state.bills ?? []).find((b) => b.id === openId || b.number === openId);
      if (bill) openEdit(bill);
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  const openBalance = unpaidBills(state.bills ?? []).reduce((s, b) => s + b.balance, 0);
  const overdue = (state.bills ?? []).filter((b) => b.status === 'overdue');

  const filtered = useMemo(() => {
    let list = [...(state.bills ?? [])].sort((a, b) => b.date.localeCompare(a.date));
    if (tab !== 'all') list = list.filter((b) => b.status === tab);
    return list;
  }, [state.bills, tab]);

  function openNew(presetVendor?: string) {
    setEditing(null);
    setVendorId(presetVendor || state.vendors[0]?.id || '');
    setDate(todayISO());
    setDueDate(addDaysISO(todayISO(), 30));
    setMemo('');
    setLines([
      {
        categoryAccountId: categories[0]?.id ?? 'acc_office',
        description: '',
        qty: 1,
        rate: 0,
      },
    ]);
    setOpen(true);
  }

  function openEdit(bill: Bill) {
    setEditing(bill);
    setVendorId(bill.vendorId);
    setDate(bill.date);
    setDueDate(bill.dueDate);
    setMemo(bill.memo);
    setLines(
      bill.lines.map((l) => ({
        categoryAccountId: l.categoryAccountId,
        description: l.description,
        qty: l.qty,
        rate: l.rate,
      })),
    );
    setOpen(true);
  }

  const subtotal = Math.round(lines.reduce((s, l) => s + l.qty * l.rate, 0) * 100) / 100;
  const canSave = vendorId && lines.some((l) => l.description && l.qty > 0 && l.rate >= 0);

  function onSave() {
    if (!canSave) return;
    saveBill({
      id: editing?.id,
      vendorId,
      date,
      dueDate,
      memo,
      lines: lines.filter((l) => l.description),
    });
    setOpen(false);
  }

  return (
    <div>
      <HubTabs tabs={expensesHubTabs} />
      <div className="page-header">
        <div>
          <h1>Bills</h1>
          <p>Enter vendor bills to track what you owe — then pay them from Pay bills.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link className="btn btn-ghost" to="/pay-bills">
            Pay bills
          </Link>
          <button className="btn btn-primary" onClick={() => openNew()}>
            Create bill
          </button>
        </div>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 16 }}>
        <div className="panel stat">
          <div className="stat-label">Open balance</div>
          <div className="stat-value">{money(openBalance)}</div>
          <div className="stat-hint">{unpaidBills(state.bills ?? []).length} unpaid</div>
        </div>
        <div className={`panel stat ${overdue.length ? 'warning' : ''}`}>
          <div className="stat-label">Overdue</div>
          <div className="stat-value">{money(overdue.reduce((s, b) => s + b.balance, 0))}</div>
          <div className="stat-hint">{overdue.length} bills</div>
        </div>
        <div className="panel stat">
          <div className="stat-label">A/P</div>
          <div className="stat-value">
            {money(state.accounts.find((a) => a.id === 'acc_ap')?.balance ?? openBalance)}
          </div>
          <div className="stat-hint">Accounts payable</div>
        </div>
      </div>

      <div className="tabs">
        {(['all', 'open', 'partial', 'overdue', 'paid'] as const).map((t) => (
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
                <th>No.</th>
                <th>Vendor</th>
                <th>Due</th>
                <th>Status</th>
                <th className="num">Total</th>
                <th className="num">Balance</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((bill) => {
                const vendor = state.vendors.find((v) => v.id === bill.vendorId);
                return (
                  <tr key={bill.id}>
                    <td>{shortDate(bill.date)}</td>
                    <td>
                      <button
                        className="linkish"
                        onClick={() => openEdit(bill)}
                        style={{ color: 'var(--sea)', fontWeight: 700 }}
                      >
                        #{bill.number}
                      </button>
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      <Link to={`/vendors/${bill.vendorId}`} style={{ color: 'var(--sea)' }}>
                        {vendor?.name ?? '—'}
                      </Link>
                    </td>
                    <td>{shortDate(bill.dueDate)}</td>
                    <td>
                      <StatusBadge status={bill.status} />
                    </td>
                    <td className="num">{money(bill.total)}</td>
                    <td className="num">{money(bill.balance)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {bill.balance > 0 && bill.status !== 'void' ? (
                          <Link
                            className="btn btn-primary btn-sm"
                            to={`/pay-bills?bill=${bill.id}`}
                          >
                            Pay
                          </Link>
                        ) : null}
                        {bill.status !== 'paid' && bill.status !== 'void' ? (
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => {
                              if (confirm(`Void bill #${bill.number}?`)) voidBill(bill.id);
                            }}
                          >
                            Void
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="empty">
                    No bills yet — create one to track vendor payables.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {open ? (
        <Modal
          title={editing ? `Bill #${editing.number}` : 'Bill'}
          onClose={() => setOpen(false)}
          wide
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={onSave} disabled={!canSave}>
                Save
              </button>
            </>
          }
        >
          <div className="form-grid two">
            <div className="field">
              <label>Vendor</label>
              <select value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
                {state.vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Bill date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="field">
              <label>Due date</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="field">
              <label>Memo</label>
              <input value={memo} onChange={(e) => setMemo(e.target.value)} />
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <div className="panel-head" style={{ padding: '0 0 10px' }}>
              <h2 style={{ fontSize: '1rem' }}>Category lines</h2>
            </div>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Description</th>
                    <th className="num">Qty</th>
                    <th className="num">Rate</th>
                    <th className="num">Amount</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, idx) => (
                    <tr key={idx}>
                      <td>
                        <select
                          value={line.categoryAccountId}
                          onChange={(e) =>
                            setLines((prev) =>
                              prev.map((l, i) =>
                                i === idx ? { ...l, categoryAccountId: e.target.value } : l,
                              ),
                            )
                          }
                        >
                          {categories.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          value={line.description}
                          onChange={(e) =>
                            setLines((prev) =>
                              prev.map((l, i) =>
                                i === idx ? { ...l, description: e.target.value } : l,
                              ),
                            )
                          }
                        />
                      </td>
                      <td className="num">
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={line.qty}
                          onChange={(e) =>
                            setLines((prev) =>
                              prev.map((l, i) =>
                                i === idx ? { ...l, qty: Number(e.target.value) } : l,
                              ),
                            )
                          }
                          style={{ width: 72, textAlign: 'right' }}
                        />
                      </td>
                      <td className="num">
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={line.rate}
                          onChange={(e) =>
                            setLines((prev) =>
                              prev.map((l, i) =>
                                i === idx ? { ...l, rate: Number(e.target.value) } : l,
                              ),
                            )
                          }
                          style={{ width: 96, textAlign: 'right' }}
                        />
                      </td>
                      <td className="num">{money(line.qty * line.rate)}</td>
                      <td>
                        {lines.length > 1 ? (
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                          >
                            Remove
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              className="btn btn-ghost btn-sm"
              style={{ marginTop: 10 }}
              onClick={() =>
                setLines((prev) => [
                  ...prev,
                  {
                    categoryAccountId: categories[0]?.id ?? 'acc_office',
                    description: '',
                    qty: 1,
                    rate: 0,
                  },
                ])
              }
            >
              Add line
            </button>
            <div style={{ marginTop: 12, textAlign: 'right', fontWeight: 700 }}>
              Total {money(subtotal)}
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
