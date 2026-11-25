import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { invoiceTotals } from '../lib/accounting';
import { addDaysISO, money, shortDate, todayISO } from '../lib/format';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { useBooks } from '../store/BooksContext';
import type { Invoice } from '../types';

type LineDraft = { productId: string; description: string; qty: number; rate: number };

export function Invoices() {
  const { state, saveInvoice, receivePayment } = useBooks();
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [tab, setTab] = useState<'all' | Invoice['status']>('all');

  const [customerId, setCustomerId] = useState(state.customers[0]?.id ?? '');
  const [date, setDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState(addDaysISO(todayISO(), 30));
  const [status, setStatus] = useState<Invoice['status']>('sent');
  const [message, setMessage] = useState('Thanks for your business.');
  const [lines, setLines] = useState<LineDraft[]>([
    { productId: '', description: '', qty: 1, rate: 0 },
  ]);

  useEffect(() => {
    if (params.get('new') === '1') {
      openNew();
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  const filtered = useMemo(() => {
    const list = [...state.invoices].sort((a, b) => b.date.localeCompare(a.date));
    if (tab === 'all') return list;
    return list.filter((i) => i.status === tab);
  }, [state.invoices, tab]);

  function openNew() {
    setEditing(null);
    setCustomerId(state.customers[0]?.id ?? '');
    setDate(todayISO());
    setDueDate(addDaysISO(todayISO(), 30));
    setStatus('sent');
    setMessage('Thanks for your business.');
    setLines([{ productId: '', description: '', qty: 1, rate: 0 }]);
    setOpen(true);
  }

  function openEdit(inv: Invoice) {
    setEditing(inv);
    setCustomerId(inv.customerId);
    setDate(inv.date);
    setDueDate(inv.dueDate);
    setStatus(inv.status === 'paid' ? 'paid' : inv.status);
    setMessage(inv.message);
    setLines(
      inv.lines.map((l) => ({
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

  const totals = invoiceTotals(lines);
  const canSave = customerId && lines.some((l) => l.description && l.qty > 0);

  function onSave(asDraft = false) {
    if (!canSave) return;
    saveInvoice({
      id: editing?.id,
      customerId,
      date,
      dueDate,
      status: asDraft ? 'draft' : status === 'draft' ? 'sent' : status,
      message,
      lines: lines.filter((l) => l.description),
    });
    setOpen(false);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Invoices</h1>
          <p>Create, send, and record payments — just like your day-to-day books.</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>
          Create invoice
        </button>
      </div>

      <div className="tabs">
        {(['all', 'draft', 'sent', 'overdue', 'paid'] as const).map((t) => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'all' ? 'All' : t}
          </button>
        ))}
      </div>

      <div className="panel">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Date</th>
                <th>No.</th>
                <th>Customer</th>
                <th>Due</th>
                <th>Status</th>
                <th className="num">Total</th>
                <th className="num">Balance</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv) => {
                const customer = state.customers.find((c) => c.id === inv.customerId);
                return (
                  <tr key={inv.id}>
                    <td>{shortDate(inv.date)}</td>
                    <td style={{ fontWeight: 700 }}>#{inv.number}</td>
                    <td>{customer?.name}</td>
                    <td>{shortDate(inv.dueDate)}</td>
                    <td>
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="num">{money(inv.total)}</td>
                    <td className="num">{money(inv.balance)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(inv)}>
                          Open
                        </button>
                        {inv.balance > 0 && inv.status !== 'draft' && inv.status !== 'void' ? (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => receivePayment(inv.id)}
                          >
                            Receive payment
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="empty">
                    No invoices in this view.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {open ? (
        <Modal
          title={editing ? `Invoice #${editing.number}` : 'New invoice'}
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
                {editing ? 'Save' : 'Save and send'}
              </button>
            </>
          }
        >
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
              <label>Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as Invoice['status'])}>
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="paid">Paid</option>
              </select>
            </div>
            <div className="field">
              <label>Invoice date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="field">
              <label>Due date</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          <div style={{ marginTop: 18 }}>
            <div className="line-items">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '28%' }}>Product/service</th>
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
                              prev.map((l, i) => (i === idx ? { ...l, description: e.target.value } : l)),
                            )
                          }
                          placeholder="Description"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={line.qty}
                          onChange={(e) =>
                            setLines((prev) =>
                              prev.map((l, i) =>
                                i === idx ? { ...l, qty: Number(e.target.value) } : l,
                              ),
                            )
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={line.rate}
                          onChange={(e) =>
                            setLines((prev) =>
                              prev.map((l, i) =>
                                i === idx ? { ...l, rate: Number(e.target.value) } : l,
                              ),
                            )
                          }
                        />
                      </td>
                      <td className="num" style={{ fontWeight: 700, paddingRight: 12 }}>
                        {money(line.qty * line.rate)}
                      </td>
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
              style={{ marginTop: 10 }}
              onClick={() =>
                setLines((prev) => [...prev, { productId: '', description: '', qty: 1, rate: 0 }])
              }
            >
              + Add line
            </button>
          </div>

          <div className="form-grid" style={{ marginTop: 16 }}>
            <div className="field">
              <label>Message on invoice</label>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} />
            </div>
          </div>

          <div className="totals-box">
            <div className="totals-row">
              <span>Subtotal</span>
              <span>{money(totals.subtotal)}</span>
            </div>
            <div className="totals-row">
              <span>Tax (8%)</span>
              <span>{money(totals.tax)}</span>
            </div>
            <div className="totals-row grand">
              <span>Total</span>
              <span>{money(totals.total)}</span>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
