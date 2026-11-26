import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { HubTabs, expensesHubTabs } from '../components/HubTabs';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { billLineTotals, unpaidBills } from '../lib/accounting';
import { money, shortDate, todayISO } from '../lib/format';
import { useBooks } from '../store/BooksContext';

type DraftLine = { categoryAccountId: string; description: string; qty: number; rate: number };

export function VendorCredits() {
  const { state, saveVendorCredit, voidVendorCredit, applyVendorCredit } = useBooks();
  const [params, setParams] = useSearchParams();
  const categories = state.accounts.filter(
    (a) => a.type === 'expense' || a.type === 'cogs' || a.type === 'other_expense',
  );
  const [open, setOpen] = useState(false);
  const [applyOpen, setApplyOpen] = useState<string | null>(null);
  const [vendorId, setVendorId] = useState(state.vendors[0]?.id ?? '');
  const [date, setDate] = useState(todayISO());
  const [memo, setMemo] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([
    {
      categoryAccountId: categories[0]?.id ?? 'acc_office',
      description: '',
      qty: 1,
      rate: 0,
    },
  ]);
  const [alloc, setAlloc] = useState<Record<string, number>>({});

  useEffect(() => {
    if (params.get('new') === '1') {
      setOpen(true);
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  const credits = useMemo(
    () => [...(state.vendorCredits ?? [])].sort((a, b) => b.date.localeCompare(a.date)),
    [state.vendorCredits],
  );
  const totals = billLineTotals(lines);
  const applying = credits.find((c) => c.id === applyOpen);
  const openBills = unpaidBills(state.bills ?? []).filter((b) => b.vendorId === applying?.vendorId);

  function onSave() {
    if (!vendorId) return;
    saveVendorCredit({
      vendorId,
      date,
      memo,
      lines: lines.map((l) => ({
        categoryAccountId: l.categoryAccountId,
        description: l.description,
        qty: l.qty,
        rate: l.rate,
      })),
    });
    setOpen(false);
    setMemo('');
  }

  function onApply() {
    if (!applyOpen) return;
    applyVendorCredit({
      vendorCreditId: applyOpen,
      allocations: Object.entries(alloc)
        .map(([billId, amount]) => ({ billId, amount }))
        .filter((a) => a.amount > 0),
    });
    setApplyOpen(null);
    setAlloc({});
  }

  return (
    <div>
      <HubTabs tabs={expensesHubTabs} />
      <div className="page-header">
        <div>
          <h1>Vendor credits</h1>
          <p>Record vendor credits and apply them to open bills.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
          <Plus size={16} /> New vendor credit
        </button>
      </div>

      <div className="panel">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Date</th>
                <th>No.</th>
                <th>Vendor</th>
                <th>Status</th>
                <th className="num">Total</th>
                <th className="num">Unapplied</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {credits.map((c) => (
                <tr key={c.id}>
                  <td>{shortDate(c.date)}</td>
                  <td style={{ fontWeight: 600 }}>VC-{c.number}</td>
                  <td>{state.vendors.find((v) => v.id === c.vendorId)?.name ?? '—'}</td>
                  <td>
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="num">{money(c.total)}</td>
                  <td className="num">{money(c.balance)}</td>
                  <td className="num">
                    {c.balance > 0 && c.status !== 'void' ? (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          setApplyOpen(c.id);
                          setAlloc({});
                        }}
                      >
                        Apply
                      </button>
                    ) : null}
                    {c.status === 'open' && c.balance === c.total ? (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => voidVendorCredit(c.id)}
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
          title="Vendor credit"
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
              <label>Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div className="field" style={{ marginTop: 10 }}>
            <label>Memo</label>
            <input value={memo} onChange={(e) => setMemo(e.target.value)} />
          </div>
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="data">
              <thead>
                <tr>
                  <th>Category</th>
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
                        value={line.categoryAccountId}
                        onChange={(e) =>
                          setLines((rows) =>
                            rows.map((r, i) =>
                              i === idx ? { ...r, categoryAccountId: e.target.value } : r,
                            ),
                          )
                        }
                      >
                        {categories.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
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
          <div style={{ marginTop: 12, fontWeight: 600 }}>Total {money(totals.total)}</div>
        </Modal>
      ) : null}

      {applyOpen && applying ? (
        <Modal
          title={`Apply VC-${applying.number}`}
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
          {openBills.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>No open bills for this vendor.</p>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Bill</th>
                    <th className="num">Balance</th>
                    <th className="num">Apply</th>
                  </tr>
                </thead>
                <tbody>
                  {openBills.map((bill) => (
                    <tr key={bill.id}>
                      <td>BILL-{bill.number}</td>
                      <td className="num">{money(bill.balance)}</td>
                      <td>
                        <input
                          type="number"
                          className="num"
                          value={alloc[bill.id] ?? 0}
                          onChange={(e) =>
                            setAlloc((a) => ({
                              ...a,
                              [bill.id]: Math.min(bill.balance, Number(e.target.value) || 0),
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
