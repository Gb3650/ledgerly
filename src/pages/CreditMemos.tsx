import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { HubTabs, salesHubTabs } from '../components/HubTabs';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { invoiceTotals, unpaidInvoices } from '../lib/accounting';
import { money, shortDate, todayISO } from '../lib/format';
import { useBooks } from '../store/BooksContext';

type DraftLine = { productId: string; description: string; qty: number; rate: number };

export function CreditMemos() {
  const { state, saveCreditMemo, voidCreditMemo, applyCreditMemo } = useBooks();
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [applyOpen, setApplyOpen] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState(state.customers[0]?.id ?? '');
  const [date, setDate] = useState(todayISO());
  const [message, setMessage] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([
    { productId: state.products[0]?.id ?? '', description: '', qty: 1, rate: 0 },
  ]);
  const [alloc, setAlloc] = useState<Record<string, number>>({});

  useEffect(() => {
    if (params.get('new') === '1') {
      setOpen(true);
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  const memos = useMemo(
    () => [...(state.creditMemos ?? [])].sort((a, b) => b.date.localeCompare(a.date)),
    [state.creditMemos],
  );
  const totals = invoiceTotals(lines);
  const applying = memos.find((m) => m.id === applyOpen);
  const openInvoices = unpaidInvoices(state.invoices).filter(
    (i) => i.customerId === applying?.customerId,
  );

  function onSave() {
    if (!customerId || !lines.some((l) => l.qty && l.rate)) return;
    saveCreditMemo({
      customerId,
      date,
      message,
      lines: lines.map((l) => ({
        productId: l.productId || undefined,
        description: l.description || state.products.find((p) => p.id === l.productId)?.name || '',
        qty: l.qty,
        rate: l.rate,
      })),
    });
    setOpen(false);
    setMessage('');
  }

  function onApply() {
    if (!applyOpen) return;
    const allocations = Object.entries(alloc)
      .map(([invoiceId, amount]) => ({ invoiceId, amount }))
      .filter((a) => a.amount > 0);
    applyCreditMemo({ creditMemoId: applyOpen, allocations });
    setApplyOpen(null);
    setAlloc({});
  }

  return (
    <div>
      <HubTabs tabs={salesHubTabs} />
      <div className="page-header">
        <div>
          <h1>Credit memos</h1>
          <p>Issue customer credits and apply them to open invoices.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
          <Plus size={16} /> New credit memo
        </button>
      </div>

      <div className="panel">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Date</th>
                <th>No.</th>
                <th>Customer</th>
                <th>Status</th>
                <th className="num">Total</th>
                <th className="num">Unapplied</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {memos.map((m) => (
                <tr key={m.id}>
                  <td>{shortDate(m.date)}</td>
                  <td style={{ fontWeight: 600 }}>CM-{m.number}</td>
                  <td>{state.customers.find((c) => c.id === m.customerId)?.name ?? '—'}</td>
                  <td>
                    <StatusBadge status={m.status} />
                  </td>
                  <td className="num">{money(m.total)}</td>
                  <td className="num">{money(m.balance)}</td>
                  <td className="num">
                    {m.balance > 0 && m.status !== 'void' ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => {
                            setApplyOpen(m.id);
                            setAlloc({});
                          }}
                        >
                          Apply
                        </button>
                        <Link className="btn btn-ghost btn-sm" to={`/refunds?credit=${m.id}`}>
                          Refund
                        </Link>
                      </>
                    ) : null}
                    {m.status === 'open' && m.balance === m.total ? (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => voidCreditMemo(m.id)}
                      >
                        Void
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {open ? (
        <Modal
          title="Credit memo"
          wide
          onClose={() => setOpen(false)}
          footer={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={onSave}>
                Save
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
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div className="field" style={{ marginTop: 10 }}>
            <label>Message</label>
            <input value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="data">
              <thead>
                <tr>
                  <th>Product/service</th>
                  <th>Description</th>
                  <th className="num">Qty</th>
                  <th className="num">Rate</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, idx) => (
                  <tr key={idx}>
                    <td>
                      <select
                        value={line.productId}
                        onChange={(e) => {
                          const p = state.products.find((x) => x.id === e.target.value);
                          setLines((rows) =>
                            rows.map((r, i) =>
                              i === idx
                                ? {
                                    ...r,
                                    productId: e.target.value,
                                    description: p?.name ?? r.description,
                                    rate: p?.unitPrice ?? r.rate,
                                  }
                                : r,
                            ),
                          );
                        }}
                      >
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
                          setLines((rows) =>
                            rows.map((r, i) =>
                              i === idx ? { ...r, description: e.target.value } : r,
                            ),
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        className="num"
                        value={line.qty}
                        onChange={(e) =>
                          setLines((rows) =>
                            rows.map((r, i) =>
                              i === idx ? { ...r, qty: Number(e.target.value) || 0 } : r,
                            ),
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        className="num"
                        value={line.rate}
                        onChange={(e) =>
                          setLines((rows) =>
                            rows.map((r, i) =>
                              i === idx ? { ...r, rate: Number(e.target.value) || 0 } : r,
                            ),
                          )
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 12, fontWeight: 600 }}>
            Subtotal {money(totals.subtotal)} · Tax {money(totals.tax)} · Total {money(totals.total)}
          </div>
        </Modal>
      ) : null}

      {applyOpen && applying ? (
        <Modal
          title={`Apply CM-${applying.number}`}
          onClose={() => setApplyOpen(null)}
          footer={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setApplyOpen(null)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={onApply}>
                Apply
              </button>
            </>
          }
        >
          <p style={{ marginTop: 0 }}>
            Unapplied credit: <strong>{money(applying.balance)}</strong>
          </p>
          {openInvoices.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>No open invoices for this customer.</p>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th className="num">Balance</th>
                    <th className="num">Apply</th>
                  </tr>
                </thead>
                <tbody>
                  {openInvoices.map((inv) => (
                    <tr key={inv.id}>
                      <td>INV-{inv.number}</td>
                      <td className="num">{money(inv.balance)}</td>
                      <td>
                        <input
                          type="number"
                          className="num"
                          value={alloc[inv.id] ?? 0}
                          max={inv.balance}
                          onChange={(e) =>
                            setAlloc((a) => ({
                              ...a,
                              [inv.id]: Math.min(inv.balance, Number(e.target.value) || 0),
                            }))
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Modal>
      ) : null}
    </div>
  );
}
