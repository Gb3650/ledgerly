import { useRef, useState } from 'react';
import { useBooks } from '../store/BooksContext';

export function Settings() {
  const { state, updateCompany, exportBooks, importBooks, resetSampleData } = useBooks();
  const [company, setCompany] = useState(state.company);
  const [saved, setSaved] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

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

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <p>ABC LLC company profile and local backups for testing.</p>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
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
            <button className="btn btn-primary" onClick={save}>
              Save company
            </button>
            {saved ? <span style={{ color: 'var(--sea)', fontWeight: 600 }}>Saved</span> : null}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Data (test)</h2>
        </div>
        <div className="panel-pad">
          <p style={{ color: 'var(--muted)', marginTop: 0 }}>
            Books currently save in this browser. Download a backup so you don&apos;t lose test data.
            Cloud database persistence can be added next.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={downloadBackup}>
              Download backup
            </button>
            <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
              Restore backup
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => {
                if (confirm('Reset to ABC LLC sample starter data?')) resetSampleData();
              }}
            >
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
            <div style={{ marginTop: 10, fontWeight: 600, color: 'var(--sea)' }}>{importMsg}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
