import { Link, useParams } from 'react-router-dom';
import { money, shortDate } from '../lib/format';
import { StatusBadge } from '../components/StatusBadge';
import { useBooks } from '../store/BooksContext';

export function VendorDetail() {
  const { id } = useParams();
  const { state } = useBooks();
  const vendor = state.vendors.find((v) => v.id === id);

  if (!vendor) {
    return (
      <div className="panel panel-pad">
        <p>Vendor not found.</p>
        <Link to="/vendors">Back to vendors</Link>
      </div>
    );
  }

  const expenses = state.expenses
    .filter((e) => e.payeeId === vendor.id || e.payeeName === vendor.name)
    .sort((a, b) => b.date.localeCompare(a.date));
  const bills = (state.bills ?? [])
    .filter((b) => b.vendorId === vendor.id)
    .sort((a, b) => b.date.localeCompare(a.date));
  const pos = state.purchaseOrders
    .filter((p) => p.vendorId === vendor.id)
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div>
      <div className="page-header">
        <div>
          <div style={{ marginBottom: 6 }}>
            <Link to="/vendors" style={{ color: 'var(--sea)', fontWeight: 600, fontSize: '0.85rem' }}>
              ← Vendors
            </Link>
          </div>
          <h1>{vendor.name}</h1>
          <p>
            {vendor.category} · {vendor.email || 'No email'} · Open {money(vendor.balance)}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link className="btn btn-ghost" to={`/bills?new=1&vendor=${vendor.id}`}>
            New bill
          </Link>
          <Link className="btn btn-primary" to={`/purchase-orders?new=1`}>
            New PO
          </Link>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head">
          <h2>Bills</h2>
          <Link to="/pay-bills" style={{ color: 'var(--sea)', fontWeight: 600, fontSize: '0.85rem' }}>
            Pay bills
          </Link>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Date</th>
                <th>Bill #</th>
                <th>Due</th>
                <th>Status</th>
                <th className="num">Balance</th>
              </tr>
            </thead>
            <tbody>
              {bills.map((bill) => (
                <tr key={bill.id}>
                  <td>{shortDate(bill.date)}</td>
                  <td>
                    <Link to={`/bills?open=${bill.id}`} style={{ color: 'var(--sea)', fontWeight: 700 }}>
                      #{bill.number}
                    </Link>
                  </td>
                  <td>{shortDate(bill.dueDate)}</td>
                  <td>
                    <StatusBadge status={bill.status} />
                  </td>
                  <td className="num">{money(bill.balance)}</td>
                </tr>
              ))}
              {bills.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty">
                    No bills for this vendor.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 16 }}>
        <div className="panel">
          <div className="panel-head">
            <h2>Contact</h2>
          </div>
          <div className="panel-pad" style={{ lineHeight: 1.7 }}>
            <div>
              <strong>Phone</strong> {vendor.phone || '—'}
            </div>
            <div>
              <strong>Notes</strong> {vendor.notes || '—'}
            </div>
            <div>
              <strong>Vendor since</strong> {shortDate(vendor.createdAt)}
            </div>
          </div>
        </div>
        <div className="panel">
          <div className="panel-head">
            <h2>Purchase orders</h2>
          </div>
          <div className="table-wrap">
            <table className="data data-clickable">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>PO #</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {pos.map((po) => {
                  const loc = state.locations.find((l) => l.id === po.locationId);
                  return (
                    <tr key={po.id}>
                      <td>{shortDate(po.date)}</td>
                      <td>
                        <Link
                          className="linkish"
                          to={`/purchase-orders?open=${po.id}`}
                          style={{ textDecoration: 'none' }}
                        >
                          #{po.number}
                        </Link>
                      </td>
                      <td>{loc?.code}</td>
                      <td>
                        <StatusBadge status={po.status} />
                      </td>
                      <td className="num">{money(po.total)}</td>
                    </tr>
                  );
                })}
                {pos.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="empty">
                      No POs yet.
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
          <h2>Expenses</h2>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Date</th>
                <th>Memo</th>
                <th>Ref</th>
                <th>Status</th>
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id}>
                  <td>{shortDate(e.date)}</td>
                  <td>{e.memo || '—'}</td>
                  <td>{e.refNumber || '—'}</td>
                  <td>
                    <StatusBadge status={e.status} />
                  </td>
                  <td className="num">{money(e.amount)}</td>
                </tr>
              ))}
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty">
                    No expenses for this vendor.
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
