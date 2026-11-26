import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { undepositedFundsBalance, undepositedPayments } from '../lib/accounting';
import { money, shortDate, todayISO } from '../lib/format';
import { HubTabs, bankingHubTabs } from '../components/HubTabs';
import { useBooks } from '../store/BooksContext';

export function BankDeposit() {
  const { state, createBankDeposit } = useBooks();
  const banks = state.accounts.filter((a) => a.type === 'bank');
  const waiting = useMemo(() => undepositedPayments(state), [state]);
  const ufBalance = undepositedFundsBalance(state);

  const [bankAccountId, setBankAccountId] = useState(banks[0]?.id ?? 'acc_checking');
  const [date, setDate] = useState(todayISO());
  const [memo, setMemo] = useState('');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [otherAmount, setOtherAmount] = useState(0);
  const [otherDescription, setOtherDescription] = useState('');
  const [saved, setSaved] = useState(false);

  const selectedIds = waiting.filter((p) => selected[p.id]).map((p) => p.id);
  const selectedTotal = waiting
    .filter((p) => selected[p.id])
    .reduce((s, p) => s + p.amount, 0);
  const depositTotal = Math.round((selectedTotal + (otherAmount || 0)) * 100) / 100;

  const history = useMemo(
    () => [...(state.bankDeposits ?? [])].sort((a, b) => b.date.localeCompare(a.date)),
    [state.bankDeposits],
  );

  function toggle(id: string) {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function selectAll() {
    const next: Record<string, boolean> = {};
    for (const p of waiting) next[p.id] = true;
    setSelected(next);
  }

  function onDeposit() {
    if (depositTotal <= 0) return;
    const id = createBankDeposit({
      bankAccountId,
      date,
      memo,
      paymentIds: selectedIds,
      otherAmount: otherAmount > 0 ? otherAmount : undefined,
      otherDescription: otherDescription || undefined,
    });
    if (!id) return;
    setSelected({});
    setOtherAmount(0);
    setOtherDescription('');
    setMemo('');
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div>
      <HubTabs tabs={bankingHubTabs} />
      <div className="page-header">
        <div>
          <h1>Bank deposit</h1>
          <p>
            Move payments from Undeposited Funds into a bank account — like QuickBooks Online.
          </p>
        </div>
        <Link className="btn btn-ghost" to="/receive-payment">
          Receive payment
        </Link>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 16 }}>
        <div className="panel stat">
          <div className="stat-label">Undeposited Funds</div>
          <div className="stat-value">{money(ufBalance)}</div>
          <div className="stat-hint">{waiting.length} payment{waiting.length === 1 ? '' : 's'}</div>
        </div>
        <div className="panel stat positive">
          <div className="stat-label">This deposit</div>
          <div className="stat-value">{money(depositTotal)}</div>
          <div className="stat-hint">Selected + other funds</div>
        </div>
        <div className="panel stat">
          <div className="stat-label">Deposit to</div>
          <div className="stat-value" style={{ fontSize: '1.15rem' }}>
            {state.accounts.find((a) => a.id === bankAccountId)?.name ?? 'Bank'}
          </div>
          <div className="stat-hint">
            {money(state.accounts.find((a) => a.id === bankAccountId)?.balance ?? 0)} balance
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-pad">
          <div className="form-grid two">
            <div className="field">
              <label>Account</label>
              <select value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)}>
                {banks.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Deposit date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="field">
              <label>Memo</label>
              <input value={memo} onChange={(e) => setMemo(e.target.value)} />
            </div>
            <div className="field">
              <label>Other funds (optional)</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={otherAmount}
                onChange={(e) => setOtherAmount(Number(e.target.value))}
                placeholder="0.00"
              />
            </div>
          </div>
          {otherAmount > 0 ? (
            <div className="field" style={{ marginTop: 12 }}>
              <label>Other funds description</label>
              <input
                value={otherDescription}
                onChange={(e) => setOtherDescription(e.target.value)}
                placeholder="Cash, coin, etc."
              />
            </div>
          ) : null}
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head" style={{ flexWrap: 'wrap', gap: 10 }}>
          <h2>Select payments to deposit</h2>
          <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={selectAll}>
            Select all
          </button>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th></th>
                <th>Date</th>
                <th>Received from</th>
                <th>Method</th>
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {waiting.map((p) => {
                const inv = state.invoices.find((i) => i.id === p.invoiceId);
                const customer = state.customers.find((c) => c.id === inv?.customerId);
                return (
                  <tr key={p.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={!!selected[p.id]}
                        onChange={() => toggle(p.id)}
                        aria-label={`Select payment ${p.id}`}
                      />
                    </td>
                    <td>{shortDate(p.date)}</td>
                    <td style={{ fontWeight: 600 }}>
                      {customer?.name ?? 'Customer'}
                      {inv ? (
                        <span style={{ color: 'var(--muted)', fontWeight: 500 }}>
                          {' '}
                          · INV-{inv.number}
                        </span>
                      ) : null}
                    </td>
                    <td>{p.method}</td>
                    <td className="num">{money(p.amount)}</td>
                  </tr>
                );
              })}
              {waiting.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty">
                    No payments in Undeposited Funds —{' '}
                    <Link to="/receive-payment" style={{ color: 'var(--sea)', fontWeight: 700 }}>
                      receive a payment
                    </Link>{' '}
                    first.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div
          className="panel-pad"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ fontWeight: 700 }}>
            Deposit total {money(depositTotal)}
            {saved ? (
              <span style={{ marginLeft: 12, color: 'var(--sea)', fontWeight: 600 }}>Deposited</span>
            ) : null}
          </div>
          <button className="btn btn-primary" disabled={depositTotal <= 0} onClick={onDeposit}>
            Save deposit
          </button>
        </div>
      </div>

      {history.length ? (
        <div className="panel">
          <div className="panel-head">
            <h2>Recent deposits</h2>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>No.</th>
                  <th>Account</th>
                  <th>Memo</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {history.slice(0, 10).map((d) => (
                  <tr key={d.id}>
                    <td>{shortDate(d.date)}</td>
                    <td style={{ fontWeight: 700 }}>#{d.number}</td>
                    <td>{state.accounts.find((a) => a.id === d.bankAccountId)?.name}</td>
                    <td style={{ color: 'var(--muted)' }}>{d.memo || '—'}</td>
                    <td className="num">{money(d.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
