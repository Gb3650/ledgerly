import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { money, shortDate } from '../lib/format';
import { HubTabs, salesHubTabs } from '../components/HubTabs';
import { Modal } from '../components/Modal';
import { useBooks } from '../store/BooksContext';
import type { Customer } from '../types';

export function Customers() {
  const { state, addCustomer, updateCustomer } = useBooks();
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (params.get('new') === '1') {
      openNew();
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  function openNew() {
    setEditing(null);
    setName('');
    setEmail('');
    setPhone('');
    setCompany('');
    setBillingAddress('');
    setNotes('');
    setOpen(true);
  }

  function openEdit(c: Customer) {
    setEditing(c);
    setName(c.name);
    setEmail(c.email);
    setPhone(c.phone);
    setCompany(c.company ?? '');
    setBillingAddress(c.billingAddress);
    setNotes(c.notes ?? '');
    setOpen(true);
  }

  function onSave() {
    if (!name.trim()) return;
    if (editing) {
      updateCustomer(editing.id, {
        name,
        email,
        phone,
        company,
        billingAddress,
        notes,
      });
    } else {
      addCustomer({ name, email, phone, company, billingAddress, notes });
    }
    setOpen(false);
  }

  const sorted = useMemo(() => {
    let list = [...state.customers].sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name));
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.company?.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q),
      );
    }
    return list;
  }, [state.customers, query]);

  const openBalanceTotal = state.customers.reduce((s, c) => s + c.balance, 0);

  return (
    <div>
      <HubTabs tabs={salesHubTabs} />
      <div className="page-header">
        <div>
          <h1>Customers</h1>
          <p>
            Customer center — {state.customers.length} customers ·{' '}
            {money(openBalanceTotal)} open balance
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openNew}>
          New customer
        </button>
      </div>

      <div className="list-toolbar">
        <input
          className="list-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, company, email, phone"
          aria-label="Filter customers"
        />
      </div>

      <div className="panel">
        <div className="table-wrap">
          <table className="data data-clickable">
            <thead>
              <tr>
                <th>Customer / Company</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Since</th>
                <th className="num">Open balance</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((c) => (
                <tr key={c.id} onClick={() => openEdit(c)}>
                  <td>
                    <Link
                      to={`/customers/${c.id}`}
                      className="linkish"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {c.name}
                    </Link>
                    {c.company ? (
                      <div style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>{c.company}</div>
                    ) : null}
                  </td>
                  <td>{c.phone || '—'}</td>
                  <td>{c.email || '—'}</td>
                  <td>{shortDate(c.createdAt)}</td>
                  <td className="num" style={{ color: c.balance > 0 ? 'var(--coral)' : undefined }}>
                    {money(c.balance)}
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      <Link className="btn btn-ghost btn-sm" to={`/customers/${c.id}`}>
                        Open
                      </Link>
                      <Link
                        className="btn btn-ghost btn-sm"
                        to={`/receive-payment?customer=${c.id}`}
                      >
                        Receive payment
                      </Link>
                      <Link
                        className="btn btn-primary btn-sm"
                        to={`/invoices?new=1&customer=${c.id}`}
                      >
                        Invoice
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty">
                    <div className="empty-cta">
                      <div>No customers match.</div>
                      <button type="button" className="btn btn-primary" onClick={openNew}>
                        New customer
                      </button>
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {open ? (
        <Modal
          title={editing ? 'Edit customer' : 'New customer'}
          onClose={() => setOpen(false)}
          footer={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
              {editing ? (
                <Link className="btn btn-ghost" to={`/customers/${editing.id}`} onClick={() => setOpen(false)}>
                  Customer page
                </Link>
              ) : null}
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
            <textarea
              value={billingAddress}
              onChange={(e) => setBillingAddress(e.target.value)}
            />
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
