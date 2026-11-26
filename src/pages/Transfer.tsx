import { useMemo, useState } from 'react';
import { money, shortDate, todayISO } from '../lib/format';
import { HubTabs, bankingHubTabs } from '../components/HubTabs';
import { useBooks } from '../store/BooksContext';

export function Transfer() {
  const { state, transferFunds } = useBooks();
  const accounts = state.accounts.filter(
    (a) => a.type === 'bank' || a.type === 'credit_card',
  );

  const [fromAccountId, setFromAccountId] = useState(accounts[0]?.id ?? 'acc_checking');
  const [toAccountId, setToAccountId] = useState(
    accounts.find((a) => a.id !== accounts[0]?.id)?.id ?? 'acc_savings',
  );
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(todayISO());
  const [memo, setMemo] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const history = useMemo(
    () => [...(state.fundTransfers ?? [])].sort((a, b) => b.date.localeCompare(a.date)),
    [state.fundTransfers],
  );

  function onSave() {
    setError('');
    if (amount <= 0) {
      setError('Enter an amount greater than zero.');
      return;
    }
    if (fromAccountId === toAccountId) {
      setError('Choose two different accounts.');
      return;
    }
    const ok = transferFunds({ fromAccountId, toAccountId, amount, date, memo });
    if (!ok) {
      setError('Transfer failed.');
      return;
    }
    setAmount(0);
    setMemo('');
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div>
      <HubTabs tabs={bankingHubTabs} />
      <div className="page-header">
        <div>
          <h1>Transfer</h1>
          <p>Move money between bank and credit card accounts.</p>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 16, maxWidth: 640 }}>
        <div className="panel-pad">
          <div className="form-grid two">
            <div className="field">
              <label>Transfer funds from</label>
              <select value={fromAccountId} onChange={(e) => setFromAccountId(e.target.value)}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({money(a.balance)})
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Transfer funds to</label>
              <select value={toAccountId} onChange={(e) => setToAccountId(e.target.value)}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({money(a.balance)})
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Amount</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
              />
            </div>
            <div className="field">
              <label>Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div className="field" style={{ marginTop: 12 }}>
            <label>Memo</label>
            <input value={memo} onChange={(e) => setMemo(e.target.value)} />
          </div>
          {error ? (
            <div style={{ marginTop: 10, color: 'var(--coral)', fontWeight: 600 }}>{error}</div>
          ) : null}
          <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'center' }}>
            <button className="btn btn-primary" onClick={onSave} disabled={amount <= 0}>
              Save transfer
            </button>
            {saved ? <span style={{ color: 'var(--sea)', fontWeight: 600 }}>Saved</span> : null}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Recent transfers</h2>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Date</th>
                <th>From</th>
                <th>To</th>
                <th>Memo</th>
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {history.map((t) => (
                <tr key={t.id}>
                  <td>{shortDate(t.date)}</td>
                  <td>{state.accounts.find((a) => a.id === t.fromAccountId)?.name}</td>
                  <td>{state.accounts.find((a) => a.id === t.toAccountId)?.name}</td>
                  <td style={{ color: 'var(--muted)' }}>{t.memo || '—'}</td>
                  <td className="num">{money(t.amount)}</td>
                </tr>
              ))}
              {history.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty">
                    No transfers yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
