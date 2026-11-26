import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { HubTabs, accountingHubTabs } from '../components/HubTabs';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { accountTypeLabel, money, shortDate, todayISO } from '../lib/format';
import { useBooks } from '../store/BooksContext';

type DraftLine = { accountId: string; description: string; debit: string; credit: string };

const emptyLine = (): DraftLine => ({
  accountId: 'acc_office',
  description: '',
  debit: '',
  credit: '',
});

export function JournalEntries() {
  const { state, saveJournalEntry, voidJournalEntry } = useBooks();
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [memo, setMemo] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([emptyLine(), emptyLine()]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (params.get('new') === '1') {
      setOpen(true);
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  const entries = useMemo(
    () => [...(state.journalEntries ?? [])].sort((a, b) => b.date.localeCompare(a.date)),
    [state.journalEntries],
  );

  const debits = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const credits = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const balanced = Math.round(debits * 100) === Math.round(credits * 100) && debits > 0;

  function onSave() {
    const payload = lines
      .map((l) => ({
        accountId: l.accountId,
        description: l.description,
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
      }))
      .filter((l) => l.debit > 0 || l.credit > 0);
    const id = saveJournalEntry({ date, memo, lines: payload });
    if (!id) {
      setError('Entry must balance and include at least two lines.');
      return;
    }
    setOpen(false);
    setMemo('');
    setLines([emptyLine(), emptyLine()]);
    setError('');
  }

  return (
    <div>
      <HubTabs tabs={accountingHubTabs} />
      <div className="page-header">
        <div>
          <h1>Journal entries</h1>
          <p>Post balanced debit and credit lines to the general ledger.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
          <Plus size={16} /> New journal entry
        </button>
      </div>

      <div className="panel">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Date</th>
                <th>No.</th>
                <th>Memo</th>
                <th>Status</th>
                <th className="num">Amount</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ color: 'var(--muted)' }}>
                    No journal entries yet.
                  </td>
                </tr>
              ) : (
                entries.map((je) => {
                  const amount = je.lines.reduce((s, l) => s + l.debit, 0);
                  return (
                    <tr key={je.id}>
                      <td>{shortDate(je.date)}</td>
                      <td style={{ fontWeight: 600 }}>JE-{je.number}</td>
                      <td>{je.memo || '—'}</td>
                      <td>
                        <StatusBadge status={je.status} />
                      </td>
                      <td className="num">{money(amount)}</td>
                      <td className="num">
                        {je.status === 'posted' ? (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => voidJournalEntry(je.id)}
                          >
                            Void
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {open ? (
        <Modal
          title="Journal entry"
          wide
          onClose={() => setOpen(false)}
          footer={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={onSave} disabled={!balanced}>
                Save
              </button>
            </>
          }
        >
          <div className="form-grid two" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="field">
              <label>Memo</label>
              <input value={memo} onChange={(e) => setMemo(e.target.value)} />
            </div>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Description</th>
                  <th className="num">Debit</th>
                  <th className="num">Credit</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lines.map((line, idx) => (
                  <tr key={idx}>
                    <td>
                      <select
                        value={line.accountId}
                        onChange={(e) =>
                          setLines((rows) =>
                            rows.map((r, i) =>
                              i === idx ? { ...r, accountId: e.target.value } : r,
                            ),
                          )
                        }
                      >
                        {state.accounts
                          .filter((a) => a.isActive)
                          .map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.number} · {a.name} ({accountTypeLabel(a.type)})
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
                        className="num"
                        inputMode="decimal"
                        value={line.debit}
                        onChange={(e) =>
                          setLines((rows) =>
                            rows.map((r, i) =>
                              i === idx ? { ...r, debit: e.target.value, credit: '' } : r,
                            ),
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="num"
                        inputMode="decimal"
                        value={line.credit}
                        onChange={(e) =>
                          setLines((rows) =>
                            rows.map((r, i) =>
                              i === idx ? { ...r, credit: e.target.value, debit: '' } : r,
                            ),
                          )
                        }
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setLines((rows) => rows.filter((_, i) => i !== idx))}
                        disabled={lines.length <= 2}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setLines((r) => [...r, emptyLine()])}>
              Add line
            </button>
            <span style={{ color: balanced ? 'var(--sea)' : 'var(--muted)', fontWeight: 600 }}>
              Debits {money(debits)} · Credits {money(credits)}
              {!balanced ? ' · out of balance' : ' · balanced'}
            </span>
          </div>
          {error ? (
            <div style={{ marginTop: 10, color: '#b42318', fontWeight: 600 }}>{error}</div>
          ) : null}
        </Modal>
      ) : null}
    </div>
  );
}
