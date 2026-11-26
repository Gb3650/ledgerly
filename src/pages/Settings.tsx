import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Modal } from '../components/Modal';
import { useBooks } from '../store/BooksContext';

type SectionId = 'company' | 'billing' | 'sales' | 'sales-tax' | 'advanced';

const sections: Array<{ id: SectionId; label: string }> = [
  { id: 'company', label: 'Company' },
  { id: 'billing', label: 'Billing & subscription' },
  { id: 'sales', label: 'Sales' },
  { id: 'sales-tax', label: 'Sales tax' },
  { id: 'advanced', label: 'Advanced' },
];

export function Settings() {
  const { state, syncStatus, updateCompany, exportBooks, importBooks, resetSampleData } =
    useBooks();
  const navigate = useNavigate();
  const location = useLocation();
  const [section, setSection] = useState<SectionId>('company');
  const [company, setCompany] = useState(state.company);
  const [saved, setSaved] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const [resetOpen, setResetOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCompany(state.company);
  }, [state.company]);

  useEffect(() => {
    const hash = location.hash.replace(/^#/, '') as SectionId | '';
    if (hash && sections.some((s) => s.id === hash)) setSection(hash);
  }, [location.hash]);

  function save() {
    updateCompany(company);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function downloadBackup() {
    const blob = new Blob([exportBooks()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `abc-llc-ledgerly-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function onImportFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const ok = importBooks(String(reader.result ?? ''));
      setImportMsg(ok ? 'Backup restored.' : 'Invalid backup file.');
    };
    reader.readAsText(file);
  }

  function goSection(id: SectionId) {
    setSection(id);
    window.history.replaceState(null, '', `#${id}`);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Account and settings</h1>
          <p>Company profile, sales tax preferences, lists shortcuts, and backups.</p>
        </div>
      </div>

      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings sections">
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`settings-nav-item ${section === s.id ? 'active' : ''}`}
              onClick={() => goSection(s.id)}
            >
              {s.label}
            </button>
          ))}
        </nav>

        <div className="settings-main">
          {section === 'company' ? (
            <>
              <div className="panel" style={{ marginBottom: 16 }}>
                <div className="panel-head">
                  <h2>Data &amp; sync</h2>
                </div>
                <div className="panel-pad" style={{ lineHeight: 1.7 }}>
                  <div>
                    <strong>Status:</strong>{' '}
                    {syncStatus === 'cloud'
                      ? 'Synced to your private cloud database'
                      : syncStatus === 'syncing'
                        ? 'Saving to cloud…'
                        : syncStatus === 'error'
                          ? 'Cloud sync unavailable — using this browser'
                          : 'Saved in this browser (cloud when published with database)'}
                  </div>
                  <div style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
                    Always download a backup before major changes. Reset reloads starter ABC LLC
                    activity (invoices, POs, inventory).
                  </div>
                </div>
              </div>

              <div className="panel">
                <div className="panel-head">
                  <h2>Company</h2>
                </div>
                <div className="panel-pad">
                  <div className="form-grid two">
                    {(
                      [
                        ['name', 'Display name'],
                        ['legalName', 'Legal name'],
                        ['email', 'Email'],
                        ['phone', 'Phone'],
                        ['address', 'Address'],
                        ['city', 'City'],
                        ['state', 'State'],
                        ['zip', 'ZIP'],
                      ] as const
                    ).map(([key, label]) => (
                      <div className="field" key={key}>
                        <label>{label}</label>
                        <input
                          value={company[key]}
                          onChange={(e) => setCompany((c) => ({ ...c, [key]: e.target.value }))}
                        />
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'center' }}>
                    <button type="button" className="btn btn-primary" onClick={save}>
                      Save company
                    </button>
                    {saved ? (
                      <span style={{ color: 'var(--sea)', fontWeight: 600 }}>Saved</span>
                    ) : null}
                  </div>
                </div>
              </div>
            </>
          ) : null}

          {section === 'billing' ? (
            <div className="panel">
              <div className="panel-head">
                <h2>Billing &amp; subscription</h2>
              </div>
              <div className="panel-pad stub-empty">
                <p className="stub-empty-title">Stub</p>
                <p>
                  Subscription management is not wired yet. Ledgerly remains a local/cloud books
                  demo — not affiliated with Intuit QuickBooks.
                </p>
              </div>
            </div>
          ) : null}

          {section === 'sales' ? (
            <div className="panel">
              <div className="panel-head">
                <h2>Sales form settings</h2>
              </div>
              <div className="panel-pad stub-empty">
                <p className="stub-empty-title">Stub</p>
                <p>
                  Custom fields, delayed charges, and progress invoicing land later. Use Products
                  &amp; services and Customers from the gear menu for now.
                </p>
                <div className="stub-empty-actions">
                  <Link className="btn btn-ghost" to="/products">
                    Products and services
                  </Link>
                  <Link className="btn btn-ghost" to="/customers">
                    Customers
                  </Link>
                </div>
              </div>
            </div>
          ) : null}

          {section === 'sales-tax' ? (
            <div className="panel">
              <div className="panel-head">
                <h2>Sales tax</h2>
              </div>
              <div className="panel-pad stub-empty">
                <p className="stub-empty-title">Preferences stub</p>
                <p>
                  Company sales tax agency and rate setup is stubbed here. Left-nav Taxes remains a
                  center stub. Full filing/rates engine is out of scope for this PR.
                </p>
                <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
                  Boundary: journal entries, credit memos, refunds, and vendor credits are owned by
                  the journals/credits slice (LBO-9) — not this Settings/COA PR.
                </p>
                <div className="stub-empty-actions">
                  <Link className="btn btn-ghost" to="/taxes">
                    Open Tax center stub
                  </Link>
                  <Link className="btn btn-ghost" to="/accounts">
                    Chart of accounts
                  </Link>
                </div>
              </div>
            </div>
          ) : null}

          {section === 'advanced' ? (
            <div className="panel">
              <div className="panel-head">
                <h2>Backup, restore &amp; reset</h2>
              </div>
              <div className="panel-pad">
                <p style={{ color: 'var(--muted)', marginTop: 0 }}>
                  Books save in this browser and sync to your private cloud database when published.
                  Download a backup before major changes. Reset reloads the ABC LLC starter set and
                  overwrites cloud books when sync is available.
                </p>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-primary" onClick={downloadBackup}>
                    Download backup
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => fileRef.current?.click()}
                  >
                    Restore backup
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => setResetOpen(true)}>
                    Reset sample data
                  </button>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/json"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onImportFile(f);
                    e.target.value = '';
                  }}
                />
                {importMsg ? (
                  <div style={{ marginTop: 10, fontWeight: 600, color: 'var(--sea)' }}>
                    {importMsg}
                  </div>
                ) : null}
                <div style={{ marginTop: 18 }}>
                  <Link className="btn btn-ghost" to="/recurring">
                    Recurring transactions (stub)
                  </Link>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {resetOpen ? (
        <Modal
          title="Reset sample data?"
          onClose={() => setResetOpen(false)}
          footer={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setResetOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  resetSampleData();
                  setResetOpen(false);
                  navigate('/');
                }}
              >
                Reset to sample books
              </button>
            </>
          }
        >
          <p style={{ marginTop: 0, lineHeight: 1.6 }}>
            This replaces current books with the ABC LLC starter set in this browser and cloud sync
            when available.
          </p>
        </Modal>
      ) : null}
    </div>
  );
}
