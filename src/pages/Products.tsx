import { useState } from 'react';
import { money } from '../lib/format';
import { Modal } from '../components/Modal';
import { useBooks } from '../store/BooksContext';
import type { Product } from '../types';

export function Products() {
  const { state, addProduct } = useBooks();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sku, setSku] = useState('');
  const [unitPrice, setUnitPrice] = useState(0);
  const [type, setType] = useState<Product['type']>('service');
  const [incomeAccountId, setIncomeAccountId] = useState('acc_services');

  const incomeAccounts = state.accounts.filter((a) => a.type === 'income');

  function onSave() {
    if (!name.trim()) return;
    addProduct({ name, description, sku, unitPrice, type, incomeAccountId });
    setOpen(false);
    setName('');
    setDescription('');
    setSku('');
    setUnitPrice(0);
    setType('service');
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Products &amp; services</h1>
          <p>Items you sell on invoices.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setOpen(true)}>
          Add product/service
        </button>
      </div>

      <div className="panel">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Name</th>
                <th>SKU</th>
                <th>Type</th>
                <th>Income account</th>
                <th className="num">Price</th>
              </tr>
            </thead>
            <tbody>
              {state.products.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div style={{ fontWeight: 700 }}>{p.name}</div>
                    <div style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>{p.description}</div>
                  </td>
                  <td>{p.sku}</td>
                  <td style={{ textTransform: 'capitalize' }}>{p.type.replace('_', ' ')}</td>
                  <td>{state.accounts.find((a) => a.id === p.incomeAccountId)?.name}</td>
                  <td className="num">{money(p.unitPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {open ? (
        <Modal
          title="New product/service"
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
              <label>SKU</label>
              <input value={sku} onChange={(e) => setSku(e.target.value)} />
            </div>
            <div className="field">
              <label>Type</label>
              <select value={type} onChange={(e) => setType(e.target.value as Product['type'])}>
                <option value="service">Service</option>
                <option value="non_inventory">Non-inventory</option>
                <option value="inventory">Inventory</option>
              </select>
            </div>
            <div className="field">
              <label>Sales price</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={unitPrice}
                onChange={(e) => setUnitPrice(Number(e.target.value))}
              />
            </div>
            <div className="field">
              <label>Income account</label>
              <select
                value={incomeAccountId}
                onChange={(e) => setIncomeAccountId(e.target.value)}
              >
                {incomeAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field" style={{ marginTop: 14 }}>
            <label>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
