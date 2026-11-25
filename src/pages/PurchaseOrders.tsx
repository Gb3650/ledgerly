import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { invoiceTotals } from '../lib/accounting';
import { addDaysISO, money, shortDate, todayISO } from '../lib/format';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { useBooks } from '../store/BooksContext';

type LineDraft = { productId: string; description: string; qty: number; rate: number };

export function PurchaseOrders() {
  const { state, savePurchaseOrder, receivePo } = useBooks();
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [vendorId, setVendorId] = useState(state.vendors[0]?.id ?? '');
  const [locationId, setLocationId] = useState(
    state.locations.find((l) => l.isActive)?.id ?? '',
  );
  const [date, setDate] = useState(todayISO());
  const [expectedDate, setExpectedDate] = useState(addDaysISO(todayISO(), 7));
  const [memo, setMemo] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([
    { productId: '', description: '', qty: 1, rate: 0 },
  ]);

  const list = useMemo(
    () => [...state.purchaseOrders].sort((a, b) => b.date.localeCompare(a.date)),
    [state.purchaseOrders],
  );

  const draftTotals = invoiceTotals(lines);
  const canSave = vendorId && locationId && lines.some((l) => l.qty > 0 && l.rate >= 0);

  function setProduct(idx: number, productId: string) {
    const product = state.products.find((p) => p.id === productId);
    setLines((prev) =>
      prev.map((l, i) =>
        i === idx
          ? {
              productId,
              description: product?.name || l.description,
              qty: l.qty || 1,
              rate: product?.cost ?? product?.unitPrice ?? l.rate,
            }
          : l,
      ),
    );
  }

  function onSave(asDraft: boolean) {
    if (!canSave) return;
    savePurchaseOrder({
      vendorId,
      locationId,
      date,
      expectedDate,
      status: asDraft ? 'draft' : 'sent',
      memo,
      lines: lines.filter((l) => l.qty > 0),
    });
    setOpen(false);
  }

  function openNew() {
    setVendorId(state.vendors[0]?.id ?? '');
    setLocationId(state.locations.find((l) => l.isActive)?.id ?? '');
    setDate(todayISO());
    setExpectedDate(addDaysISO(todayISO(), 7));
    setMemo('');
    setLines([{ productId: '', description: '', qty: 1, rate: 0 }]);
    setOpen(true);
  }

  useEffect(() => {
    if (params.get('new') === '1') {
      openNew();
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Purchase orders</h1>
          <p>Order stock into a location, then receive to update inventory.</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>
          New PO
        </button>
      </div>

      <div className="panel">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Date</th>
                <th>PO #</th>
                <th>Vendor</th>
                <th>Location</th>
                <th>Expected</th>
                <th>Status</th>
                <th className="num">Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((po) => {
                const vendor = state.vendors.find((v) => v.id === po.vendorId);
                const loc = state.locations.find((l) => l.id === po.locationId);
                return (
                  <tr key={po.id}>
                    <td>{shortDate(po.date)}</td>
                    <td style={{ fontWeight: 700 }}>#{po.number}</td>
                    <td>{vendor?.name}</td>
                    <td>{loc?.code ?? '—'}</td>
                    <td>{shortDate(po.expectedDate)}</td>
                    <td>
                      <StatusBadge status={po.status} />
                    </td>
                    <td className="num">{money(po.total)}</td>
                    <td>
                      {po.status === 'sent' || po.status === 'partial' ? (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => receivePo(po.id, true)}
                        >
                          Receive all
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
              {list.length === 0 ? (
                <tr>
                  <td colSpan={8} className="empty">
                    No purchase orders yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {open ? (
        <Modal
          title="New purchase order"
          onClose={() => setOpen(false)}
          wide
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-ghost" onClick={() => onSave(true)} disabled={!canSave}>
                Save draft
              </button>
              <button className="btn btn-primary" onClick={() => onSave(false)} disabled={!canSave}>
                Save &amp; send
              </button>
            </>
          }
        >
          <div className="form-grid two">
            <div className="field">
              <label>Vendor</label>
              <select value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
                {state.vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Receive into location</label>
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
              <label>PO date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="field">
              <label>Expected</label>
              <input
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
              />
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
                          {state.products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
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
            <div style={{ textAlign: 'right', marginTop: 12, fontWeight: 700 }}>
              Total {money(draftTotals.total)}
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
