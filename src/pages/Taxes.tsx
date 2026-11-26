import { Link } from 'react-router-dom';

export function Taxes() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Taxes</h1>
          <p>Sales tax and year-end filings — coming in a later parity slice.</p>
        </div>
      </div>
      <div className="panel">
        <div className="panel-pad" style={{ lineHeight: 1.7 }}>
          <p style={{ marginTop: 0 }}>
            QuickBooks Online keeps <strong>Sales Tax</strong> and tax filings under Taxes. Ledgerly
            currently collects tax on invoices and sales receipts and shows sales tax payable on the
            balance sheet.
          </p>
          <ul style={{ margin: '12px 0', paddingLeft: 18, color: 'var(--ink-soft)' }}>
            <li>Automatic sales tax rates and agency setup</li>
            <li>Sales tax liability report &amp; filing workflow</li>
            <li>1099 contractor center</li>
          </ul>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link className="btn btn-primary" to="/settings#sales-tax">
              Sales tax settings
            </Link>
            <Link className="btn btn-ghost" to="/reports">
              View reports
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
