import { Link } from 'react-router-dom';

export function Apps() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Apps</h1>
          <p>Connect tools that sync with your books — App Center comes later.</p>
        </div>
      </div>
      <div className="panel">
        <div className="panel-pad" style={{ lineHeight: 1.7 }}>
          <p style={{ marginTop: 0 }}>
            QuickBooks Online lists third-party apps here. This Ledgerly build focuses on core
            bookkeeping first; integrations will land in a later PR.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            <Link className="btn btn-ghost" to="/banking">
              Banking
            </Link>
            <Link className="btn btn-ghost" to="/settings">
              Account and settings
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}