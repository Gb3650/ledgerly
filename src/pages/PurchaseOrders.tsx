import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { invoiceTotals } from '../lib/accounting';
import { addDaysISO, money, shortDate, todayISO } from '../lib/format';
import { HubTabs, expensesHubTabs } from '../components/HubTabs';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { useBooks } from '../store/BooksContext';
import type { PoStatus, PurchaseOrder } from '../types';

type LineDraft = {
  productId: string;
  description: string;
  qty: number;
  rate: number;
  qtyReceived: number;
};

export function PurchaseOrders() {
  const { state, savePurchaseOrder, receivePo } = useBooks();
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PurchaseOrder | null>(null);
  const [tab, setTab] = useState<'all' | PoStatus>('all');
  const [query, setQuery] = useState('');

  const [vendorId, setVendorId] = useState(state.vendors[0]?.id ?? '');
  const [locationId, setLocationId] = useState(
    state.locations.find((l) => l.isActive)?.id ?? '',
  );
  const [date, setDate] = useState(todayISO());
  const [expectedDate, setExpectedDate] = useState(addDaysISO(todayISO(), 7));
  const [status, setStatus] = useState<PoStatus>('sent');
  const [memo, setMemo] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([
    { productId: '', description: '', qty: 1, rate: 0, qtyReceived: 0 },
  ]);

  const list = useMemo(() => {
    let rows = [...state.purchaseOrders].sort((a, b) => b.date.localeCompare(a.date));
    if (tab !== 'all') rows = rows.filter((p) => p.status === tab);
    const q = query.trim().toLowerCase();
    if (q) {
      rows = rows.filter((po) => {
        const vendor = state.vendors.find((v) => v.id === po.vendorId);
        return (
          po.number.includes(q) ||
          vendor?.name.toLowerCase().includes(q) ||
          po.memo.toLowerCase().includes(q)
        );
      });
    }
    return rows;
  }, [state.purchaseOrders, state.vendors, tab, query]);

  const draftTotals = invoiceTotals(lines);
  const canSave = vendorId && locationId && lines.some((l) => l.qty > 0 && l.description);
  const locked = editing?.status === 'received' || editing?.status === 'cancelled';

  function setProduct(idx: number, productId: string) {
    const product = state.products.find((p) => p.id === productId);
    setLines((prev) =>
      prev.map((l, i) =>
        i === idx
          ? {
              ...l,
              productId,
              description: product?.name || l.description,
              qty: l.qty || 1,
              rate: product?.cost ?? product?.unitPrice ?? l.rate,
            }
          : l,
      ),
    );
  }

  function openNew() {
    setEditing(null);
    setVendorId(state.vendors[0]?.id ?? '');
    setLocationId(state.locations.find((l) => l.isActive)?.id ?? '');
    setDate(todayISO());
    setExpectedDate(addDaysISO(todayISO(), 7));
    setStatus('sent');
    setMemo('');
    setLines([{ productId: '', description: '', qty: 1, rate: 0, qtyReceived: 0 }]);
    setOpen(true);
  }

  function openEdit(po: PurchaseOrder) {
    setEditing(po);
    setVendorId(po.vendorId);
    setLocationId(po.locationId);
    setDate(po.date);
    setExpectedDate(po.expectedDate);
    setStatus(po.status);
    setMemo(po.memo);
    setLines(
      po.lines.map((l) => ({
        productId: l.productId ?? '',
        description: l.description,
        qty: l.qty,
        rate: l.rate,
        qtyReceived: l.qtyReceived,
      })),
    );
    setOpen(true);
  }

  function onSave(asDraft: boolean) {
    if (!canSave || locked) return;
    savePurchaseOrder({
      id: editing?.id,
      vendorId,
      locationId,
      date,
      expectedDate,
      status: asDraft ? 'draft' : status === 'draft' ? 'sent' : status,
      memo,
      lines: lines
        .filter((l) => l.description && l.qty > 0)
        .map((l) => ({
          productId: l.productId || undefined,
          description: l.description,
          qty: l.qty,
          rate: l.rate,
          qtyReceived: l.qtyReceived,
        })),
    });
    setOpen(false);
  }

  useEffect(() => {
    if (params.get('new') === '1') {
      openNew();
      setParams({}, { replace: true });
    }
    const openId = params.get('open');
    if (openId) {
      const po = state.purchaseOrders.find((p) => p.id === openId || p.number === openId);
      if (po) openEdit(po);
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  return (
    <div>
      <HubTabs tabs={expensesHubTabs} />
      <div className="page-header">
        <div>
          <h1>Purchase orders</h1>
          <p>Create, open, and receive POs into a location — same flow as QuickBooks.</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>
          Create purchase order
        </button>
      </div>

      <div className="list-toolbar">
        <div className="tabs" style={{ marginBottom: 0 }}>
          {(['all', 'draft', 'sent', 'partial', 'received'] as const).map((t) => (
            <button
              key={t}
              className={`tab ${tab === t ? 'active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t === 'all' ? 'All' : t}
            </button>
          ))}
        </div>
        <input
          className="list-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by PO # or vendor"
          aria-label="Filter purchase orders"
        />
      </div>

      <div className="panel">
        <div className="table-wrap">
          <table className="data data-clickable">
            <thead>
              <tr>
                <th>Date</th>
                <th>No.</th>
                <th>Vendor</th>
                <th>Ship to</th>
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
                  <tr key={po.id} onClick={() => openEdit(po)}>
                    <td>{shortDate(po.date)}</td>
                    <td style={{ fontWeight: 700 }}>
                      <button
                        className="linkish"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(po);
                        }}
                      >
                        #{po.number}
                      </button>
                    </td>
                    <td>
                      <Link
                        to={`/vendors/${po.vendorId}`}
                        onClick={(e) => e.stopPropagation()}
                        style={{ color: 'var(--sea)', fontWeight: 600 }}
                      >
                        {vendor?.name}
                      </Link>
                    </td>
                    <td>{loc?.name ?? loc?.code ?? '—'}</td>
                    <td>{shortDate(po.expectedDate)}</td>
                    <td>
                      <StatusBadge status={po.status} />
                    </td>
                    <td className="num">{money(po.total)}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(po)}>
                          Open
                        </button>
                        {po.status === 'sent' || po.status === 'partial' ? (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => receivePo(po.id, true)}
                          >
                            Receive
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {list.length === 0 ? (
                <tr>
                  <td colSpan={8} className="empty">
                    <div className="empty-cta">
                      <div>No purchase orders in this view.</div>
                      <button className="btn btn-primary" onClick={openNew}>
                        Create purchase order
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
          title={editing ? `Purchase order #${editing.number}` : 'Purchase order'}
          onClose={() => setOpen(false)}
          wide
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setOpen(false)}>
                Close
              </button>
              {editing && (editing.status === 'sent' || editing.status === 'partial') ? (
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    receivePo(editing.id, true);
                    setOpen(false);
                  }}
                >
                  Receive all
                </button>
              ) : null}
              {!locked ? (
                <>
                  <button className="btn btn-ghost" onClick={() => onSave(true)} disabled={!canSave}>
                    Save draft
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={() => onSave(false)}
                    disabled={!canSave}
                  >
                    {editing ? 'Save' : 'Save and send'}
                  </button>
                </>
              ) : null}
            </>
          }
        >
          {locked ? (
            <div className="info-banner" style={{ marginBottom: 14 }}>
              This PO is <strong>{editing?.status}</strong> and is view-only. Open a new PO to order
              more stock.
            </div>
          ) : null}

          <div className="form-grid two">
            <div className="field">
              <label>Vendor</label>
              <select
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
                disabled={locked}
              >
                {state.vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Ship to / receive into</label>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                disabled={locked}
              >
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
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={locked}
              />
            </div>
            <div className="field">
              <label>Expected date</label>
              <input
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
                disabled={locked}
              />
            </div>
            <div className="field">
              <label>Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as PoStatus)}
                disabled={locked}
              >
                <option value="draft">Draft</option>
                <option value="sent">Open / Sent</option>
                <option value="partial">Partially received</option>
                <option value="received">Received</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div style={{ marginTop: 18 }}>
            <div className="line-items">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '24%' }}>Product</th>
                    <th>Description</th>
                    <th style={{ width: 72 }}>Qty</th>
                    <th style={{ width: 72 }}>Rcv&apos;d</th>
                    <th style={{ width: 100 }}>Rate</th>
                    <th style={{ width: 100 }} className="num">
                      Amount
                    </th>
                    <th style={{ width: 36 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, idx) => (
                    <tr key={idx}>
                      <td>
                        <select
                          value={line.productId}
                          onChange={(e) => setProduct(idx, e.target.value)}
                          disabled={locked}
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
                          disabled={locked}
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
                          disabled={locked}
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
                          max={line.qty}
                          value={line.qtyReceived}
                          disabled={locked}
                          onChange={(e) =>
                            setLines((prev) =>
                              prev.map((l, i) =>
                                i === idx
                                  ? { ...l, qtyReceived: Number(e.target.value) }
                                  : l,
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
                          disabled={locked}
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
                        {!locked ? (
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                            disabled={lines.length === 1}
                          >
                            ×
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!locked ? (
              <button
                className="btn btn-ghost btn-sm"
                style={{ marginTop: 8 }}
                onClick={() =>
                  setLines((prev) => [
                    ...prev,
                    { productId: '', description: '', qty: 1, rate: 0, qtyReceived: 0 },
                  ])
                }
              >
                + Line
              </button>
            ) : null}
            <div className="doc-totals">
              <div>
                Subtotal <strong>{money(draftTotals.subtotal)}</strong>
              </div>
              <div>
                Tax <strong>{money(draftTotals.tax)}</strong>
              </div>
              <div className="doc-total">
                Total <strong>{money(draftTotals.total)}</strong>
              </div>
            </div>
          </div>

          <div className="field" style={{ marginTop: 14 }}>
            <label>Memo / message on PO</label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              disabled={locked}
            />
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
