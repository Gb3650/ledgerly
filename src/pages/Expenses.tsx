import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { unpaidBills } from '../lib/accounting';
import { money, shortDate, todayISO } from '../lib/format';
import { HubTabs, expensesHubTabs } from '../components/HubTabs';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { useBooks } from '../store/BooksContext';

type TxnTypeFilter = 'all' | 'Expense' | 'Bill' | 'Bill payment';

type ExpenseTxn = {
  id: string;
  date: string;
  type: 'Expense' | 'Bill' | 'Bill payment';
  number: string;
  payee: string;
  category: string;
  memo: string;
  status: string;
  total: number;
  balance: number;
  href: string;
};

export function Expenses() {
  const { state, addExpense } = useBooks();
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TxnTypeFilter>('all');
  const [query, setQuery] = useState('');

  const [payeeName, setPayeeName] = useState('');
  const [payeeId, setPayeeId] = useState('');
  const [paymentAccountId, setPaymentAccountId] = useState('acc_checking');
  const [categoryAccountId, setCategoryAccountId] = useState('acc_office');
  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState(0);
  const [memo, setMemo] = useState('');
  const [refNumber, setRefNumber] = useState('');

  useEffect(() => {
    if (params.get('new') === '1') {
      openNew(params.get('vendor') ?? undefined);
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  const paymentAccounts = state.accounts.filter(
    (a) => a.type === 'bank' || a.type === 'credit_card',
  );
  const categories = state.accounts.filter(
    (a) => a.type === 'expense' || a.type === 'cogs' || a.type === 'other_expense',
  );

  const txns: ExpenseTxn[] = useMemo(() => {
    const expenseRows: ExpenseTxn[] = state.expenses.map((exp) => ({
      id: exp.id,
      date: exp.date,
      type: 'Expense',
      number: exp.refNumber || '—',
      payee: exp.payeeName,
      category: state.accounts.find((a) => a.id === exp.categoryAccountId)?.name ?? '—',
      memo: exp.memo,
      status: exp.status,
      total: exp.amount,
      balance: exp.status === 'pending' ? exp.amount : 0,
      href: '/expenses',
    }));

    const billRows: ExpenseTxn[] = (state.bills ?? []).map((bill) => {
      const vendor = state.vendors.find((v) => v.id === bill.vendorId);
      const firstCat = bill.lines[0]
        ? state.accounts.find((a) => a.id === bill.lines[0].categoryAccountId)?.name
        : undefined;
      return {
        id: bill.id,
        date: bill.date,
        type: 'Bill' as const,
        number: bill.number,
        payee: vendor?.name ?? '—',
        category: firstCat ?? (bill.lines.length > 1 ? 'Multiple' : '—'),
        memo: bill.memo,
        status: bill.status,
        total: bill.total,
        balance: bill.balance,
        href: `/bills?open=${bill.id}`,
      };
    });

    const paymentRows: ExpenseTxn[] = (state.billPayments ?? []).map((pmt) => {
      const bill = (state.bills ?? []).find((b) => b.id === pmt.billId);
      const vendor = bill ? state.vendors.find((v) => v.id === bill.vendorId) : undefined;
      return {
        id: pmt.id,
        date: pmt.date,
        type: 'Bill payment' as const,
        number: bill ? bill.number : '—',
        payee: vendor?.name ?? '—',
        category: state.accounts.find((a) => a.id === pmt.paymentAccountId)?.name ?? '—',
        memo: pmt.memo || (pmt.method ? `Paid by ${pmt.method}` : ''),
        status: 'paid',
        total: pmt.amount,
        balance: 0,
        href: bill ? `/bills?open=${bill.id}` : '/pay-bills',
      };
    });

    return [...expenseRows, ...billRows, ...paymentRows].sort((a, b) =>
      b.date.localeCompare(a.date),
    );
  }, [state.expenses, state.bills, state.billPayments, state.vendors, state.accounts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return txns.filter((t) => {
      if (typeFilter !== 'all' && t.type !== typeFilter) return false;
      if (!q) return true;
      return (
        t.payee.toLowerCase().includes(q) ||
        t.memo.toLowerCase().includes(q) ||
        t.number.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.type.toLowerCase().includes(q)
      );
    });
  }, [txns, typeFilter, query]);

  const openBills = unpaidBills(state.bills ?? []).reduce((s, b) => s + b.balance, 0);
  const paidExpenses = state.expenses
    .filter((e) => e.status === 'paid')
    .reduce((s, e) => s + e.amount, 0);
  const monthPrefix = todayISO().slice(0, 7);
  const monthSpend = txns
    .filter((t) => t.date.startsWith(monthPrefix) && t.type !== 'Bill payment')
    .reduce((s, t) => s + t.total, 0);

  function openNew(presetVendor?: string) {
    const vendor = presetVendor ? state.vendors.find((v) => v.id === presetVendor) : undefined;
    setPayeeName(vendor?.name ?? '');
    setPayeeId(vendor?.id ?? '');
    setPaymentAccountId(paymentAccounts[0]?.id ?? 'acc_checking');
    setCategoryAccountId(categories[0]?.id ?? 'acc_office');
    setDate(todayISO());
    setAmount(0);
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
      status: 'paid',
      memo,
      refNumber,
    });
    setOpen(false);
  }

  return (
    <div>
      <HubTabs tabs={expensesHubTabs} />
      <div className="page-header">
        <div>
          <h1>Expenses</h1>
          <p>Expenses, bills, and bill payments in one place — like QuickBooks Online.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link className="btn btn-ghost" to="/pay-bills">
            Pay bills
          </Link>
          <Link className="btn btn-ghost" to="/bills?new=1">
            Bill
          </Link>
          <button className="btn btn-primary" onClick={() => openNew()}>
            Expense
          </button>
        </div>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 16 }}>
        <div className="panel stat">
          <div className="stat-label">Cash expenses</div>
          <div className="stat-value">{money(paidExpenses)}</div>
          <div className="stat-hint">Paid from bank / card</div>
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
          <div className="stat-value">{money(monthSpend)}</div>
          <div className="stat-hint">Expenses + bills dated {monthPrefix}</div>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <div className="tabs" style={{ marginBottom: 0 }}>
          {(['all', 'Expense', 'Bill', 'Bill payment'] as const).map((t) => (
            <button
              key={t}
              className={`tab ${typeFilter === t ? 'active' : ''}`}
              onClick={() => setTypeFilter(t)}
            >
              {t === 'all' ? 'All transactions' : t}
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by payee, memo, #…"
          aria-label="Filter expenses"
          style={{ marginLeft: 'auto', minWidth: 200, maxWidth: 280 }}
        />
      </div>

      <div className="panel">
        <div className="table-wrap">
          <table className="data data-clickable">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>No.</th>
                <th>Payee</th>
                <th>Category</th>
                <th>Memo</th>
                <th>Status</th>
                <th className="num">Total</th>
                <th className="num">Open</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={`${row.type}-${row.id}`}>
                  <td>{shortDate(row.date)}</td>
                  <td style={{ fontWeight: 600 }}>{row.type}</td>
                  <td>
                    {row.href.includes('?') ? (
                      <Link to={row.href} style={{ color: 'var(--sea)', fontWeight: 700 }}>
                        {row.number}
                      </Link>
                    ) : (
                      row.number
                    )}
                  </td>
                  <td style={{ fontWeight: 600 }}>{row.payee}</td>
                  <td>{row.category}</td>
                  <td style={{ color: 'var(--muted)' }}>{row.memo || '—'}</td>
                  <td>
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="num">{money(row.total)}</td>
                  <td className="num">{row.balance > 0 ? money(row.balance) : '—'}</td>
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="empty">
                    No transactions match — create an expense or bill.
                  </td>
                </tr>
              ) : null}
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
                Save and close
              </button>
            </>
          }
        >
          <p style={{ margin: '0 0 14px', color: 'var(--muted)', fontSize: '0.9rem' }}>
            Pays from a bank or credit card now. To track A/P, use{' '}
            <Link to="/bills?new=1" style={{ color: 'var(--sea)', fontWeight: 700 }}>
              Bill
            </Link>{' '}
            instead.
          </p>
          <div className="form-grid two">
            <div className="field">
              <label>Vendor</label>
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
              <label>Payment date</label>
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
