import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { money, shortDate } from '../lib/format';
import { Modal } from '../components/Modal';
import { useBooks } from '../store/BooksContext';

export function Customers() {
  const { state, addCustomer } = useBooks();
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [billingAddress, setBillingAddress] = useState('');

  useEffect(() => {
    if (params.get('new') === '1') {
      setOpen(true);
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  function onSave() {
    if (!name.trim()) return;
    addCustomer({ name, email, phone, company, billingAddress });
    setOpen(false);
    setName('');
    setEmail('');
    setPhone('');
    setCompany('');
    setBillingAddress('');
  }

  const sorted = [...state.customers].sort((a, b) => b.balance - a.balance);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Customers</h1>
          <p>Who you bill — with open balances at a glance.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setOpen(true)}>
          Add customer
        </button>
      </div>

      <div className="panel">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Name</th>
                <th>Company</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Since</th>
                <th className="num">Open balance</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 700 }}>{c.name}</td>
                  <td>{c.company || '—'}</td>
                  <td>{c.email}</td>
                  <td>{c.phone}</td>
                  <td>{shortDate(c.createdAt)}</td>
                  <td className="num" style={{ color: c.balance > 0 ? 'var(--coral)' : undefined }}>
                    {money(c.balance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {open ? (
        <Modal
          title="New customer"
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
        </Modal>
      ) : null}
    </div>
  );
}
