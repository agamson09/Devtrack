import { useState, useEffect, useRef } from 'react';
import Layout from '@/components/layout/Layout';
import Loading from '@/components/common/Loading';
import Toast from '@/components/common/Toast';
import SqlConsole from '@/components/dashboard/SqlConsole';
import { Database, Download, Trash2, RefreshCw, HardDrive, Table, ChevronDown, ChevronRight, RotateCcw, CheckSquare, Square, ShieldCheck, Upload } from 'lucide-react';

function formatSize(mb) {
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return `${mb} MB`;
}

const TYPE_BADGE = {
  mysql: 'bg-emerald-900/40 text-emerald-300 border-emerald-700/50',
  postgres: 'bg-sky-900/40 text-sky-300 border-sky-700/50',
  mssql: 'bg-amber-900/40 text-amber-300 border-amber-700/50',
};

function TypeBadge({ type }) {
  const t = (type || 'mysql').toLowerCase();
  return <span className={`text-[10px] border px-1.5 py-0.5 rounded-full uppercase font-semibold ${TYPE_BADGE[t] || TYPE_BADGE.mysql}`}>{t}</span>;
}

function DatabaseCard({ db, backups = [], onBackup, onBackupTsql, onRestore, onVerify, onExpandTables, tablesLoading, connType, backupMatches, selected, onSelect, backingDb, verifying }) {
  const [expanded, setExpanded] = useState(false);
  const dbBackups = backups.filter(b => backupMatches(db.name, b.filename));
  const isBacking = backingDb === db.name;
  const isMssql = connType === 'mssql';
  const tables = db.tables || [];

  function handleExpand() {
    const next = !expanded;
    setExpanded(next);
    if (next && db.tables === null && onExpandTables) onExpandTables(db.name);
  }

  return (
    <div className={`bg-gray-800 rounded-xl border overflow-hidden ${isBacking ? 'border-indigo-500' : 'border-gray-700'}`}>
      {isBacking && <div className="h-0.5 bg-indigo-500 animate-pulse" />}
      <div className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-gray-700/50 transition-colors" onClick={handleExpand}>
        <button onClick={(e) => { e.stopPropagation(); onSelect(db.name); }} className="flex-shrink-0">
          {selected ? <CheckSquare className="w-5 h-5 text-indigo-400" /> : <Square className="w-5 h-5 text-gray-500" />}
        </button>
        <div className="flex-shrink-0">
          <div className={`p-2 rounded-lg ${db.name === 'devtrack' ? 'bg-indigo-500' : 'bg-gray-600'}`}>
            <Database className="w-4 h-4 text-white" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white truncate">{db.name}</h3>
            {db.name === 'devtrack' && <span className="text-[10px] bg-indigo-600/30 text-indigo-300 px-1.5 py-0.5 rounded-full">APP</span>}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            {db.table_count ?? tables.length} tables &middot; {db.total_rows != null ? `${db.total_rows.toLocaleString()} rows` : '—'} &middot; {formatSize(db.total_size_mb || 0)}
          </p>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onBackup(db.name); }}
          disabled={isBacking}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs transition-colors flex-shrink-0"
        >
          {isBacking ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
          {isBacking ? 'Backing up...' : 'Backup'}
        </button>
        {isMssql && (
          <button
            onClick={(e) => { e.stopPropagation(); onBackupTsql(db.name); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs transition-colors flex-shrink-0"
            title="T-SQL BACKUP DATABASE ke disk server SQL Server"
          >
            .bak
          </button>
        )}
        {expanded ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
      </div>

      {expanded && (
        <div className="border-t border-gray-700">
          {tablesLoading === db.name ? (
            <div className="px-5 py-3 text-xs text-gray-400 flex items-center gap-2"><RefreshCw className="w-3 h-3 animate-spin" /> Loading tables...</div>
          ) : tables.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700/50">
                    <th className="text-left px-5 py-2 text-[10px] font-semibold text-gray-400 uppercase">Table</th>
                    <th className="text-right px-5 py-2 text-[10px] font-semibold text-gray-400 uppercase">Rows</th>
                    <th className="text-right px-5 py-2 text-[10px] font-semibold text-gray-400 uppercase">Data</th>
                    <th className="text-right px-5 py-2 text-[10px] font-semibold text-gray-400 uppercase">Index</th>
                    <th className="text-right px-5 py-2 text-[10px] font-semibold text-gray-400 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {db.tables.map((t) => (
                    <tr key={t.name} className="border-b border-gray-700/30 hover:bg-gray-700/30">
                      <td className="px-5 py-2 text-xs text-white font-medium">{t.name}</td>
                      <td className="px-5 py-2 text-xs text-gray-400 text-right">{(t.row_count || 0).toLocaleString()}</td>
                      <td className="px-5 py-2 text-xs text-gray-400 text-right">{t.data_mb} MB</td>
                      <td className="px-5 py-2 text-xs text-gray-400 text-right">{t.index_mb} MB</td>
                      <td className="px-5 py-2 text-xs text-white text-right font-medium">{t.total_mb} MB</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-5 py-3 text-xs text-gray-500">No tables</div>
          )}

          {dbBackups.length > 0 && (
            <div className="border-t border-gray-700/50">
              <div className="px-5 py-2 text-[10px] font-semibold text-gray-400 uppercase">Backups for {db.name}</div>
              {dbBackups.slice(0, 5).map((b) => (
                <div key={b.filename} className="flex items-center justify-between px-5 py-2 hover:bg-gray-700/30">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs text-white font-mono truncate">{b.filename}</span>
                    <span className="text-[10px] text-gray-500 flex-shrink-0">{b.size_mb} MB</span>
                    <span className="text-[10px] text-gray-500 flex-shrink-0">{new Date(b.created_at).toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => window.open(`/api/system/download?file=${b.filename}`, '_blank')} className="text-indigo-400 hover:text-indigo-300 p-1" title="Download">
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onVerify(b.filename)}
                      disabled={verifying === b.filename}
                      className="text-emerald-400 hover:text-emerald-300 p-1 disabled:opacity-50"
                      title="Verify"
                    >
                      {verifying === b.filename ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => onRestore(b.filename)} className="text-amber-400 hover:text-amber-300 p-1" title="Restore">
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function DatabasePage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [backingDb, setBackingDb] = useState(null);
  const [backingAll, setBackingAll] = useState(false);
  const [toast, setToast] = useState(null);
  const [selectedDbs, setSelectedDbs] = useState(new Set());
  const [restoreModal, setRestoreModal] = useState({ open: false, filename: '', targetDb: '' });
  const [restoring, setRestoring] = useState(false);
  const [verifying, setVerifying] = useState(null);
  const [verifyResult, setVerifyResult] = useState(null);
  const [uploadModal, setUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [tab, setTab] = useState('backup'); // backup | sql
  const fileInputRef = useRef(null);

  // Connections (Navicat-style)
  const [connections, setConnections] = useState([]);
  const [activeConn, setActiveConn] = useState('local');
  const [connModal, setConnModal] = useState(false);
  const [connForm, setConnForm] = useState({ id: null, type: 'mysql', name: '', host: '', port: '3306', username: 'root', password: '' });
  const [savingConn, setSavingConn] = useState(false);
  const [testingConn, setTestingConn] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [tablesLoading, setTablesLoading] = useState(null);
  const [tsqlModal, setTsqlModal] = useState({ open: false, db: '', path: '', busy: false });

  const activeType = activeConn === 'local'
    ? 'mysql'
    : (connections.find(c => String(c.id) === String(activeConn))?.type || 'mysql');

  useEffect(() => { fetchConnections(); }, []);
  useEffect(() => { fetchData(); }, [activeConn]);

  async function fetchConnections() {
    try {
      const res = await fetch('/api/system/db-connections');
      const d = await res.json();
      setConnections(d.connections || []);
    } catch {}
  }

  async function fetchData() {
    setLoading(true);
    try {
      const qs = activeConn !== 'local' ? `?connection_id=${activeConn}` : '';
      const res = await fetch('/api/system/database' + qs);
      if (res.ok) setData(await res.json());
      else {
        const d = await res.json().catch(() => ({}));
        setToast({ type: 'error', message: d.error || 'Failed to fetch database data' });
        if (activeConn !== 'local') setActiveConn('local');
      }
    } catch (err) {
      console.error('Failed to fetch DB data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadTables(dbName) {
    if (activeConn === 'local') return;
    setTablesLoading(dbName);
    try {
      const res = await fetch(`/api/system/database?connection_id=${activeConn}&database=${encodeURIComponent(dbName)}`);
      const d = await res.json();
      if (Array.isArray(d.tables)) {
        setData(prev => ({
          ...prev,
          databases: prev.databases.map(x => x.name === dbName
            ? { ...x, tables: d.tables, table_count: x.table_count ?? d.tables.length, total_rows: d.tables.reduce((s, t) => s + (Number(t.row_count) || 0), 0) }
            : x),
        }));
      }
    } catch {} finally {
      setTablesLoading(null);
    }
  }

  function backupMatches(dbName, filename) {
    if (activeConn === 'local') return filename.startsWith(dbName + '-');
    return filename.includes(`-conn${activeConn}-${dbName.replace(/[^\w.-]/g, '_')}-`);
  }

  function defaultPortFor(type) {
    return type === 'postgres' ? '5432' : type === 'mssql' ? '1433' : '3306';
  }

  async function saveConn(e) {
    e?.preventDefault();
    if (!connForm.name || !connForm.host || !connForm.username) return setToast({ type: 'error', message: 'Name, host, dan username wajib diisi' });
    if (!connForm.id && !connForm.password) return setToast({ type: 'error', message: 'Password wajib untuk koneksi baru' });
    setSavingConn(true);
    try {
      const res = await fetch('/api/system/db-connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(connForm),
      });
      const d = await res.json();
      if (d.success) {
        setToast({ type: 'success', message: 'Connection saved' });
        setConnForm({ id: null, type: 'mysql', name: '', host: '', port: '3306', username: 'root', password: '' });
        fetchConnections();
      } else {
        setToast({ type: 'error', message: d.error || 'Save failed' });
      }
    } catch {
      setToast({ type: 'error', message: 'Save failed' });
    } finally {
      setSavingConn(false);
    }
  }

  async function testConn() {
    setTestingConn(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/system/db-connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test', ...connForm }),
      });
      const d = await res.json();
      setTestResult(d);
    } catch {
      setTestResult({ ok: false, message: 'Test failed' });
    } finally {
      setTestingConn(false);
    }
  }

  async function deleteConn(id) {
    if (!confirm('Delete this connection?')) return;
    await fetch(`/api/system/db-connections?id=${id}`, { method: 'DELETE' }).catch(() => {});
    if (String(activeConn) === String(id)) setActiveConn('local');
    fetchConnections();
    if (activeConn === 'local') fetchData();
  }

  async function handleBackupSingle(dbName) {
    setBackingDb(dbName);
    try {
      const res = await fetch('/api/system/database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'backup', connection_id: activeConn, database: dbName })
      });
      const d = await res.json();
      if (d.success) {
        const r = d.results[0];
        setToast({ type: 'success', message: `Backup ${dbName}: ${r.filename}${r.size_mb != null ? ` (${r.size_mb} MB)` : ''}${r.mode === 'js' ? ' [JS dump]' : ''}` });
        fetchData();
      } else {
        setToast({ type: 'error', message: d.error || 'Backup failed' });
      }
    } catch {
      setToast({ type: 'error', message: 'Backup failed' });
    } finally {
      setBackingDb(null);
    }
  }

  function handleBackupTsql(dbName) {
    setTsqlModal({ open: true, db: dbName, path: '', busy: false });
  }

  async function handleBackupTsqlConfirm() {
    if (!tsqlModal.path.trim()) return setToast({ type: 'error', message: 'Path di server SQL Server wajib diisi (mis. C:\\Backups\\db.bak)' });
    setTsqlModal(m => ({ ...m, busy: true }));
    try {
      const res = await fetch('/api/system/database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'backup', connection_id: activeConn, database: tsqlModal.db, mode: 'tsql', remotePath: tsqlModal.path.trim() })
      });
      const d = await res.json();
      if (d.success) {
        setToast({ type: 'success', message: `T-SQL backup ${tsqlModal.db} -> ${tsqlModal.path.trim()} (di server SQL Server)` });
        setTsqlModal({ open: false, db: '', path: '', busy: false });
        fetchData();
      } else {
        setToast({ type: 'error', message: d.error || 'T-SQL backup failed' });
      }
    } catch {
      setToast({ type: 'error', message: 'T-SQL backup failed' });
    } finally {
      setTsqlModal(m => ({ ...m, busy: false }));
    }
  }

  async function handleBackupSelected() {
    const dbs = [...selectedDbs];
    if (dbs.length === 0) return setToast({ type: 'error', message: 'Select databases first' });
    setBackingAll(true);
    try {
      const res = await fetch('/api/system/database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'backup', connection_id: activeConn, databases: dbs })
      });
      const d = await res.json();
      if (d.success) {
        const names = d.results.map(r => r.database).join(', ');
        const totalMb = d.results.reduce((s, r) => s + (r.size_mb || 0), 0);
        setToast({ type: 'success', message: `Backed up ${names} (${totalMb} MB)` });
        setSelectedDbs(new Set());
        fetchData();
      } else {
        setToast({ type: 'error', message: d.error || 'Backup failed' });
      }
    } catch {
      setToast({ type: 'error', message: 'Backup failed' });
    } finally {
      setBackingAll(false);
    }
  }

  async function handleBackupAll() {
    if (!data?.databases) return;
    setBackingAll(true);
    try {
      const dbs = data.databases.map(d => d.name);
      const res = await fetch('/api/system/database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'backup', connection_id: activeConn, databases: dbs })
      });
      const d = await res.json();
      if (d.success) {
        const totalMb = d.results.reduce((s, r) => s + (r.size_mb || 0), 0);
        setToast({ type: 'success', message: `Backed up all ${d.results.length} databases (${totalMb} MB)` });
        fetchData();
      } else {
        setToast({ type: 'error', message: d.error || 'Backup failed' });
      }
    } catch {
      setToast({ type: 'error', message: 'Backup failed' });
    } finally {
      setBackingAll(false);
    }
  }

  async function handleRestore(filename) {
    setRestoreModal({ open: true, filename, targetDb: '', viaTsql: false, remotePath: '' });
  }

  async function handleRestoreConfirm() {
    const { filename, targetDb, viaTsql, remotePath } = restoreModal;
    setRestoring(true);
    try {
      const body = { action: 'restore', connection_id: activeConn, target_db: targetDb.trim() };
      if (viaTsql) {
        body.via = 'tsql';
        body.remotePath = remotePath.trim();
      } else {
        body.filename = filename;
      }
      const res = await fetch('/api/system/database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const d = await res.json();
      if (d.success) {
        setToast({ type: 'success', message: d.message });
        setRestoreModal({ open: false, filename: '', targetDb: '', viaTsql: false, remotePath: '' });
        fetchData();
      } else {
        setToast({ type: 'error', message: d.error || (d.errors?.length ? d.errors[0] : 'Restore failed') });
      }
    } catch {
      setToast({ type: 'error', message: 'Restore failed' });
    } finally {
      setRestoring(false);
    }
  }

  async function handleVerify(filename) {
    setVerifying(filename);
    setVerifyResult(null);
    try {
      const res = await fetch('/api/system/database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', filename })
      });
      const d = await res.json();
      if (d.error) {
        setToast({ type: 'error', message: d.error });
      } else {
        setVerifyResult(d);
      }
    } catch {
      setToast({ type: 'error', message: 'Verification failed' });
    } finally {
      setVerifying(null);
    }
  }

  async function handleUpload(file) {
    setUploading(true);
    setUploadResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/system/upload-backup', {
        method: 'POST',
        body: formData,
      });
      const d = await res.json();
      if (d.success) {
        setUploadResult(d);
        fetchData();
      } else {
        setToast({ type: 'error', message: d.error || 'Upload failed' });
      }
    } catch {
      setToast({ type: 'error', message: 'Upload failed' });
    } finally {
      setUploading(false);
    }
  }

  function handleFileDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) handleUpload(file);
  }

  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleCleanup() {
    if (!confirm('Delete backups older than 30 days?')) return;
    try {
      const res = await fetch('/api/system/database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cleanup' })
      });
      const d = await res.json();
      setToast({ type: 'success', message: `Deleted ${d.deleted} old backups` });
      fetchData();
    } catch {
      setToast({ type: 'error', message: 'Cleanup failed' });
    }
  }

  function toggleSelect(dbName) {
    setSelectedDbs(prev => {
      const next = new Set(prev);
      if (next.has(dbName)) next.delete(dbName);
      else next.add(dbName);
      return next;
    });
  }

  function toggleSelectAll() {
    if (!data?.databases) return;
    if (selectedDbs.size === data.databases.length) {
      setSelectedDbs(new Set());
    } else {
      setSelectedDbs(new Set(data.databases.map(d => d.name)));
    }
  }

  if (loading) return <Layout><Loading /></Layout>;

  const totalSize = data?.databases?.reduce((s, d) => s + parseFloat(d.total_size_mb || 0), 0) || 0;
  const totalTables = data?.databases?.reduce((s, d) => s + d.table_count, 0) || 0;

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Database className="w-6 h-6 text-indigo-400" />
            <h1 className="text-xl md:text-2xl font-bold text-white">Database Manager</h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {selectedDbs.size > 0 && (
              <button
                onClick={handleBackupSelected}
                disabled={backingAll}
                className="flex items-center gap-2 px-3 md:px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs md:text-sm transition-colors"
              >
                {backingAll ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                <span className="hidden sm:inline">Backup Selected</span> ({selectedDbs.size})
              </button>
            )}
            <button
              onClick={handleBackupAll}
              disabled={backingAll}
              className="flex items-center gap-2 px-3 md:px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs md:text-sm transition-colors"
            >
              {backingAll ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span className="hidden sm:inline">Backup</span> All
            </button>
            <button
              onClick={() => setUploadModal(true)}
              className="flex items-center gap-2 px-3 md:px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs md:text-sm transition-colors"
            >
              <Upload className="w-4 h-4" /> <span className="hidden sm:inline">Upload & Compare</span><span className="sm:hidden">Upload</span>
            </button>
            <button
              onClick={handleCleanup}
              className="flex items-center gap-2 px-3 md:px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs md:text-sm transition-colors"
            >
              <Trash2 className="w-4 h-4" /> <span className="hidden sm:inline">Cleanup Old</span><span className="sm:hidden">Cleanup</span>
            </button>
          </div>
        </div>

        {/* Connection bar (Navicat-style) */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-xs text-gray-400 uppercase font-semibold whitespace-nowrap">Connection</span>
            <select
              value={String(activeConn)}
              onChange={(e) => setActiveConn(e.target.value === 'local' ? 'local' : Number(e.target.value))}
              className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 min-w-0"
            >
              <option value="local">Local server ({activeType})</option>
              {connections.map(c => (
                <option key={c.id} value={c.id}>{c.name} — {c.host}:{c.port} ({c.type})</option>
              ))}
            </select>
            <TypeBadge type={activeType} />
          </div>
          <button
            onClick={() => { setConnModal(true); fetchConnections(); }}
            className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg text-xs transition-colors whitespace-nowrap"
          >
            <i className="fa-solid fa-plug"></i> Kelola Koneksi
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-gray-700/70">
          <button
            onClick={() => setTab('backup')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === 'backup' ? 'text-indigo-300 border-indigo-500' : 'text-gray-400 hover:text-gray-200 border-transparent'}`}
          >
            <i className="fa-solid fa-shield-halved mr-1.5"></i>Backup & Restore
          </button>
          <button
            onClick={() => setTab('sql')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === 'sql' ? 'text-indigo-300 border-indigo-500' : 'text-gray-400 hover:text-gray-200 border-transparent'}`}
          >
            <i className="fa-solid fa-terminal mr-1.5"></i>SQL Console
          </button>
        </div>

        {tab === 'sql' && <SqlConsole />}

        {tab === 'backup' && data && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-indigo-500"><HardDrive className="w-5 h-5 text-white" /></div>
                  <div>
                    <p className="text-xs text-gray-400">Total Size</p>
                    <p className="text-xl font-bold text-white">{formatSize(totalSize)}</p>
                  </div>
                </div>
              </div>
              <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-emerald-500"><Table className="w-5 h-5 text-white" /></div>
                  <div>
                    <p className="text-xs text-gray-400">Databases &middot; Tables</p>
                    <p className="text-xl font-bold text-white">{data.databases.length} DB &middot; {totalTables} Tables</p>
                  </div>
                </div>
              </div>
              <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-amber-500"><Database className="w-5 h-5 text-white" /></div>
                  <div>
                    <p className="text-xs text-gray-400">Backups</p>
                    <p className="text-xl font-bold text-white">{data.backups.length}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Database List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-lg font-semibold text-white">Databases</h2>
                <button onClick={toggleSelectAll} className="text-xs text-indigo-400 hover:text-indigo-300">
                  {selectedDbs.size === data.databases?.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              {data.databases.map((db) => (
                <DatabaseCard
                  key={db.name}
                  db={db}
                  backups={data.backups}
                  onBackup={handleBackupSingle}
                  onBackupTsql={handleBackupTsql}
                  onRestore={handleRestore}
                  onVerify={handleVerify}
                  onExpandTables={loadTables}
                  tablesLoading={tablesLoading}
                  connType={activeType}
                  backupMatches={backupMatches}
                  selected={selectedDbs.has(db.name)}
                  onSelect={toggleSelect}
                  backingDb={backingDb}
                  verifying={verifying}
                />
              ))}
            </div>

            {/* All Backups */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-700">
                <h2 className="text-lg font-semibold text-white">All Backups ({data.backups.length})</h2>
              </div>
              {data.backups.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Database className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p>No backups yet. Click "Backup Now" to create one.</p>
                </div>
              ) : (
                <div className="overflow-x-auto max-h-96 overflow-y-auto">
                  <table className="w-full">
                    <thead className="sticky top-0 bg-gray-800">
                      <tr className="border-b border-gray-700">
                        <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase">Filename</th>
                        <th className="text-right px-5 py-3 text-xs font-semibold text-gray-400 uppercase">Size</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase">Created</th>
                        <th className="text-center px-5 py-3 text-xs font-semibold text-gray-400 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.backups.map((b) => (
                        <tr key={b.filename} className="border-b border-gray-700/50 hover:bg-gray-700/50">
                          <td className="px-5 py-3 text-sm text-white font-mono">{b.filename}</td>
                          <td className="px-5 py-3 text-sm text-gray-400 text-right">{b.size_mb} MB</td>
                          <td className="px-5 py-3 text-sm text-gray-400">{new Date(b.created_at).toLocaleString('id-ID')}</td>
                          <td className="px-5 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button onClick={() => window.open(`/api/system/download?file=${b.filename}`, '_blank')} className="text-indigo-400 hover:text-indigo-300 p-1" title="Download">
                                <Download className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleVerify(b.filename)}
                                disabled={verifying === b.filename}
                                className="text-emerald-400 hover:text-emerald-300 p-1 disabled:opacity-50"
                                title="Verify"
                              >
                                {verifying === b.filename ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                              </button>
                              <button onClick={() => handleRestore(b.filename)} className="text-amber-400 hover:text-amber-300 p-1" title="Restore">
                                <RotateCcw className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {verifyResult && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4" onClick={() => setVerifyResult(null)}>
          <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h2 className="text-lg font-semibold text-white">Backup Verification</h2>
              </div>
              <button onClick={() => setVerifyResult(null)} className="text-gray-400 hover:text-white">&times;</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="text-xs text-gray-400 font-mono break-all">{verifyResult.filename}</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-700/50 rounded-lg p-3">
                  <p className="text-[10px] text-gray-400 uppercase">Database</p>
                  <p className="text-sm font-bold text-white">{verifyResult.database}</p>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-3">
                  <p className="text-[10px] text-gray-400 uppercase">Tables</p>
                  <p className="text-sm font-bold text-white">{verifyResult.table_count}</p>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-3">
                  <p className="text-[10px] text-gray-400 uppercase">Views</p>
                  <p className="text-sm font-bold text-white">{verifyResult.view_count}</p>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-3">
                  <p className="text-[10px] text-gray-400 uppercase">Total Rows</p>
                  <p className="text-sm font-bold text-white">{verifyResult.total_rows?.toLocaleString()}</p>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-3">
                  <p className="text-[10px] text-gray-400 uppercase">Size (compressed)</p>
                  <p className="text-sm font-bold text-white">{verifyResult.size_on_disk} MB</p>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-3">
                  <p className="text-[10px] text-gray-400 uppercase">Size (uncompressed)</p>
                  <p className="text-sm font-bold text-white">{verifyResult.size_uncompressed} MB</p>
                </div>
              </div>
              {verifyResult.tables?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 mb-2">Tables in backup ({verifyResult.tables.length})</p>
                  <div className="max-h-40 overflow-y-auto bg-gray-900 rounded-lg p-3">
                    <div className="flex flex-wrap gap-1.5">
                      {verifyResult.tables.map(t => (
                        <span key={t} className="text-[10px] bg-gray-700 text-gray-300 px-2 py-0.5 rounded">{t}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {verifyResult.views?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 mb-2">Views in backup ({verifyResult.views.length})</p>
                  <div className="max-h-20 overflow-y-auto bg-gray-900 rounded-lg p-3">
                    <div className="flex flex-wrap gap-1.5">
                      {verifyResult.views.map(v => (
                        <span key={v} className="text-[10px] bg-amber-900/30 text-amber-300 px-2 py-0.5 rounded">{v}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {restoreModal.open && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4" onClick={() => !restoring && setRestoreModal({ open: false, filename: '', targetDb: '', viaTsql: false, remotePath: '' })}>
          <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-700">
              <h2 className="text-lg font-semibold text-white">Restore Backup</h2>
            </div>
            <div className="p-5 space-y-4">
              {activeType === 'mssql' && (
                <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={restoreModal.viaTsql}
                    onChange={(e) => setRestoreModal(prev => ({ ...prev, viaTsql: e.target.checked }))}
                    className="accent-indigo-500 w-4 h-4"
                  />
                  Restore dari file .bak di server SQL Server (T-SQL RESTORE)
                </label>
              )}

              {restoreModal.viaTsql ? (
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Path file .bak di server SQL Server</label>
                  <input
                    value={restoreModal.remotePath}
                    onChange={(e) => setRestoreModal(prev => ({ ...prev, remotePath: e.target.value }))}
                    placeholder="C:\Backups\mydb.bak"
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              ) : (
                <div className="text-xs text-gray-400 font-mono break-all bg-gray-900 rounded-lg p-3">{restoreModal.filename}</div>
              )}

              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Restore sebagai database</label>
                <input
                  type="text"
                  value={restoreModal.targetDb}
                  onChange={(e) => setRestoreModal(prev => ({ ...prev, targetDb: e.target.value }))}
                  placeholder="e.g. app_backup"
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                />
                <p className="text-[10px] text-gray-500 mt-1">Only letters, numbers, underscores, and hyphens allowed</p>
              </div>
              {restoreModal.targetDb.trim() ? (
                <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-lg p-3">
                  <p className="text-xs text-emerald-400">Will create new database: <strong>{restoreModal.targetDb.trim()}</strong></p>
                  <p className="text-[10px] text-gray-400 mt-1">Original database will NOT be affected</p>
                </div>
              ) : (
                <div className="bg-amber-900/20 border border-amber-700/30 rounded-lg p-3">
                  <p className="text-xs text-amber-400">Warning: This will OVERWRITE the original database!</p>
                </div>
              )}
            </div>
            <div className="px-5 py-3 border-t border-gray-700 flex justify-end gap-2">
              <button
                onClick={() => setRestoreModal({ open: false, filename: '', targetDb: '', viaTsql: false, remotePath: '' })}
                disabled={restoring}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRestoreConfirm}
                disabled={restoring || (restoreModal.viaTsql && !restoreModal.remotePath.trim())}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg text-sm transition-colors"
              >
                {restoring ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                {restoring ? 'Restoring...' : 'Restore'}
              </button>
            </div>
          </div>
        </div>
      )}

      {uploadModal && !uploadResult && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4" onClick={() => !uploading && setUploadModal(false)}>
          <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Upload .sql / .sql.gz</h2>
              <button onClick={() => !uploading && setUploadModal(false)} className="text-gray-400 hover:text-white">&times;</button>
            </div>
            <div className="p-5">
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
                  dragOver ? 'border-emerald-400 bg-emerald-500/10' : 'border-gray-600 hover:border-gray-500 hover:bg-gray-700/50'
                }`}
              >
                {uploading ? (
                  <div className="space-y-3">
                    <RefreshCw className="w-10 h-10 text-indigo-400 mx-auto animate-spin" />
                    <p className="text-sm text-gray-300">Uploading & analyzing...</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Upload className="w-10 h-10 text-gray-500 mx-auto" />
                    <div>
                      <p className="text-sm text-white font-medium">Drop your backup file here</p>
                      <p className="text-xs text-gray-400 mt-1">or click to browse &middot; .sql or .sql.gz up to 500MB</p>
                    </div>
                  </div>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept=".sql,.sql.gz,.gz" className="hidden" onChange={handleFileSelect} />
            </div>
          </div>
        </div>
      )}

      {uploadResult && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4" onClick={() => setUploadResult(null)}>
          <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-3xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-700 flex items-center justify-between sticky top-0 bg-gray-800 z-10">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h2 className="text-lg font-semibold text-white">Upload Comparison</h2>
              </div>
              <button onClick={() => setUploadResult(null)} className="text-gray-400 hover:text-white">&times;</button>
            </div>
            <div className="p-5 space-y-5">
              <div className="text-xs text-gray-400 font-mono break-all bg-gray-900 rounded-lg p-3">
                {uploadResult.original_name}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-gray-700/50 rounded-lg p-3">
                  <p className="text-[10px] text-gray-400 uppercase">Database</p>
                  <p className="text-sm font-bold text-white">{uploadResult.database || 'Unknown'}</p>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-3">
                  <p className="text-[10px] text-gray-400 uppercase">Tables</p>
                  <p className="text-sm font-bold text-white">{uploadResult.table_count}</p>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-3">
                  <p className="text-[10px] text-gray-400 uppercase">Views</p>
                  <p className="text-sm font-bold text-white">{uploadResult.view_count}</p>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-3">
                  <p className="text-[10px] text-gray-400 uppercase">Total Rows</p>
                  <p className="text-sm font-bold text-white">{uploadResult.total_rows?.toLocaleString()}</p>
                </div>
              </div>

              {uploadResult.comparison && Object.keys(uploadResult.comparison).length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-white mb-3">Table Comparison (Upload vs Live DB)</h3>
                  <div className="bg-gray-900 rounded-lg overflow-hidden">
                    <div className="overflow-x-auto max-h-80 overflow-y-auto">
                      <table className="w-full">
                        <thead className="sticky top-0 bg-gray-900">
                          <tr className="border-b border-gray-700">
                            <th className="text-left px-4 py-2 text-[10px] font-semibold text-gray-400 uppercase">Table</th>
                            <th className="text-center px-4 py-2 text-[10px] font-semibold text-gray-400 uppercase">In Upload</th>
                            <th className="text-center px-4 py-2 text-[10px] font-semibold text-gray-400 uppercase">In Live DB</th>
                            <th className="text-right px-4 py-2 text-[10px] font-semibold text-gray-400 uppercase">Upload Rows</th>
                            <th className="text-right px-4 py-2 text-[10px] font-semibold text-gray-400 uppercase">Live Rows</th>
                            <th className="text-center px-4 py-2 text-[10px] font-semibold text-gray-400 uppercase">Match</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(uploadResult.comparison).sort(([a], [b]) => a.localeCompare(b)).map(([table, info]) => (
                            <tr key={table} className="border-b border-gray-700/30 hover:bg-gray-700/30">
                              <td className="px-4 py-2 text-xs text-white font-medium">{table}</td>
                              <td className="px-4 py-2 text-center">
                                {info.in_backup ? <span className="text-emerald-400 text-xs">&#10003;</span> : <span className="text-red-400 text-xs">&#10007;</span>}
                              </td>
                              <td className="px-4 py-2 text-center">
                                {info.in_live ? <span className="text-emerald-400 text-xs">&#10003;</span> : <span className="text-red-400 text-xs">&#10007;</span>}
                              </td>
                              <td className="px-4 py-2 text-right text-xs text-gray-300 font-mono">{info.backup_rows.toLocaleString()}</td>
                              <td className="px-4 py-2 text-right text-xs text-gray-300 font-mono">{info.live_rows.toLocaleString()}</td>
                              <td className="px-4 py-2 text-center">
                                {info.match ? (
                                  <span className="text-[10px] bg-emerald-900/30 text-emerald-400 px-1.5 py-0.5 rounded-full">Match</span>
                                ) : (
                                  <span className="text-[10px] bg-red-900/30 text-red-400 px-1.5 py-0.5 rounded-full">Diff ({info.live_rows - info.backup_rows > 0 ? '+' : ''}{(info.live_rows - info.backup_rows).toLocaleString()})</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => { setUploadResult(null); setUploadModal(true); }}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors"
                >
                  Upload Another
                </button>
                <button
                  onClick={() => setUploadResult(null)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {connModal && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4" onClick={() => setConnModal(false)}>
          <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Kelola Koneksi Database</h2>
              <button onClick={() => setConnModal(false)} className="text-gray-400 hover:text-white">&times;</button>
            </div>
            <div className="p-5 space-y-5">
              {connections.length > 0 && (
                <div className="space-y-2">
                  {connections.map(c => (
                    <div key={c.id} className="flex items-center gap-3 bg-gray-900 rounded-lg px-3 py-2.5">
                      <TypeBadge type={c.type} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium truncate">{c.name}</p>
                        <p className="text-[11px] text-gray-500 truncate">{c.username}@{c.host}:{c.port}</p>
                      </div>
                      <button
                        onClick={() => setConnForm({ id: c.id, type: c.type || 'mysql', name: c.name, host: c.host, port: String(c.port), username: c.username, password: '' })}
                        className="text-xs text-indigo-400 hover:text-indigo-300 px-2"
                      >
                        Edit
                      </button>
                      <button onClick={() => deleteConn(c.id)} className="text-red-400 hover:text-red-300 p-1" title="Delete">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={saveConn} className="bg-gray-900 rounded-xl p-4 space-y-3 border border-gray-700">
                <p className="text-xs font-semibold text-gray-300 uppercase">{connForm.id ? 'Edit Koneksi' : 'Koneksi Baru'}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-1">Tipe</label>
                    <select
                      value={connForm.type}
                      onChange={(e) => setConnForm({ ...connForm, type: e.target.value, port: defaultPortFor(e.target.value) })}
                      className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="mysql">MySQL / MariaDB</option>
                      <option value="postgres">PostgreSQL</option>
                      <option value="mssql">SQL Server</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-1">Nama *</label>
                    <input value={connForm.name} onChange={(e) => setConnForm({ ...connForm, name: e.target.value })} placeholder="Server Produksi" className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-1">Host *</label>
                    <input value={connForm.host} onChange={(e) => setConnForm({ ...connForm, host: e.target.value })} placeholder="192.168.1.10" className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-1">Port</label>
                    <input value={connForm.port} onChange={(e) => setConnForm({ ...connForm, port: e.target.value })} className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-1">Username *</label>
                    <input value={connForm.username} onChange={(e) => setConnForm({ ...connForm, username: e.target.value })} className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-1">Password {connForm.id ? '(kosongkan jika tetap)' : '*'}</label>
                    <input type="password" value={connForm.password} onChange={(e) => setConnForm({ ...connForm, password: e.target.value })} className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" />
                  </div>
                </div>
                {testResult && (
                  <div className={`text-xs rounded-lg px-3 py-2 ${testResult.ok ? 'bg-emerald-900/30 text-emerald-300' : 'bg-red-900/30 text-red-300'}`}>
                    {testResult.ok ? '&#10003; ' : '&#10007; '}{testResult.message}
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={testConn} disabled={testingConn} className="flex items-center gap-1.5 px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-200 rounded-lg text-xs transition-colors">
                    {testingConn ? <RefreshCw className="w-3 h-3 animate-spin" /> : <ShieldCheck className="w-3 h-3" />} Test
                  </button>
                  <button type="submit" disabled={savingConn} className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs transition-colors">
                    {savingConn ? <RefreshCw className="w-3 h-3 animate-spin" /> : null} {connForm.id ? 'Update' : 'Save'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {tsqlModal.open && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4" onClick={() => !tsqlModal.busy && setTsqlModal({ open: false, db: '', path: '', busy: false })}>
          <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-700">
              <h2 className="text-lg font-semibold text-white">T-SQL Backup — {tsqlModal.db}</h2>
            </div>
            <div className="p-5 space-y-3">
              <div className="bg-amber-900/20 border border-amber-700/30 rounded-lg p-3">
                <p className="text-xs text-amber-300">File .bak ditulis di <strong>disk server SQL Server</strong>, bukan di server DevTrack — tidak bisa didownload dari UI.</p>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Path di server SQL Server</label>
                <input
                  value={tsqlModal.path}
                  onChange={(e) => setTsqlModal(m => ({ ...m, path: e.target.value }))}
                  placeholder="C:\Backups\mydb.bak"
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
            <div className="px-5 py-3 border-t border-gray-700 flex justify-end gap-2">
              <button onClick={() => setTsqlModal({ open: false, db: '', path: '', busy: false })} disabled={tsqlModal.busy} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>
              <button onClick={handleBackupTsqlConfirm} disabled={tsqlModal.busy} className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg text-sm">
                {tsqlModal.busy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} BACKUP DATABASE
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
    </Layout>
  );
}
