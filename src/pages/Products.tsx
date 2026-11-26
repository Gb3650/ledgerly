import { useState } from 'react';
import { money } from '../lib/format';
import { HubTabs, salesHubTabs } from '../components/HubTabs';
import { Modal } from '../components/Modal';
import { useBooks } from '../store/BooksContext';
import type { Product } from '../types';

function marginPct(sale: number, cost: number) {
  if (sale <= 0) return null;
  return Math.round(((sale - cost) / sale) * 1000) / 10;
}

export function Products() {
  const { state, addProduct, updateProduct } = useBooks();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sku, setSku] = useState('');
  const [unitPrice, setUnitPrice] = useState(0);
  const [cost, setCost] = useState(0);
  const [type, setType] = useState<Product['type']>('service');
  const [incomeAccountId, setIncomeAccountId] = useState('acc_services');
  const [reorderPoint, setReorderPoint] = useState(5);

  const incomeAccounts = state.accounts.filter((a) => a.type === 'income');

  function openNew() {
    setEditing(null);
    setName('');
    setDescription('');
    setSku('');
    setUnitPrice(0);
    setCost(0);
    setType('service');
    setIncomeAccountId('acc_services');
    setReorderPoint(5);
    setOpen(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setName(p.name);
    setDescription(p.description);
    setSku(p.sku);
    setUnitPrice(p.unitPrice);
    setCost(p.cost ?? 0);
    setType(p.type);
    setIncomeAccountId(p.incomeAccountId);
    setReorderPoint(p.reorderPoint ?? 5);
    setOpen(true);
  }

  function onSave() {
    if (!name.trim()) return;
    if (editing) {
      updateProduct(editing.id, {
        name,
        description,
        sku,
        unitPrice,
        cost,
        type,
        incomeAccountId,
        reorderPoint: type === 'inventory' ? reorderPoint : undefined,
      });
    } else {
      addProduct({
        name,
        description,
        sku,
        unitPrice,
        cost,
        type,
        incomeAccountId,
        qtyOnHand: 0,
        reorderPoint: type === 'inventory' ? reorderPoint : undefined,
      });
    }
    setOpen(false);
  }

  return (
    <div>
      <HubTabs tabs={salesHubTabs} />
      <div className="page-header">
        <div>
          <h1>Products &amp; services</h1>
          <p>Each item has a cost (what you pay) and a sale price (what you charge).</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>
          Add product/service
        </button>
      </div>

      <div className="panel">
        <div className="table-wrap">
          <table className="data data-clickable">
            <thead>
              <tr>
                <th>Name</th>
                <th>SKU</th>
                <th>Type</th>
                <th className="num">On hand</th>
                <th className="num">Cost</th>
                <th className="num">Sale price</th>
                <th className="num">Margin</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {state.products.map((p) => {
                const m = marginPct(p.unitPrice, p.cost ?? 0);
                return (
                  <tr key={p.id} onClick={() => openEdit(p)}>
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
                    <td onClick={(e) => e.stopPropagation()}>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)}>
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {open ? (
        <Modal
          title={editing ? 'Edit product/service' : 'New product/service'}
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
            {type === 'inventory' ? (
              <div className="field">
                <label>Reorder point</label>
                <input
                  type="number"
                  min={0}
                  value={reorderPoint}
                  onChange={(e) => setReorderPoint(Number(e.target.value))}
                />
              </div>
            ) : null}
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
