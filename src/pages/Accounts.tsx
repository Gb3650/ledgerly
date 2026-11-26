import { Fragment, useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { HubTabs, accountingHubTabs } from '../components/HubTabs';
import { Modal } from '../components/Modal';
import { accountTypeLabel, money } from '../lib/format';
import { useBooks } from '../store/BooksContext';
import type { Account, AccountType } from '../types';

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

const detailDefaults: Record<AccountType, string> = {
  bank: 'Checking',
  accounts_receivable: 'Accounts Receivable',
  other_current_asset: 'Other Current Assets',
  fixed_asset: 'Fixed Asset',
  accounts_payable: 'Accounts Payable',
  credit_card: 'Credit Card',
  other_current_liability: 'Other Current Liabilities',
  equity: 'Equity',
  income: 'Service/Fee Income',
  cogs: 'Supplies & Materials',
  expense: 'Office/General',
  other_income: 'Other Miscellaneous Income',
  other_expense: 'Other Miscellaneous Expense',
};

const emptyForm = {
  name: '',
  type: 'expense' as AccountType,
  detailType: detailDefaults.expense,
  number: '',
  isActive: true,
};

export function Accounts() {
  const { state, saveAccount, updateAccount } = useBooks();
  const [query, setQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.accounts.filter((a) => {
      if (!showInactive && !a.isActive) return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        a.number.includes(q) ||
        a.detailType.toLowerCase().includes(q) ||
        accountTypeLabel(a.type).toLowerCase().includes(q)
      );
    });
  }, [state.accounts, query, showInactive]);

  const grouped = order
    .map((type) => ({
      type,
      accounts: filtered.filter((a) => a.type === type),
    }))
    .filter((g) => g.accounts.length > 0);

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setModalOpen(true);
  }

  function openEdit(a: Account) {
    setEditing(a);
    setForm({
      name: a.name,
      type: a.type,
      detailType: a.detailType,
      number: a.number,
      isActive: a.isActive,
    });
    setError('');
    setModalOpen(true);
  }

  function onTypeChange(type: AccountType) {
    setForm((f) => ({
      ...f,
      type,
      detailType: f.detailType === detailDefaults[f.type] ? detailDefaults[type] : f.detailType,
    }));
  }

  function onSave() {
    if (!form.name.trim()) {
      setError('Account name is required.');
      return;
    }
    saveAccount({
      id: editing?.id,
      name: form.name,
      type: form.type,
      detailType: form.detailType || detailDefaults[form.type],
      number: form.number,
      isActive: form.isActive,
    });
    setModalOpen(false);
  }

  return (
    <div>
      <HubTabs tabs={accountingHubTabs} />
      <div className="page-header">
        <div>
          <h1>Chart of accounts</h1>
          <p>Accounting center — ledger structure behind your books.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openNew}>
          <Plus size={16} /> New
        </button>
      </div>

      <div className="list-toolbar">
        <div className="list-search" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Search size={15} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search accounts"
            aria-label="Search accounts"
            style={{ border: 'none', outline: 'none', width: '100%', background: 'transparent' }}
          />
        </div>
        <label className="check-inline">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          Include inactive
        </label>
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
                <th />
              </tr>
            </thead>
            <tbody>
              {grouped.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ color: 'var(--muted)' }}>
                    No accounts match this filter.
                  </td>
                </tr>
              ) : (
                grouped.map((g) => (
                  <Fragment key={g.type}>
                    <tr>
                      <td
                        colSpan={6}
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
                      <tr key={a.id} className={a.isActive ? undefined : 'row-inactive'}>
                        <td>{a.number}</td>
                        <td style={{ fontWeight: 600 }}>
                          {a.name}
                          {!a.isActive ? (
                            <span className="pill-muted" style={{ marginLeft: 8 }}>
                              Inactive
                            </span>
                          ) : null}
                        </td>
                        <td>{accountTypeLabel(a.type)}</td>
                        <td>{a.detailType}</td>
                        <td className="num">{money(a.balance)}</td>
                        <td className="num">
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => openEdit(a)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => updateAccount(a.id, { isActive: !a.isActive })}
                          >
                            {a.isActive ? 'Make inactive' : 'Make active'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen ? (
        <Modal
          title={editing ? 'Edit account' : 'New account'}
          onClose={() => setModalOpen(false)}
          footer={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)}>
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
              <label>Account name</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                autoFocus
              />
            </div>
            <div className="field">
              <label>Number</label>
              <input
                value={form.number}
                onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))}
                placeholder="e.g. 6700"
              />
            </div>
            <div className="field">
              <label>Account type</label>
              <select
                value={form.type}
                onChange={(e) => onTypeChange(e.target.value as AccountType)}
              >
                {order.map((t) => (
                  <option key={t} value={t}>
                    {accountTypeLabel(t)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Detail type</label>
              <input
                value={form.detailType}
                onChange={(e) => setForm((f) => ({ ...f, detailType: e.target.value }))}
              />
            </div>
          </div>
          <label className="check-inline" style={{ marginTop: 12 }}>
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
            />
            Account is active
          </label>
          {error ? (
            <div style={{ marginTop: 10, color: 'var(--danger, #b42318)', fontWeight: 600 }}>
              {error}
            </div>
          ) : null}
        </Modal>
      ) : null}
    </div>
  );
}
