import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { invoiceTotals } from '../lib/accounting';
import { addDaysISO, money, shortDate, todayISO } from '../lib/format';
import { HubTabs, salesHubTabs } from '../components/HubTabs';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { useBooks } from '../store/BooksContext';
import type { Quote } from '../types';

type LineDraft = { productId: string; description: string; qty: number; rate: number };

export function Quotes() {
  const { state, saveQuote, convertQuoteToInvoice, setQuoteStatus } = useBooks();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Quote | null>(null);
  const [tab, setTab] = useState<'all' | Quote['status']>('all');
  const [query, setQuery] = useState('');
  const [customerId, setCustomerId] = useState(state.customers[0]?.id ?? '');
  const [locationId, setLocationId] = useState(state.locations.find((l) => l.isActive)?.id ?? '');
  const [date, setDate] = useState(todayISO());
  const [expiryDate, setExpiryDate] = useState(addDaysISO(todayISO(), 30));
  const [message, setMessage] = useState('Thanks for considering ABC LLC.');
  const [lines, setLines] = useState<LineDraft[]>([
    { productId: '', description: '', qty: 1, rate: 0 },
  ]);

  const list = useMemo(() => {
    let rows = [...state.quotes].sort((a, b) => b.date.localeCompare(a.date));
    if (tab !== 'all') rows = rows.filter((q) => q.status === tab);
    const q = query.trim().toLowerCase();
    if (q) {
      rows = rows.filter((quote) => {
        const customer = state.customers.find((c) => c.id === quote.customerId);
        return (
          quote.number.includes(q) ||
          customer?.name.toLowerCase().includes(q) ||
          customer?.company?.toLowerCase().includes(q)
        );
      });
    }
    return rows;
  }, [state.quotes, state.customers, tab, query]);
  const totals = invoiceTotals(lines);
  const canSave = customerId && lines.some((l) => l.description && l.qty > 0);
  const locked = editing?.status === 'converted' || editing?.status === 'declined';

  function openNew() {
    setEditing(null);
    setCustomerId(state.customers[0]?.id ?? '');
    setLocationId(state.locations.find((l) => l.isActive)?.id ?? '');
    setDate(todayISO());
    setExpiryDate(addDaysISO(todayISO(), 30));
    setMessage('Thanks for considering ABC LLC.');
    setLines([{ productId: '', description: '', qty: 1, rate: 0 }]);
    setOpen(true);
  }

  function openEdit(q: Quote) {
    setEditing(q);
    setCustomerId(q.customerId);
    setLocationId(q.locationId || state.locations.find((l) => l.isActive)?.id || '');
    setDate(q.date);
    setExpiryDate(q.expiryDate);
    setMessage(q.message);
    setLines(
      q.lines.map((l) => ({
        productId: l.productId ?? '',
        description: l.description,
        qty: l.qty,
        rate: l.rate,
      })),
    );
    setOpen(true);
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

  function onSave(asDraft: boolean) {
    if (!canSave || locked) return;
    saveQuote({
      id: editing?.id,
      customerId,
      locationId,
      date,
      expiryDate,
      status: asDraft ? 'draft' : 'sent',
      message,
      lines: lines.filter((l) => l.description),
    });
    setOpen(false);
  }

  function onConvert(q: Quote) {
    const id = convertQuoteToInvoice(q.id);
    if (id) navigate(`/invoices?open=${id}`);
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
          <h1>Estimates</h1>
          <p>Send a quote, then convert it to an invoice when the customer accepts.</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>
          Create estimate
        </button>
      </div>

      <div className="list-toolbar">
        <div className="tabs" style={{ marginBottom: 0 }}>
          {(['all', 'draft', 'sent', 'accepted', 'converted', 'declined'] as const).map((t) => (
            <button
              key={t}
              type="button"
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
          placeholder="Filter by # or customer"
          aria-label="Filter estimates"
        />
      </div>

      <div className="panel">
        <div className="table-wrap">
          <table className="data data-clickable">
            <thead>
              <tr>
                <th>Date</th>
                <th>No.</th>
                <th>Customer</th>
                <th>Expiry</th>
                <th>Status</th>
                <th className="num">Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((q) => {
                const customer = state.customers.find((c) => c.id === q.customerId);
                return (
                  <tr key={q.id} onClick={() => openEdit(q)}>
                    <td>{shortDate(q.date)}</td>
                    <td>
                      <button
                        className="linkish"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(q);
                        }}
                      >
                        #{q.number}
                      </button>
                    </td>
                    <td>{customer?.name}</td>
                    <td>{shortDate(q.expiryDate)}</td>
                    <td>
                      <StatusBadge status={q.status} />
                    </td>
                    <td className="num">{money(q.total)}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div
                        style={{
                          display: 'flex',
                          gap: 6,
                          justifyContent: 'flex-end',
                          flexWrap: 'wrap',
                        }}
                      >
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(q)}>
                          Open
                        </button>
                        {q.status === 'sent' || q.status === 'draft' ? (
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setQuoteStatus(q.id, 'accepted')}
                          >
                            Accept
                          </button>
                        ) : null}
                        {q.status !== 'converted' && q.status !== 'declined' ? (
                          <>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => setQuoteStatus(q.id, 'declined')}
                            >
                              Decline
                            </button>
                            <button className="btn btn-primary btn-sm" onClick={() => onConvert(q)}>
                              Convert to invoice
                            </button>
                          </>
                        ) : q.invoiceId ? (
                          <Link
                            className="btn btn-ghost btn-sm"
                            to={`/invoices?open=${q.invoiceId}`}
                          >
                            View invoice
                          </Link>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {list.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty">
                    <div className="empty-cta">
                      <div>No estimates in this view.</div>
                      <button className="btn btn-primary" onClick={openNew}>
                        Create estimate
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
          title={editing ? `Estimate #${editing.number}` : 'Estimate'}
          onClose={() => setOpen(false)}
          wide
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setOpen(false)}>
                Close
              </button>
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
                    Save and send
                  </button>
                </>
              ) : null}
            </>
          }
        >
          {editing?.status === 'converted' ? (
            <div className="info-banner" style={{ marginBottom: 14 }}>
              This estimate was converted to an invoice and is view-only.
              {editing.invoiceId ? (
                <>
                  {' '}
                  <Link to={`/invoices?open=${editing.invoiceId}`} className="linkish">
                    Open invoice
                  </Link>
                </>
              ) : null}
            </div>
          ) : null}
          {editing?.status === 'declined' ? (
            <div className="info-banner" style={{ marginBottom: 14 }}>
              This estimate was declined. Reopen by saving as draft or sent.
            </div>
          ) : null}
          {editing &&
          (editing.status === 'sent' ||
            editing.status === 'draft' ||
            editing.status === 'accepted') ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              {editing.status !== 'accepted' ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setQuoteStatus(editing.id, 'accepted');
                    setEditing({ ...editing, status: 'accepted' });
                  }}
                >
                  Mark accepted
                </button>
              ) : null}
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setQuoteStatus(editing.id, 'declined');
                  setEditing({ ...editing, status: 'declined' });
                }}
              >
                Decline
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  onConvert(editing);
                  setOpen(false);
                }}
              >
                Convert to invoice
              </button>
            </div>
          ) : null}
          {editing?.status === 'declined' ? (
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setQuoteStatus(editing.id, 'draft');
                  setEditing({ ...editing, status: 'draft' });
                }}
              >
                Reopen as draft
              </button>
            </div>
          ) : null}
          <div className="form-grid two">
            <div className="field">
              <label>Customer</label>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                disabled={locked}
              >
                {state.customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Fulfill from</label>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                disabled={locked}
              >
                {state.locations
                  .filter((l) => l.isActive)
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="field">
              <label>Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={locked}
              />
            </div>
            <div className="field">
              <label>Expiry</label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                disabled={locked}
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
                          disabled={locked}
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
                    { productId: '', description: '', qty: 1, rate: 0 },
                  ])
                }
              >
                + Line
              </button>
            ) : null}
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
            <label>Message</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} disabled={locked} />
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
