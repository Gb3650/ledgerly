import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { reconcileBeginningBalance } from '../lib/accounting';
import { money, shortDate, todayISO } from '../lib/format';
import { HubTabs, bankingHubTabs } from '../components/HubTabs';
import { StatusBadge } from '../components/StatusBadge';
import { useBooks } from '../store/BooksContext';

export function Reconcile() {
  const { state, completeReconciliation } = useBooks();
  const banks = state.accounts.filter((a) => a.type === 'bank' || a.type === 'credit_card');

  const [accountId, setAccountId] = useState(banks[0]?.id ?? 'acc_checking');
  const [started, setStarted] = useState(false);
  const [statementEndingDate, setStatementEndingDate] = useState(todayISO());
  const [statementEndingBalance, setStatementEndingBalance] = useState(0);
  const [beginningBalance, setBeginningBalance] = useState(0);
  const [cleared, setCleared] = useState<Record<string, boolean>>({});
  const [error, setError] = useState('');
  const [doneMsg, setDoneMsg] = useState('');

  const account = banks.find((a) => a.id === accountId);

  const uncleared = useMemo(
    () =>
      state.transactions
        .filter((t) => t.accountId === accountId && !t.cleared)
        .filter((t) => t.date <= statementEndingDate)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [state.transactions, accountId, statementEndingDate],
  );

  const clearedAmount = uncleared
    .filter((t) => cleared[t.id])
    .reduce((s, t) => s + t.amount, 0);
  const clearedBalance = Math.round((beginningBalance + clearedAmount) * 100) / 100;
  const difference = Math.round((statementEndingBalance - clearedBalance) * 100) / 100;

  const history = useMemo(
    () =>
      [...(state.reconciliations ?? [])]
        .filter((r) => r.status === 'completed')
        .sort((a, b) => b.statementEndingDate.localeCompare(a.statementEndingDate)),
    [state.reconciliations],
  );

  function startReconcile() {
    setError('');
    setDoneMsg('');
    const begin = reconcileBeginningBalance(state, accountId);
    setBeginningBalance(begin);
    setStatementEndingBalance(account?.balance ?? begin);
    setCleared({});
    setStarted(true);
  }

  function toggle(id: string) {
    setCleared((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function selectAll() {
    const next: Record<string, boolean> = {};
    for (const t of uncleared) next[t.id] = true;
    setCleared(next);
  }

  function finish() {
    setError('');
    if (Math.abs(difference) > 0.001) {
      setError(`Difference must be $0.00 to finish (currently ${money(difference, { signed: true })}).`);
      return;
    }
    const ids = uncleared.filter((t) => cleared[t.id]).map((t) => t.id);
    const id = completeReconciliation({
      accountId,
      statementEndingDate,
      statementEndingBalance,
      beginningBalance,
      clearedTxnIds: ids,
    });
    if (!id) {
      setError('Could not complete reconciliation — check the difference is zero.');
      return;
    }
    setStarted(false);
    setDoneMsg(`Reconciled ${account?.name ?? 'account'} through ${shortDate(statementEndingDate)}.`);
  }

  return (
    <div>
      <HubTabs tabs={bankingHubTabs} />
      <div className="page-header">
        <div>
          <h1>Reconcile</h1>
          <p>Match your books to a bank or credit card statement ending balance.</p>
        </div>
        <Link className="btn btn-ghost" to="/banking">
          Bank transactions
        </Link>
      </div>

      {doneMsg ? (
        <div className="sample-banner" style={{ marginBottom: 16 }}>
          <span style={{ color: 'var(--sea)' }}>{doneMsg}</span>
        </div>
      ) : null}

      {!started ? (
        <div className="panel" style={{ maxWidth: 520, marginBottom: 16 }}>
          <div className="panel-head">
            <h2>Which account do you want to reconcile?</h2>
          </div>
          <div className="panel-pad">
            <div className="field">
              <label>Account</label>
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                {banks.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} — {money(a.balance)}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-grid two" style={{ marginTop: 12 }}>
              <div className="field">
                <label>Statement ending date</label>
                <input
                  type="date"
                  value={statementEndingDate}
                  onChange={(e) => setStatementEndingDate(e.target.value)}
                />
              </div>
              <div className="field">
                <label>Statement ending balance</label>
                <input
                  type="number"
                  step={0.01}
                  value={statementEndingBalance}
                  onChange={(e) => setStatementEndingBalance(Number(e.target.value))}
                  placeholder="From your statement"
                />
              </div>
            </div>
            <div style={{ marginTop: 14 }}>
              <button className="btn btn-primary" onClick={startReconcile}>
                Start reconciling
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-4" style={{ marginBottom: 16 }}>
            <div className="panel stat">
              <div className="stat-label">Beginning balance</div>
              <div className="stat-value" style={{ fontSize: '1.2rem' }}>
                {money(beginningBalance)}
              </div>
              <div className="stat-hint">Last reconciled / computed</div>
            </div>
            <div className="panel stat">
              <div className="stat-label">Cleared balance</div>
              <div className="stat-value" style={{ fontSize: '1.2rem' }}>
                {money(clearedBalance)}
              </div>
              <div className="stat-hint">Beginning + cleared</div>
            </div>
            <div className="panel stat">
              <div className="stat-label">Statement ending</div>
              <div className="stat-value" style={{ fontSize: '1.2rem' }}>
                {money(statementEndingBalance)}
              </div>
              <div className="stat-hint">{shortDate(statementEndingDate)}</div>
            </div>
            <div className={`panel stat ${Math.abs(difference) < 0.001 ? 'positive' : 'warning'}`}>
              <div className="stat-label">Difference</div>
              <div className="stat-value" style={{ fontSize: '1.2rem' }}>
                {money(difference, { signed: true })}
              </div>
              <div className="stat-hint">
                {Math.abs(difference) < 0.001 ? 'Ready to finish' : 'Must be $0.00'}
              </div>
            </div>
          </div>

          <div className="panel" style={{ marginBottom: 16 }}>
            <div className="panel-pad">
              <div className="form-grid two">
                <div className="field">
                  <label>Beginning balance</label>
                  <input
                    type="number"
                    step={0.01}
                    value={beginningBalance}
                    onChange={(e) => setBeginningBalance(Number(e.target.value))}
                  />
                </div>
                <div className="field">
                  <label>Statement ending balance</label>
                  <input
                    type="number"
                    step={0.01}
                    value={statementEndingBalance}
                    onChange={(e) => setStatementEndingBalance(Number(e.target.value))}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="panel" style={{ marginBottom: 16 }}>
            <div className="panel-head" style={{ flexWrap: 'wrap', gap: 10 }}>
              <h2>
                {account?.name} — uncleared through {shortDate(statementEndingDate)}
              </h2>
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
                    <th>Description</th>
                    <th>Type</th>
                    <th className="num">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {uncleared.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={!!cleared[t.id]}
                          onChange={() => toggle(t.id)}
                          aria-label={`Clear ${t.description}`}
                        />
                      </td>
                      <td>{shortDate(t.date)}</td>
                      <td style={{ fontWeight: 600 }}>{t.description}</td>
                      <td style={{ textTransform: 'capitalize' }}>{t.type.replace(/_/g, ' ')}</td>
                      <td
                        className="num"
                        style={{ color: t.amount < 0 ? 'var(--coral)' : 'var(--sea)' }}
                      >
                        {money(t.amount, { signed: true })}
                      </td>
                    </tr>
                  ))}
                  {uncleared.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="empty">
                        No uncleared transactions through this date.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            {error ? (
              <div className="panel-pad" style={{ color: 'var(--coral)', fontWeight: 600 }}>
                {error}
              </div>
            ) : null}
            <div
              className="panel-pad"
              style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}
            >
              <button className="btn btn-ghost" onClick={() => setStarted(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={finish}
                disabled={Math.abs(difference) > 0.001}
              >
                Finish now
              </button>
            </div>
          </div>
        </>
      )}

      <div className="panel">
        <div className="panel-head">
          <h2>Reconciliation history</h2>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Account</th>
                <th>Statement date</th>
                <th className="num">Ending balance</th>
                <th>Status</th>
                <th>Completed</th>
              </tr>
            </thead>
            <tbody>
              {history.map((r) => (
                <tr key={r.id}>
                  <td>{state.accounts.find((a) => a.id === r.accountId)?.name}</td>
                  <td>{shortDate(r.statementEndingDate)}</td>
                  <td className="num">{money(r.statementEndingBalance)}</td>
                  <td>
                    <StatusBadge status={r.status} />
                  </td>
                  <td>{r.completedAt ? shortDate(r.completedAt) : '—'}</td>
                </tr>
              ))}
              {history.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty">
                    No completed reconciliations yet.
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
