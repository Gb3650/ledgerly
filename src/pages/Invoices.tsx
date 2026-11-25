import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { invoiceBodyText, invoiceTotals } from '../lib/accounting';
import { stockQty } from '../lib/inventory';
import { addDaysISO, money, shortDate, todayISO } from '../lib/format';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { useBooks } from '../store/BooksContext';
import type { Invoice } from '../types';

type LineDraft = { productId: string; description: string; qty: number; rate: number };

export function Invoices() {
  const { state, saveInvoice, receivePayment, markInvoiceEmailed } = useBooks();
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [tab, setTab] = useState<'all' | Invoice['status']>('all');
  const [payInv, setPayInv] = useState<Invoice | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState('Check');
  const [payMemo, setPayMemo] = useState('');

  const [customerId, setCustomerId] = useState(state.customers[0]?.id ?? '');
  const [locationId, setLocationId] = useState(
    state.locations.find((l) => l.isActive)?.id ?? '',
  );
  const [date, setDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState(addDaysISO(todayISO(), 30));
  const [status, setStatus] = useState<Invoice['status']>('sent');
  const [message, setMessage] = useState('Thank you for your business with ABC LLC.');
  const [lines, setLines] = useState<LineDraft[]>([
    { productId: '', description: '', qty: 1, rate: 0 },
  ]);

  useEffect(() => {
    if (params.get('new') === '1') {
      openNew(params.get('customer') ?? undefined);
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  const filtered = useMemo(() => {
    const list = [...state.invoices].sort((a, b) => b.date.localeCompare(a.date));
    if (tab === 'all') return list;
    return list.filter((i) => i.status === tab);
  }, [state.invoices, tab]);

  function openNew(presetCustomer?: string) {
    setEditing(null);
    setCustomerId(presetCustomer || state.customers[0]?.id || '');
    setLocationId(state.locations.find((l) => l.isActive)?.id ?? '');
    setDate(todayISO());
    setDueDate(addDaysISO(todayISO(), 30));
    setStatus('sent');
    setMessage('Thank you for your business with ABC LLC.');
    setLines([{ productId: '', description: '', qty: 1, rate: 0 }]);
    setOpen(true);
  }

  function openEdit(inv: Invoice) {
    setEditing(inv);
    setCustomerId(inv.customerId);
    setLocationId(inv.locationId || state.locations.find((l) => l.isActive)?.id || '');
    setDate(inv.date);
    setDueDate(inv.dueDate);
    setStatus(inv.status === 'paid' ? 'paid' : inv.status === 'partial' ? 'partial' : inv.status);
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
      locationId,
      date,
      dueDate,
      status: asDraft ? 'draft' : status === 'draft' ? 'sent' : status,
      message,
      lines: lines.filter((l) => l.description),
    });
    setOpen(false);
  }

  function openPay(inv: Invoice) {
    setPayInv(inv);
    setPayAmount(inv.balance);
    setPayMethod('Check');
    setPayMemo('');
  }

  function confirmPay() {
    if (!payInv || payAmount <= 0) return;
    receivePayment(payInv.id, payAmount, payMethod, payMemo);
    setPayInv(null);
  }

  function emailInvoice(inv: Invoice) {
    const customer = state.customers.find((c) => c.id === inv.customerId);
    const body = invoiceBodyText(state.company, customer, inv);
    const subject = encodeURIComponent(
      `Invoice #${inv.number} from ${state.company.name}`,
    );
    const mailto = `mailto:${encodeURIComponent(customer?.email || '')}?subject=${subject}&body=${encodeURIComponent(body)}`;
    window.open(mailto, '_blank');
    markInvoiceEmailed(inv.id);
  }

  const paymentsForEdit = editing
    ? state.payments.filter((p) => p.invoiceId === editing.id)
    : [];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Invoices</h1>
          <p>Create, email, and record full or partial payments.</p>
        </div>
        <button className="btn btn-primary" onClick={() => openNew()}>
          Create invoice
        </button>
      </div>

      <div className="tabs">
        {(['all', 'draft', 'sent', 'partial', 'overdue', 'paid'] as const).map((t) => (
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
                <th>Location</th>
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
                const loc = state.locations.find((l) => l.id === inv.locationId);
                return (
                  <tr key={inv.id}>
                    <td>{shortDate(inv.date)}</td>
                    <td style={{ fontWeight: 700 }}>#{inv.number}</td>
                    <td>{customer?.name}</td>
                    <td>{loc?.code ?? '—'}</td>
                    <td>{shortDate(inv.dueDate)}</td>
                    <td>
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="num">{money(inv.total)}</td>
                    <td className="num">{money(inv.balance)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(inv)}>
                          Open
                        </button>
                        {customer?.email ? (
                          <button className="btn btn-ghost btn-sm" onClick={() => emailInvoice(inv)}>
                            Email
                          </button>
                        ) : null}
                        {inv.balance > 0 && inv.status !== 'draft' && inv.status !== 'void' ? (
                          <button className="btn btn-primary btn-sm" onClick={() => openPay(inv)}>
                            Record payment
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="empty">
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
              <label>Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as Invoice['status'])}>
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="partial">Partial</option>
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
                              {p.type === 'inventory' && locationId
                                ? ` (${stockQty(state.stock, p.id, locationId)} @ loc)`
                                : ''}
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
            <div style={{ textAlign: 'right', marginTop: 12 }}>
              <div>Subtotal {money(totals.subtotal)}</div>
              <div>Tax {money(totals.tax)}</div>
              <div style={{ fontWeight: 700 }}>Total {money(totals.total)}</div>
            </div>
          </div>

          <div className="field" style={{ marginTop: 14 }}>
            <label>Message</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>

          {paymentsForEdit.length > 0 ? (
            <div style={{ marginTop: 16 }}>
              <strong>Payment history</strong>
              <div className="table-wrap" style={{ marginTop: 8 }}>
                <table className="data">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Method</th>
                      <th>Memo</th>
                      <th className="num">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentsForEdit.map((p) => (
                      <tr key={p.id}>
                        <td>{shortDate(p.date)}</td>
                        <td>{p.method}</td>
                        <td>{p.memo || '—'}</td>
                        <td className="num">{money(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </Modal>
      ) : null}

      {payInv ? (
        <Modal
          title={`Record payment — #${payInv.number}`}
          onClose={() => setPayInv(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setPayInv(null)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={confirmPay}
                disabled={payAmount <= 0 || payAmount > payInv.balance + 0.001}
              >
                Apply payment
              </button>
            </>
          }
        >
          <p style={{ marginTop: 0, color: 'var(--muted)' }}>
            Balance due {money(payInv.balance)}. Enter any amount up to the balance for a partial
            payment.
          </p>
          <div className="form-grid two">
            <div className="field">
              <label>Amount</label>
              <input
                type="number"
                min={0.01}
                step="0.01"
                max={payInv.balance}
                value={payAmount}
                onChange={(e) => setPayAmount(Number(e.target.value))}
                autoFocus
              />
            </div>
            <div className="field">
              <label>Method</label>
              <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                <option>Check</option>
                <option>Cash</option>
                <option>Card</option>
                <option>ACH / Wire</option>
                <option>Other</option>
              </select>
            </div>
          </div>
          <div className="field" style={{ marginTop: 14 }}>
            <label>Memo</label>
            <input value={payMemo} onChange={(e) => setPayMemo(e.target.value)} />
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
