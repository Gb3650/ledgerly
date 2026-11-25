import { Link } from 'react-router-dom';
import { unpaidInvoices } from '../lib/accounting';
import { money, shortDate } from '../lib/format';
import { StatusBadge } from '../components/StatusBadge';
import { useBooks } from '../store/BooksContext';

export function Sales() {
  const { state } = useBooks();
  const sales = [...state.invoices].sort((a, b) => b.date.localeCompare(a.date));
  const open = unpaidInvoices(state.invoices);
  const paid = state.invoices.filter((i) => i.status === 'paid');
  const draft = state.invoices.filter((i) => i.status === 'draft');

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Sales</h1>
          <p>Track invoices and payments across your customers.</p>
        </div>
        <Link className="btn btn-primary" to="/invoices?new=1">
          New invoice
        </Link>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <div className="panel stat">
          <div className="stat-label">Open</div>
          <div className="stat-value">{money(open.reduce((s, i) => s + i.balance, 0))}</div>
          <div className="stat-hint">{open.length} invoices</div>
        </div>
        <div className="panel stat positive">
          <div className="stat-label">Paid (YTD)</div>
          <div className="stat-value">{money(paid.reduce((s, i) => s + i.total, 0))}</div>
          <div className="stat-hint">{paid.length} invoices</div>
        </div>
        <div className="panel stat">
          <div className="stat-label">Drafts</div>
          <div className="stat-value">{draft.length}</div>
          <div className="stat-hint">Ready to send</div>
        </div>
        <div className="panel stat warning">
          <div className="stat-label">Overdue</div>
          <div className="stat-value">
            {money(state.invoices.filter((i) => i.status === 'overdue').reduce((s, i) => s + i.balance, 0))}
          </div>
          <div className="stat-hint">Needs follow-up</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>All sales</h2>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>No.</th>
                <th>Customer</th>
                <th>Status</th>
                <th className="num">Total</th>
                <th className="num">Balance</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((inv) => {
                const customer = state.customers.find((c) => c.id === inv.customerId);
                return (
                  <tr key={inv.id}>
                    <td>{shortDate(inv.date)}</td>
                    <td>Invoice</td>
                    <td>
                      <Link to="/invoices" style={{ color: 'var(--sea)', fontWeight: 700 }}>
                        #{inv.number}
                      </Link>
                    </td>
                    <td>{customer?.name}</td>
                    <td>
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="num">{money(inv.total)}</td>
                    <td className="num">{money(inv.balance)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
