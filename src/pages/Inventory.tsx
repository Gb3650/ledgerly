import { useMemo, useState } from 'react';
import { inventoryMatrix } from '../lib/inventory';
import { shortDate } from '../lib/format';
import { Modal } from '../components/Modal';
import { useBooks } from '../store/BooksContext';

export function Inventory() {
  const { state, addLocation, transferStock, adjustInventory } = useBooks();
  const locations = state.locations.filter((l) => l.isActive);
  const rows = useMemo(() => inventoryMatrix(state), [state]);
  const movements = useMemo(
    () => [...(state.stockMovements ?? [])].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 40),
    [state.stockMovements],
  );

  const [locOpen, setLocOpen] = useState(false);
  const [adjOpen, setAdjOpen] = useState(false);
  const [adjLoc, setAdjLoc] = useState(locations[0]?.id ?? '');
  const [adjProduct, setAdjProduct] = useState(
    state.products.find((p) => p.type === 'inventory')?.id ?? '',
  );
  const [adjDelta, setAdjDelta] = useState(1);
  const [adjMemo, setAdjMemo] = useState('Cycle count');
  const [adjError, setAdjError] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [st, setSt] = useState('');
  const [zip, setZip] = useState('');

  const [xferOpen, setXferOpen] = useState(false);
  const [fromId, setFromId] = useState(locations[0]?.id ?? '');
  const [toId, setToId] = useState(locations[1]?.id ?? locations[0]?.id ?? '');
  const [productId, setProductId] = useState(
    state.products.find((p) => p.type === 'inventory')?.id ?? '',
  );
  const [qty, setQty] = useState(1);
  const [memo, setMemo] = useState('');
  const [xferError, setXferError] = useState('');

  function saveLocation() {
    if (!name.trim() || !code.trim()) return;
    addLocation({
      name: name.trim(),
      code: code.trim().toUpperCase(),
      address,
      city,
      state: st,
      zip,
      isActive: true,
    });
    setLocOpen(false);
    setName('');
    setCode('');
    setAddress('');
    setCity('');
    setSt('');
    setZip('');
  }

  function doTransfer() {
    const ok = transferStock({
      fromLocationId: fromId,
      toLocationId: toId,
      productId,
      qty,
      memo,
    });
    if (!ok) {
      setXferError('Not enough stock at the from location, or invalid transfer.');
      return;
    }
    setXferOpen(false);
    setXferError('');
    setQty(1);
    setMemo('');
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Inventory by location</h1>
          <p>Stock levels across ABC LLC physical sites — transfer or receive via POs.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost" onClick={() => setLocOpen(true)}>
            Add location
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => {
              setAdjError('');
              setAdjOpen(true);
            }}
          >
            Adjust qty
          </button>
          <button className="btn btn-primary" onClick={() => setXferOpen(true)}>
            Transfer stock
          </button>
        </div>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 16 }}>
        {locations.map((l) => (
          <div className="panel bank-card" key={l.id}>
            <h3>{l.name}</h3>
            <div style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>
              {l.code} · {l.city}, {l.state}
            </div>
            <div className="bank-bal" style={{ fontSize: '1rem' }}>
              {l.address || 'No street address'}
            </div>
          </div>
        ))}
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head">
          <h2>On-hand by site</h2>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Product</th>
                {locations.map((l) => (
                  <th key={l.id} className="num">
                    {l.code}
                  </th>
                ))}
                <th className="num">Total</th>
                <th className="num">Reorder</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.product.id}>
                  <td>{r.product.sku}</td>
                  <td style={{ fontWeight: 600 }}>{r.product.name}</td>
                  {locations.map((l) => (
                    <td key={l.id} className="num">
                      {r.byLocation[l.id] ?? 0}
                    </td>
                  ))}
                  <td className="num" style={{ fontWeight: 700 }}>
                    {r.total}
                  </td>
                  <td
                    className="num"
                    style={{
                      color:
                        r.product.reorderPoint != null && r.total <= r.product.reorderPoint
                          ? 'var(--coral)'
                          : undefined,
                    }}
                  >
                    {r.product.reorderPoint ?? '—'}
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4 + locations.length} className="empty">
                    No inventory products yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Stock movement</h2>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Date</th>
                <th>Product</th>
                <th>Location</th>
                <th>Reason</th>
                <th className="num">Qty Δ</th>
                <th>Memo</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => {
                const product = state.products.find((p) => p.id === m.productId);
                const loc = state.locations.find((l) => l.id === m.locationId);
                return (
                  <tr key={m.id}>
                    <td>{shortDate(m.date)}</td>
                    <td>{product?.name}</td>
                    <td>{loc?.code}</td>
                    <td style={{ textTransform: 'capitalize' }}>
                      {m.reason.replace(/_/g, ' ')}
                    </td>
                    <td
                      className="num"
                      style={{ color: m.qtyDelta < 0 ? 'var(--coral)' : 'var(--sea)' }}
                    >
                      {m.qtyDelta > 0 ? `+${m.qtyDelta}` : m.qtyDelta}
                    </td>
                    <td>{m.memo || '—'}</td>
                  </tr>
                );
              })}
              {movements.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty">
                    No stock movements yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {adjOpen ? (
        <Modal
          title="Adjust inventory"
          onClose={() => setAdjOpen(false)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setAdjOpen(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  const ok = adjustInventory({
                    locationId: adjLoc,
                    productId: adjProduct,
                    qtyDelta: adjDelta,
                    memo: adjMemo,
                  });
                  if (!ok) {
                    setAdjError('Adjustment failed — check qty available for decreases.');
                    return;
                  }
                  setAdjOpen(false);
                }}
                disabled={!adjDelta}
              >
                Apply adjustment
              </button>
            </>
          }
        >
          {adjError ? (
            <div style={{ color: 'var(--coral)', marginBottom: 12, fontWeight: 600 }}>
              {adjError}
            </div>
          ) : null}
          <p style={{ marginTop: 0, color: 'var(--muted)' }}>
            Use positive qty to add stock (receiving / count up), negative to remove (shrink /
            count down).
          </p>
          <div className="form-grid two">
            <div className="field">
              <label>Location</label>
              <select value={adjLoc} onChange={(e) => setAdjLoc(e.target.value)}>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Product</label>
              <select value={adjProduct} onChange={(e) => setAdjProduct(e.target.value)}>
                {state.products
                  .filter((p) => p.type === 'inventory')
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="field">
              <label>Qty change</label>
              <input
                type="number"
                value={adjDelta}
                onChange={(e) => setAdjDelta(Number(e.target.value))}
              />
            </div>
            <div className="field">
              <label>Memo</label>
              <input value={adjMemo} onChange={(e) => setAdjMemo(e.target.value)} />
            </div>
          </div>
        </Modal>
      ) : null}

      {locOpen ? (
        <Modal
          title="Add location"
          onClose={() => setLocOpen(false)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setLocOpen(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={saveLocation}
                disabled={!name.trim() || !code.trim()}
              >
                Save location
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
              <label>Code</label>
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="MAIN" />
            </div>
            <div className="field">
              <label>Address</label>
              <input value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div className="field">
              <label>City</label>
              <input value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div className="field">
              <label>State</label>
              <input value={st} onChange={(e) => setSt(e.target.value)} />
            </div>
            <div className="field">
              <label>ZIP</label>
              <input value={zip} onChange={(e) => setZip(e.target.value)} />
            </div>
          </div>
        </Modal>
      ) : null}

      {xferOpen ? (
        <Modal
          title="Transfer stock"
          onClose={() => setXferOpen(false)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setXferOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={doTransfer} disabled={qty < 1}>
                Transfer
              </button>
            </>
          }
        >
          {xferError ? (
            <div style={{ color: 'var(--coral)', marginBottom: 12, fontWeight: 600 }}>
              {xferError}
            </div>
          ) : null}
          <div className="form-grid two">
            <div className="field">
              <label>From</label>
              <select value={fromId} onChange={(e) => setFromId(e.target.value)}>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>To</label>
              <select value={toId} onChange={(e) => setToId(e.target.value)}>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Product</label>
              <select value={productId} onChange={(e) => setProductId(e.target.value)}>
                {state.products
                  .filter((p) => p.type === 'inventory')
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="field">
              <label>Qty</label>
              <input
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(Number(e.target.value))}
              />
            </div>
          </div>
          <div className="field" style={{ marginTop: 14 }}>
            <label>Memo</label>
            <input value={memo} onChange={(e) => setMemo(e.target.value)} />
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
