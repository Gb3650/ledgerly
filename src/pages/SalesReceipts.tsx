import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { invoiceTotals } from '../lib/accounting';
import { stockQty } from '../lib/inventory';
import { money, shortDate, todayISO } from '../lib/format';
import { HubTabs, salesHubTabs } from '../components/HubTabs';
import { Modal } from '../components/Modal';
import { useBooks } from '../store/BooksContext';
import type { SalesReceipt } from '../types';

type LineDraft = { productId: string; description: string; qty: number; rate: number };

export function SalesReceipts() {
  const { state, saveSalesReceipt } = useBooks();
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SalesReceipt | null>(null);
  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('Walk-in customer');
  const [locationId, setLocationId] = useState(state.locations.find((l) => l.isActive)?.id ?? '');
  const [date, setDate] = useState(todayISO());
  const [paymentMethod, setPaymentMethod] = useState('Card');
  const [memo, setMemo] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([
    { productId: '', description: '', qty: 1, rate: 0 },
  ]);

  const list = useMemo(
    () => [...state.salesReceipts].sort((a, b) => b.date.localeCompare(a.date)),
    [state.salesReceipts],
  );
  const totals = invoiceTotals(lines);
  const canSave = customerName.trim() && locationId && lines.some((l) => l.description && l.qty > 0);

  function openNew() {
    setEditing(null);
    setCustomerId('');
    setCustomerName('Walk-in customer');
    setLocationId(state.locations.find((l) => l.isActive)?.id ?? '');
    setDate(todayISO());
    setPaymentMethod('Card');
    setMemo('');
    setLines([{ productId: '', description: '', qty: 1, rate: 0 }]);
    setOpen(true);
  }

  function openEdit(r: SalesReceipt) {
    setEditing(r);
    setCustomerId(r.customerId ?? '');
    setCustomerName(r.customerName);
    setLocationId(r.locationId);
    setDate(r.date);
    setPaymentMethod(r.paymentMethod);
    setMemo(r.memo);
    setLines(
      r.lines.map((l) => ({
        productId: l.productId ?? '',
        description: l.description,
        qty: l.qty,
        rate: l.rate,
      })),
    );
    setOpen(true);
  }

  function onCustomerPick(id: string) {
    setCustomerId(id);
    const c = state.customers.find((x) => x.id === id);
    if (c) setCustomerName(c.name);
  }

  function setProduct(idx: number, productId: string) {
    const product = state.products.find((p) => p.id === productId);
    setLines((prev) =>
      prev.map((l, i) =>
        i === idx
          ? {
              productId,
              description: product?.description || product?.name || l.description,
              qty: l.qty || 1,
              rate: product?.unitPrice ?? l.rate,
            }
          : l,
      ),
    );
  }

  function onSave(allowOversell = false) {
    if (!canSave) return;
    const res = saveSalesReceipt({
      id: editing?.id,
      customerId: customerId || undefined,
      customerName,
      locationId,
      date,
      paymentMethod,
      memo,
      lines: lines.filter((l) => l.description),
      allowOversell,
    });
    if (!res.ok && res.shortages?.length) {
      const names = res.shortages
        .map((s) => {
          const p = state.products.find((x) => x.id === s.productId);
          return `${p?.name ?? s.productId}: need ${s.need}, have ${s.have}`;
        })
        .join('\n');
      if (window.confirm(`Not enough stock:\n${names}\n\nRecord anyway?`)) onSave(true);
      return;
    }
    setOpen(false);
  }

  useEffect(() => {
    if (params.get('new') === '1') {
      openNew();
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  return (
    <div>
      <HubTabs tabs={salesHubTabs} />
      <div className="page-header">
        <div>
          <h1>Sales receipts</h1>
          <p>Cash / card sales that take payment now and pull stock from a location.</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>
          Create sales receipt
        </button>
      </div>

      <div className="panel">
        <div className="table-wrap">
          <table className="data data-clickable">
            <thead>
              <tr>
                <th>Date</th>
                <th>No.</th>
                <th>Customer</th>
                <th>Location</th>
                <th>Method</th>
                <th className="num">Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => {
                const loc = state.locations.find((l) => l.id === r.locationId);
                return (
                  <tr key={r.id} onClick={() => openEdit(r)}>
                    <td>{shortDate(r.date)}</td>
                    <td>
                      <button
                        className="linkish"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(r);
                        }}
                      >
                        #{r.number}
                      </button>
                    </td>
                    <td>{r.customerName}</td>
                    <td>{loc?.code ?? '—'}</td>
                    <td>{r.paymentMethod}</td>
                    <td className="num">{money(r.total)}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(r)}>
                        Open
                      </button>
                    </td>
                  </tr>
                );
              })}
              {list.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty">
                    <div className="empty-cta">
                      <div>No sales receipts yet.</div>
                      <button className="btn btn-primary" onClick={openNew}>
                        Create sales receipt
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
          title={editing ? `Sales receipt #${editing.number}` : 'Sales receipt'}
          onClose={() => setOpen(false)}
          wide
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={() => onSave()} disabled={!canSave}>
                {editing ? 'Save' : 'Save and receive payment'}
              </button>
            </>
          }
        >
          <div className="form-grid two">
            <div className="field">
              <label>Customer (optional)</label>
              <select value={customerId} onChange={(e) => onCustomerPick(e.target.value)}>
                <option value="">Walk-in / custom</option>
                {state.customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Customer name</label>
              <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            </div>
            <div className="field">
              <label>Sell from location</label>
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
              <label>Payment method</label>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                <option>Card</option>
                <option>Cash</option>
                <option>Check</option>
                <option>ACH / Wire</option>
              </select>
            </div>
            <div className="field">
              <label>Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          <div style={{ marginTop: 18 }}>
            <div className="line-items">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '28%' }}>Product</th>
                    <th>Description</th>
                    <th style={{ width: 80 }}>Qty</th>
                    <th style={{ width: 110 }}>Rate</th>
                    <th style={{ width: 110 }} className="num">
                      Amount
                    </th>
                    <th style={{ width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, idx) => (
                    <tr key={idx}>
                      <td>
                        <select
                          value={line.productId}
                          onChange={(e) => setProduct(idx, e.target.value)}
                          style={{ width: '100%', border: 'none', padding: 8 }}
                        >
                          <option value="">Custom</option>
                          {state.products.map((p) => {
                            const locCode =
                              state.locations.find((l) => l.id === locationId)?.code ?? 'loc';
                            return (
                              <option key={p.id} value={p.id}>
                                {p.name}
                                {p.type === 'inventory' && locationId
                                  ? ` (${stockQty(state.stock, p.id, locationId)} @ ${locCode})`
                                  : ''}
                              </option>
                            );
                          })}
                        </select>
                      </td>
                      <td>
                        <input
                          value={line.description}
                          onChange={(e) =>
                            setLines((prev) =>
                              prev.map((l, i) =>
                                i === idx ? { ...l, description: e.target.value } : l,
                              ),
                            )
                          }
                          style={{ width: '100%', border: 'none', padding: 8 }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          value={line.qty}
                          onChange={(e) =>
                            setLines((prev) =>
                              prev.map((l, i) =>
                                i === idx ? { ...l, qty: Number(e.target.value) } : l,
                              ),
                            )
                          }
                          style={{ width: '100%', border: 'none', padding: 8 }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={line.rate}
                          onChange={(e) =>
                            setLines((prev) =>
                              prev.map((l, i) =>
                                i === idx ? { ...l, rate: Number(e.target.value) } : l,
                              ),
                            )
                          }
                          style={{ width: '100%', border: 'none', padding: 8 }}
                        />
                      </td>
                      <td className="num">{money(line.qty * line.rate)}</td>
                      <td>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                          disabled={lines.length === 1}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              className="btn btn-ghost btn-sm"
              style={{ marginTop: 8 }}
              onClick={() =>
                setLines((prev) => [...prev, { productId: '', description: '', qty: 1, rate: 0 }])
              }
            >
              + Line
            </button>
            <div className="doc-totals">
              <div>
                Subtotal <strong>{money(totals.subtotal)}</strong>
              </div>
              <div>
                Tax <strong>{money(totals.tax)}</strong>
              </div>
              <div className="doc-total">
                Total <strong>{money(totals.total)}</strong>
              </div>
            </div>
          </div>
          <div className="field" style={{ marginTop: 14 }}>
            <label>Memo</label>
            <textarea value={memo} onChange={(e) => setMemo(e.target.value)} />
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
