import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { money, shortDate } from '../lib/format';
import { HubTabs, expensesHubTabs } from '../components/HubTabs';
import { Modal } from '../components/Modal';
import { useBooks } from '../store/BooksContext';

export function Vendors() {
  const { state, addVendor } = useBooks();
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState('General');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (params.get('new') === '1') {
      setOpen(true);
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [...state.vendors].sort((a, b) => a.name.localeCompare(b.name));
    if (!q) return list;
    return list.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        v.email.toLowerCase().includes(q) ||
        v.category.toLowerCase().includes(q) ||
        v.phone.toLowerCase().includes(q),
    );
  }, [state.vendors, query]);

  const openBalance = state.vendors.reduce((s, v) => s + (v.balance > 0 ? v.balance : 0), 0);

  function onSave() {
    if (!name.trim()) return;
    addVendor({ name, email, phone, category, notes: notes || undefined });
    setOpen(false);
    setName('');
    setEmail('');
    setPhone('');
    setCategory('General');
    setNotes('');
  }

  return (
    <div>
      <HubTabs tabs={expensesHubTabs} />
      <div className="page-header">
        <div>
          <h1>Vendors</h1>
          <p>Companies and people you pay — open balances from unpaid bills.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link className="btn btn-ghost" to="/bills?new=1">
            New bill
          </Link>
          <button className="btn btn-primary" onClick={() => setOpen(true)}>
            New vendor
          </button>
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
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search vendors…"
          aria-label="Search vendors"
          style={{ minWidth: 220, maxWidth: 320 }}
        />
        <div style={{ marginLeft: 'auto', color: 'var(--muted)', fontSize: '0.9rem' }}>
          Open balance across vendors{' '}
          <strong style={{ color: 'var(--ink)' }}>{money(openBalance)}</strong>
        </div>
      </div>

      <div className="panel">
        <div className="table-wrap">
          <table className="data data-clickable">
            <thead>
              <tr>
                <th>Vendor / Company</th>
                <th>Category</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Since</th>
                <th className="num">Open balance</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((v) => (
                <tr key={v.id}>
                  <td style={{ fontWeight: 700 }}>
                    <Link to={`/vendors/${v.id}`} style={{ color: 'var(--sea)' }}>
                      {v.name}
                    </Link>
                  </td>
                  <td>{v.category}</td>
                  <td>{v.phone || '—'}</td>
                  <td>{v.email || '—'}</td>
                  <td>{shortDate(v.createdAt)}</td>
                  <td className="num" style={{ fontWeight: v.balance > 0 ? 700 : 400 }}>
                    {money(v.balance)}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <Link
                        className="btn btn-ghost btn-sm"
                        to={`/expenses?new=1&vendor=${v.id}`}
                      >
                        Expense
                      </Link>
                      <Link className="btn btn-primary btn-sm" to={`/bills?new=1&vendor=${v.id}`}>
                        Bill
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty">
                    No vendors match — add a vendor to start billing.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {open ? (
        <Modal
          title="Vendor"
          onClose={() => setOpen(false)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={onSave} disabled={!name.trim()}>
                Save
              </button>
            </>
          }
        >
          <div className="form-grid two">
            <div className="field">
              <label>Company / Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
            <div className="field">
              <label>Category / Display name as</label>
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
