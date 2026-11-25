import { Fragment } from 'react';
import { accountTypeLabel, money } from '../lib/format';
import { useBooks } from '../store/BooksContext';
import type { AccountType } from '../types';

const order: AccountType[] = [
  'bank',
  'accounts_receivable',
  'other_current_asset',
  'fixed_asset',
  'accounts_payable',
  'credit_card',
  'other_current_liability',
  'equity',
  'income',
  'cogs',
  'expense',
  'other_income',
  'other_expense',
];

export function Accounts() {
  const { state } = useBooks();
  const grouped = order
    .map((type) => ({
      type,
      accounts: state.accounts.filter((a) => a.type === type && a.isActive),
    }))
    .filter((g) => g.accounts.length > 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Chart of accounts</h1>
          <p>The ledger structure behind your books.</p>
        </div>
      </div>

      <div className="panel">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Number</th>
                <th>Name</th>
                <th>Type</th>
                <th>Detail type</th>
                <th className="num">Balance</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map((g) => (
                <Fragment key={g.type}>
                  <tr>
                    <td
                      colSpan={5}
                      style={{
                        background: '#f3f8f6',
                        fontWeight: 800,
                        fontSize: '0.78rem',
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        color: 'var(--sea-deep)',
                      }}
                    >
                      {accountTypeLabel(g.type)}
                    </td>
                  </tr>
                  {g.accounts.map((a) => (
                    <tr key={a.id}>
                      <td>{a.number}</td>
                      <td style={{ fontWeight: 600 }}>{a.name}</td>
                      <td>{accountTypeLabel(a.type)}</td>
                      <td>{a.detailType}</td>
                      <td className="num">{money(a.balance)}</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
