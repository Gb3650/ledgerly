import { useState } from 'react';
import { money } from '../lib/format';
import { Modal } from '../components/Modal';
import { useBooks } from '../store/BooksContext';
import type { Product } from '../types';

function marginPct(sale: number, cost: number) {
  if (sale <= 0) return null;
  return Math.round(((sale - cost) / sale) * 1000) / 10;
}

export function Products() {
  const { state, addProduct } = useBooks();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sku, setSku] = useState('');
  const [unitPrice, setUnitPrice] = useState(0);
  const [cost, setCost] = useState(0);
  const [type, setType] = useState<Product['type']>('service');
  const [incomeAccountId, setIncomeAccountId] = useState('acc_services');

  const incomeAccounts = state.accounts.filter((a) => a.type === 'income');

  function onSave() {
    if (!name.trim()) return;
    addProduct({
      name,
      description,
      sku,
      unitPrice,
      cost,
      type,
      incomeAccountId,
      qtyOnHand: 0,
      reorderPoint: type === 'inventory' ? 5 : undefined,
    });
    setOpen(false);
    setName('');
    setDescription('');
    setSku('');
    setUnitPrice(0);
    setCost(0);
    setType('service');
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Products &amp; services</h1>
          <p>Each item has a cost (what you pay) and a sale price (what you charge).</p>
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
                <th className="num">On hand</th>
                <th className="num">Cost</th>
                <th className="num">Sale price</th>
                <th className="num">Margin</th>
              </tr>
            </thead>
            <tbody>
              {state.products.map((p) => {
                const m = marginPct(p.unitPrice, p.cost ?? 0);
                return (
                  <tr key={p.id}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{p.name}</div>
                      <div style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>
                        {p.description}
                      </div>
                    </td>
                    <td>{p.sku}</td>
                    <td style={{ textTransform: 'capitalize' }}>{p.type.replace('_', ' ')}</td>
                    <td className="num">{p.type === 'inventory' ? p.qtyOnHand : '—'}</td>
                    <td className="num">{money(p.cost ?? 0)}</td>
                    <td className="num">{money(p.unitPrice)}</td>
                    <td className="num">{m == null ? '—' : `${m}%`}</td>
                  </tr>
                );
              })}
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
            <div className="field">
              <label>Cost (what you pay)</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={cost}
                onChange={(e) => setCost(Number(e.target.value))}
              />
            </div>
            <div className="field">
              <label>Sale price (what you charge)</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={unitPrice}
                onChange={(e) => setUnitPrice(Number(e.target.value))}
              />
            </div>
          </div>
          {unitPrice > 0 ? (
            <div style={{ marginTop: 10, color: 'var(--muted)', fontSize: '0.9rem' }}>
              Margin {marginPct(unitPrice, cost)}% · Gross {money(unitPrice - cost)} per unit
            </div>
          ) : null}
          <div className="field" style={{ marginTop: 14 }}>
            <label>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
