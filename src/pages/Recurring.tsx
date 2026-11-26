import { Link } from 'react-router-dom';

/** Stub — full recurring templates land in a later PR (plan PR5). */
export function Recurring() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Recurring transactions</h1>
          <p>Automate invoices, expenses, and journal entries on a schedule.</p>
        </div>
      </div>
      <div className="panel">
        <div className="panel-pad stub-empty">
          <p className="stub-empty-title">Coming soon</p>
          <p>
            Recurring templates are stubbed from the gear menu for Accountant View parity. Full
            scheduling ships later. Journal entry templates stay with the journals/credits slice.
          </p>
          <div className="stub-empty-actions">
            <Link className="btn btn-primary" to="/settings#advanced">
              Account and settings
            </Link>
            <Link className="btn btn-ghost" to="/accounts">
              Chart of accounts
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
