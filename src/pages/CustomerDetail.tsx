import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { money, shortDate } from '../lib/format';
import { HubTabs, salesHubTabs } from '../components/HubTabs';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { useBooks } from '../store/BooksContext';

export function CustomerDetail() {
  const { id } = useParams();
  const { state, updateCustomer } = useBooks();
  const customer = state.customers.find((c) => c.id === id);
  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [notes, setNotes] = useState('');

  if (!customer) {
    return (
      <div>
        <HubTabs tabs={salesHubTabs} />
        <div className="panel panel-pad">
          <p>Customer not found.</p>
          <Link to="/customers">Back to customers</Link>
        </div>
      </div>
    );
  }

  const invoices = state.invoices
    .filter((i) => i.customerId === customer.id)
    .sort((a, b) => b.date.localeCompare(a.date));
  const quotes = (state.quotes ?? [])
    .filter((q) => q.customerId === customer.id)
    .sort((a, b) => b.date.localeCompare(a.date));
  const receipts = (state.salesReceipts ?? [])
    .filter((r) => r.customerId === customer.id || r.customerName === customer.name)
    .sort((a, b) => b.date.localeCompare(a.date));
  const payments = state.payments
    .filter((p) => invoices.some((i) => i.id === p.invoiceId))
    .sort((a, b) => b.date.localeCompare(a.date));

  const txnRows = [
    ...invoices.map((inv) => ({
      id: inv.id,
      date: inv.date,
      type: 'Invoice',
      number: inv.number,
      status: inv.status,
      total: inv.total,
      balance: inv.balance,
      href: `/invoices?open=${inv.id}`,
    })),
    ...quotes.map((q) => ({
      id: q.id,
      date: q.date,
      type: 'Estimate',
      number: q.number,
      status: q.status,
      total: q.total,
      balance: 0,
      href: `/quotes`,
    })),
    ...receipts.map((r) => ({
      id: r.id,
      date: r.date,
      type: 'Sales receipt',
      number: r.number,
      status: 'paid',
      total: r.total,
      balance: 0,
      href: `/sales-receipts`,
    })),
    ...payments.map((p) => {
      const inv = invoices.find((i) => i.id === p.invoiceId);
      return {
        id: p.id,
        date: p.date,
        type: 'Payment',
        number: inv ? `PMT-${inv.number}` : p.id.slice(-6),
        status: 'paid',
        total: p.amount,
        balance: 0,
        href: inv ? `/invoices?open=${inv.id}` : '/receive-payment',
      };
    }),
  ].sort((a, b) => b.date.localeCompare(a.date));

  function openEdit() {
    setName(customer!.name);
    setEmail(customer!.email);
    setPhone(customer!.phone);
    setCompany(customer!.company ?? '');
    setBillingAddress(customer!.billingAddress);
    setNotes(customer!.notes ?? '');
    setEditOpen(true);
  }

  function onSave() {
    if (!name.trim()) return;
    updateCustomer(customer!.id, {
      name,
      email,
      phone,
      company,
      billingAddress,
      notes,
    });
    setEditOpen(false);
  }

  return (
    <div>
      <HubTabs tabs={salesHubTabs} />
      <div className="page-header">
        <div>
          <div style={{ marginBottom: 6 }}>
            <Link
              to="/customers"
              style={{ color: 'var(--sea)', fontWeight: 600, fontSize: '0.85rem' }}
            >
              ← Customers
            </Link>
          </div>
          <h1>{customer.name}</h1>
          <p>
            {customer.company ? `${customer.company} · ` : ''}
            {customer.email || 'No email'} · Open balance {money(customer.balance)}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-ghost" onClick={openEdit}>
            Edit
          </button>
          <Link className="btn btn-ghost" to={`/quotes?new=1`}>
            Estimate
          </Link>
          <Link className="btn btn-ghost" to={`/receive-payment?customer=${customer.id}`}>
            Receive payment
          </Link>
          <Link className="btn btn-primary" to={`/invoices?new=1&customer=${customer.id}`}>
            New invoice
          </Link>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 16 }}>
        <div className="panel">
          <div className="panel-head">
            <h2>Contact</h2>
            <button type="button" className="btn btn-ghost btn-sm" onClick={openEdit}>
              Edit
            </button>
          </div>
          <div className="panel-pad" style={{ lineHeight: 1.7 }}>
            <div>
              <strong>Phone</strong> {customer.phone || '—'}
            </div>
            <div>
              <strong>Email</strong> {customer.email || '—'}
            </div>
            <div>
              <strong>Billing</strong> {customer.billingAddress || '—'}
            </div>
            <div>
              <strong>Notes</strong> {customer.notes || '—'}
            </div>
            <div>
              <strong>Customer since</strong> {shortDate(customer.createdAt)}
            </div>
          </div>
        </div>
        <div className="panel">
          <div className="panel-head">
            <h2>Balances</h2>
          </div>
          <div className="panel-pad">
            <div className="stat" style={{ padding: 0 }}>
              <div className="stat-label">Open balance</div>
              <div className="stat-value" style={{ color: customer.balance > 0 ? 'var(--coral)' : undefined }}>
                {money(customer.balance)}
              </div>
              <div className="stat-hint">
                {invoices.filter((i) => i.balance > 0).length} open invoices · {quotes.length}{' '}
                estimates
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Transaction list</h2>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>No.</th>
                <th>Status</th>
                <th className="num">Total</th>
                <th className="num">Balance</th>
              </tr>
            </thead>
            <tbody>
              {txnRows.map((row) => (
                <tr key={`${row.type}-${row.id}`}>
                  <td>{shortDate(row.date)}</td>
                  <td>{row.type}</td>
                  <td>
                    <Link to={row.href} className="linkish">
                      #{row.number}
                    </Link>
                  </td>
                  <td>
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="num">{money(row.total)}</td>
                  <td className="num">{money(row.balance)}</td>
                </tr>
              ))}
              {txnRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty">
                    No transactions for this customer.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {editOpen ? (
        <Modal
          title="Edit customer"
          onClose={() => setEditOpen(false)}
          footer={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setEditOpen(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={onSave} disabled={!name.trim()}>
                Save
              </button>
            </>
          }
        >
          <div className="form-grid two">
            <div className="field">
              <label>Display name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
            <div className="field">
              <label>Company</label>
              <input value={company} onChange={(e) => setCompany(e.target.value)} />
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
            <label>Billing address</label>
            <textarea value={billingAddress} onChange={(e) => setBillingAddress(e.target.value)} />
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
