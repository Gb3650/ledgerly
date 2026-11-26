import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { money, shortDate } from '../lib/format';
import { HubTabs, expensesHubTabs } from '../components/HubTabs';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { useBooks } from '../store/BooksContext';

type VendorTxn = {
  id: string;
  date: string;
  type: string;
  number: string;
  status: string;
  amount: number;
  balance: number;
  href: string;
  memo: string;
};

export function VendorDetail() {
  const { id } = useParams();
  const { state, updateVendor } = useBooks();
  const vendor = state.vendors.find((v) => v.id === id);
  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');

  if (!vendor) {
    return (
      <div className="panel panel-pad">
        <p>Vendor not found.</p>
        <Link to="/vendors">Back to vendors</Link>
      </div>
    );
  }

  const expenses = state.expenses.filter(
    (e) => e.payeeId === vendor.id || e.payeeName === vendor.name,
  );
  const bills = (state.bills ?? []).filter((b) => b.vendorId === vendor.id);
  const payments = (state.billPayments ?? []).filter((p) =>
    bills.some((b) => b.id === p.billId),
  );
  const pos = state.purchaseOrders
    .filter((p) => p.vendorId === vendor.id)
    .sort((a, b) => b.date.localeCompare(a.date));

  const txns: VendorTxn[] = [
    ...expenses.map((e) => ({
      id: e.id,
      date: e.date,
      type: 'Expense',
      number: e.refNumber || '—',
      status: e.status,
      amount: e.amount,
      balance: e.status === 'pending' ? e.amount : 0,
      href: '/expenses',
      memo: e.memo,
    })),
    ...bills.map((b) => ({
      id: b.id,
      date: b.date,
      type: 'Bill',
      number: b.number,
      status: b.status,
      amount: b.total,
      balance: b.balance,
      href: `/bills?open=${b.id}`,
      memo: b.memo,
    })),
    ...payments.map((p) => {
      const bill = bills.find((b) => b.id === p.billId);
      return {
        id: p.id,
        date: p.date,
        type: 'Bill payment',
        number: bill?.number ?? '—',
        status: 'paid',
        amount: p.amount,
        balance: 0,
        href: bill ? `/bills?open=${bill.id}` : '/pay-bills',
        memo: p.memo || p.method,
      };
    }),
  ].sort((a, b) => b.date.localeCompare(a.date));

  function openEdit() {
    setName(vendor!.name);
    setEmail(vendor!.email);
    setPhone(vendor!.phone);
    setCategory(vendor!.category);
    setNotes(vendor!.notes ?? '');
    setEditOpen(true);
  }

  function onSaveEdit() {
    if (!name.trim()) return;
    updateVendor(vendor!.id, { name, email, phone, category, notes });
    setEditOpen(false);
  }

  return (
    <div>
      <HubTabs tabs={expensesHubTabs} />
      <div className="page-header">
        <div>
          <div style={{ marginBottom: 6 }}>
            <Link to="/vendors" style={{ color: 'var(--sea)', fontWeight: 600, fontSize: '0.85rem' }}>
              ← Vendors
            </Link>
          </div>
          <h1>{vendor.name}</h1>
          <p>
            {vendor.category}
            {vendor.email ? ` · ${vendor.email}` : ''}
            {vendor.phone ? ` · ${vendor.phone}` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost" onClick={openEdit}>
            Edit
          </button>
          <Link className="btn btn-ghost" to={`/expenses?new=1&vendor=${vendor.id}`}>
            Expense
          </Link>
          <Link className="btn btn-ghost" to={`/pay-bills?vendor=${vendor.id}`}>
            Pay bills
          </Link>
          <Link className="btn btn-primary" to={`/bills?new=1&vendor=${vendor.id}`}>
            Create bill
          </Link>
        </div>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 16 }}>
        <div className={`panel stat ${vendor.balance > 0 ? 'warning' : ''}`}>
          <div className="stat-label">Open balance</div>
          <div className="stat-value">{money(vendor.balance)}</div>
          <div className="stat-hint">Unpaid bills</div>
        </div>
        <div className="panel stat">
          <div className="stat-label">Bills</div>
          <div className="stat-value">{bills.length}</div>
          <div className="stat-hint">{payments.length} payments</div>
        </div>
        <div className="panel stat">
          <div className="stat-label">Expenses</div>
          <div className="stat-value">{expenses.length}</div>
          <div className="stat-hint">{pos.length} purchase orders</div>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head">
          <h2>Transaction list</h2>
        </div>
        <div className="table-wrap">
          <table className="data data-clickable">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>No.</th>
                <th>Memo</th>
                <th>Status</th>
                <th className="num">Amount</th>
                <th className="num">Open</th>
              </tr>
            </thead>
            <tbody>
              {txns.map((t) => (
                <tr key={`${t.type}-${t.id}`}>
                  <td>{shortDate(t.date)}</td>
                  <td style={{ fontWeight: 600 }}>{t.type}</td>
                  <td>
                    <Link to={t.href} style={{ color: 'var(--sea)', fontWeight: 700 }}>
                      {t.number}
                    </Link>
                  </td>
                  <td style={{ color: 'var(--muted)' }}>{t.memo || '—'}</td>
                  <td>
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="num">{money(t.amount)}</td>
                  <td className="num">{t.balance > 0 ? money(t.balance) : '—'}</td>
                </tr>
              ))}
              {txns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty">
                    No transactions yet — create a bill or expense.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 16 }}>
        <div className="panel">
          <div className="panel-head">
            <h2>Contact</h2>
          </div>
          <div className="panel-pad" style={{ lineHeight: 1.7 }}>
            <div>
              <strong>Phone</strong> {vendor.phone || '—'}
            </div>
            <div>
              <strong>Email</strong> {vendor.email || '—'}
            </div>
            <div>
              <strong>Notes</strong> {vendor.notes || '—'}
            </div>
            <div>
              <strong>Vendor since</strong> {shortDate(vendor.createdAt)}
            </div>
          </div>
        </div>
        <div className="panel">
          <div className="panel-head">
            <h2>Purchase orders</h2>
            <Link
              to="/purchase-orders?new=1"
              style={{ color: 'var(--sea)', fontWeight: 600, fontSize: '0.85rem' }}
            >
              New PO
            </Link>
          </div>
          <div className="table-wrap">
            <table className="data data-clickable">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>PO #</th>
                  <th>Status</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {pos.map((po) => (
                  <tr key={po.id}>
                    <td>{shortDate(po.date)}</td>
                    <td>
                      <Link
                        className="linkish"
                        to={`/purchase-orders?open=${po.id}`}
                        style={{ textDecoration: 'none', color: 'var(--sea)', fontWeight: 700 }}
                      >
                        #{po.number}
                      </Link>
                    </td>
                    <td>
                      <StatusBadge status={po.status} />
                    </td>
                    <td className="num">{money(po.total)}</td>
                  </tr>
                ))}
                {pos.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="empty">
                      No POs yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {editOpen ? (
        <Modal
          title="Edit vendor"
          onClose={() => setEditOpen(false)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setEditOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={onSaveEdit} disabled={!name.trim()}>
                Save
              </button>
            </>
          }
        >
          <div className="form-grid two">
            <div className="field">
              <label>Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
            <div className="field">
              <label>Category</label>
              <input value={category} onChange={(e) => setCategory(e.target.value)} />
            </div>
            <div className="field">
              <label>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="field">
              <label>Phone</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div className="field" style={{ marginTop: 14 }}>
            <label>Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
