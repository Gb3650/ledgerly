import { useMemo, useState } from 'react';
import { money, shortDate } from '../lib/format';
import { StatusBadge } from '../components/StatusBadge';
import { useBooks } from '../store/BooksContext';

export function Banking() {
  const { state, matchTransaction, excludeTransaction } = useBooks();
  const banks = state.accounts.filter((a) => a.type === 'bank' || a.type === 'credit_card');
  const [accountId, setAccountId] = useState(banks[0]?.id ?? '');
  const [filter, setFilter] = useState<'for_review' | 'categorized' | 'all'>('for_review');
  const expenseAccounts = state.accounts.filter(
    (a) => a.type === 'expense' || a.type === 'cogs' || a.type === 'income' || a.type === 'accounts_receivable',
  );

  const txns = useMemo(() => {
    return state.transactions
      .filter((t) => t.accountId === accountId)
      .filter((t) => {
        if (filter === 'for_review') return !t.matched;
        if (filter === 'categorized') return t.matched;
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [state.transactions, accountId, filter]);

  const selected = banks.find((b) => b.id === accountId);
  const forReviewCount = state.transactions.filter((t) => t.accountId === accountId && !t.matched).length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Banking</h1>
          <p>Review downloaded transactions and keep your books in sync.</p>
        </div>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 16 }}>
        {banks.map((a) => (
          <button
            key={a.id}
            className="panel bank-card"
            onClick={() => setAccountId(a.id)}
            style={{
              textAlign: 'left',
              borderColor: a.id === accountId ? 'var(--sea)' : undefined,
              boxShadow: a.id === accountId ? '0 0 0 2px rgba(31,111,95,0.2)' : undefined,
            }}
          >
            <h3>{a.name}</h3>
            <div style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>{a.detailType}</div>
            <div className="bank-bal">{money(a.balance)}</div>
          </button>
        ))}
      </div>

      <div className="panel">
        <div className="panel-head" style={{ paddingBottom: 12 }}>
          <div>
            <h2>{selected?.name ?? 'Account'}</h2>
            <div style={{ color: 'var(--muted)', fontSize: '0.85rem', marginTop: 4 }}>
              {forReviewCount} transaction{forReviewCount === 1 ? '' : 's'} for review
            </div>
          </div>
          <div className="tabs" style={{ marginBottom: 0 }}>
            {(
              [
                ['for_review', 'For review'],
                ['categorized', 'Categorized'],
                ['all', 'All'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                className={`tab ${filter === id ? 'active' : ''}`}
                onClick={() => setFilter(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Payee</th>
                <th>Category / Action</th>
                <th className="num">Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {txns.map((t) => (
                <tr key={t.id}>
                  <td>{shortDate(t.date)}</td>
                  <td style={{ fontWeight: 600 }}>{t.description}</td>
                  <td>{t.payee ?? '—'}</td>
                  <td>
                    {t.matched ? (
                      state.accounts.find((a) => a.id === t.categoryAccountId)?.name ?? 'Categorized'
                    ) : (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <select
                          defaultValue=""
                          onChange={(e) => {
                            if (e.target.value) matchTransaction(t.id, e.target.value);
                          }}
                          style={{
                            border: '1px solid var(--line)',
                            borderRadius: 8,
                            padding: '6px 8px',
                            minWidth: 160,
                          }}
                        >
                          <option value="" disabled>
                            Categorize…
                          </option>
                          {expenseAccounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name}
                            </option>
                          ))}
                        </select>
                        <button className="btn btn-ghost btn-sm" onClick={() => excludeTransaction(t.id)}>
                          Exclude
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="num" style={{ color: t.amount < 0 ? 'var(--coral)' : 'var(--sea)' }}>
                    {money(t.amount, { signed: true })}
                  </td>
                  <td>
                    <StatusBadge status={t.matched ? 'matched' : 'unmatched'} />
                  </td>
                </tr>
              ))}
              {txns.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty">
                    Nothing here — switch tabs or pick another account.
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
