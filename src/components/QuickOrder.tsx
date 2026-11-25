import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBooks } from '../store/BooksContext';

/** Fast path: customer ordered product → create invoice (optionally mark sent). */
export function QuickOrder() {
  const { state, quickInvoice } = useBooks();
  const navigate = useNavigate();
  const [customerId, setCustomerId] = useState(state.customers[0]?.id ?? '');
  const [productId, setProductId] = useState(state.products[0]?.id ?? '');
  const [locationId, setLocationId] = useState(
    state.locations.find((l) => l.isActive)?.id ?? '',
  );
  const [qty, setQty] = useState(1);
  const [send, setSend] = useState(true);

  function create() {
    if (!customerId || !productId || qty < 1) return;
    const id = quickInvoice({ customerId, productId, qty, locationId, send });
    if (id) navigate('/invoices');
  }

  return (
    <div className="panel" style={{ marginBottom: 16 }}>
      <div className="panel-head">
        <h2>Quick order → invoice</h2>
      </div>
      <div className="panel-pad">
        <div className="form-grid two">
          <div className="field">
            <label>Customer</label>
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              {state.customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.company ? ` — ${c.company}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Product / service</label>
            <select value={productId} onChange={(e) => setProductId(e.target.value)}>
              {state.products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Fulfill from location</label>
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
              {state.locations
                .filter((l) => l.isActive)
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.code})
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
        <div
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            marginTop: 14,
            flexWrap: 'wrap',
          }}
        >
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.9rem' }}>
            <input type="checkbox" checked={send} onChange={(e) => setSend(e.target.checked)} />
            Mark as sent (deducts inventory at location)
          </label>
          <button className="btn btn-primary" onClick={create}>
            Create invoice
          </button>
          <span style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>
            To email it: open the invoice → Email, or ask Grok/this agent to send it via Gmail.
          </span>
        </div>
      </div>
    </div>
  );
}
