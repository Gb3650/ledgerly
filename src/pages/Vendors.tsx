import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { money, shortDate } from '../lib/format';
import { Modal } from '../components/Modal';
import { useBooks } from '../store/BooksContext';

export function Vendors() {
  const { state, addVendor } = useBooks();
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState('General');

  useEffect(() => {
    if (params.get('new') === '1') {
      setOpen(true);
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  function onSave() {
    if (!name.trim()) return;
    addVendor({ name, email, phone, category });
    setOpen(false);
    setName('');
    setEmail('');
    setPhone('');
    setCategory('General');
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Vendors</h1>
          <p>People and companies you pay.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setOpen(true)}>
          Add vendor
        </button>
      </div>

      <div className="panel">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Since</th>
                <th className="num">Balance</th>
              </tr>
            </thead>
            <tbody>
              {state.vendors.map((v) => (
                <tr key={v.id}>
                  <td style={{ fontWeight: 700 }}>
                    <Link to={`/vendors/${v.id}`} style={{ color: 'var(--sea)' }}>
                      {v.name}
                    </Link>
                  </td>
                  <td>{v.category}</td>
                  <td>{v.email}</td>
                  <td>{v.phone}</td>
                  <td>{shortDate(v.createdAt)}</td>
                  <td className="num">{money(v.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {open ? (
        <Modal
          title="New vendor"
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
        </Modal>
      ) : null}
    </div>
  );
}
