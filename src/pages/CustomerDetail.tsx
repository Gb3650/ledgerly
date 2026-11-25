import { Link, useParams } from 'react-router-dom';
import { money, shortDate } from '../lib/format';
import { StatusBadge } from '../components/StatusBadge';
import { useBooks } from '../store/BooksContext';

export function CustomerDetail() {
  const { id } = useParams();
  const { state } = useBooks();
  const customer = state.customers.find((c) => c.id === id);

  if (!customer) {
    return (
      <div className="panel panel-pad">
        <p>Customer not found.</p>
        <Link to="/customers">Back to customers</Link>
      </div>
    );
  }

  const invoices = state.invoices
    .filter((i) => i.customerId === customer.id)
    .sort((a, b) => b.date.localeCompare(a.date));
  const payments = state.payments
    .filter((p) => invoices.some((i) => i.id === p.invoiceId))
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div>
      <div className="page-header">
        <div>
          <div style={{ marginBottom: 6 }}>
            <Link to="/customers" style={{ color: 'var(--sea)', fontWeight: 600, fontSize: '0.85rem' }}>
              ← Customers
            </Link>
          </div>
          <h1>{customer.name}</h1>
          <p>
            {customer.company ? `${customer.company} · ` : ''}
            {customer.email || 'No email'} · Open balance {money(customer.balance)}
          </p>
        </div>
        <Link className="btn btn-primary" to={`/invoices?new=1&customer=${customer.id}`}>
          New invoice
        </Link>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 16 }}>
        <div className="panel">
          <div className="panel-head">
            <h2>Contact</h2>
          </div>
          <div className="panel-pad" style={{ lineHeight: 1.7 }}>
            <div>
              <strong>Phone</strong> {customer.phone || '—'}
            </div>
            <div>
              <strong>Billing</strong> {customer.billingAddress || '—'}
            </div>
            <div>
              <strong>Notes</strong> {customer.notes || '—'}
            </div>
            <div>
              <strong>Customer since</strong> {shortDate(customer.createdAt)}
            </div>
          </div>
        </div>
        <div className="panel">
          <div className="panel-head">
            <h2>Payments</h2>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Invoice</th>
                  <th>Method</th>
                  <th className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {payments.slice(0, 8).map((p) => {
                  const inv = invoices.find((i) => i.id === p.invoiceId);
                  return (
                    <tr key={p.id}>
                      <td>{shortDate(p.date)}</td>
                      <td>#{inv?.number}</td>
                      <td>{p.method}</td>
                      <td className="num">{money(p.amount)}</td>
                    </tr>
                  );
                })}
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="empty">
                      No payments yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Invoices</h2>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Date</th>
                <th>No.</th>
                <th>Due</th>
                <th>Status</th>
                <th>Location</th>
                <th className="num">Total</th>
                <th className="num">Balance</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const loc = state.locations.find((l) => l.id === inv.locationId);
                return (
                  <tr key={inv.id}>
                    <td>{shortDate(inv.date)}</td>
                    <td style={{ fontWeight: 700 }}>#{inv.number}</td>
                    <td>{shortDate(inv.dueDate)}</td>
                    <td>
                      <StatusBadge status={inv.status} />
                    </td>
                    <td>{loc?.code ?? '—'}</td>
                    <td className="num">{money(inv.total)}</td>
                    <td className="num">{money(inv.balance)}</td>
                  </tr>
                );
              })}
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty">
                    No invoices for this customer.
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
