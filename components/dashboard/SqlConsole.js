import { useState, useEffect, useCallback } from 'react'

const EMPTY_CONN = { id: null, type: 'mysql', name: '', host: '', port: '3306', username: 'root', password: '' }
const DEFAULT_PORT = { mysql: '3306', postgres: '5432', mssql: '1433' }
const TYPE_LABEL = { mysql: 'MySQL', postgres: 'PostgreSQL', mssql: 'SQL Server' }
const MAX_ROWS_DISPLAY = 1000

export default function SqlConsole() {
  const [connections, setConnections] = useState([])
  const [selectedConn, setSelectedConn] = useState('local')
  const [manageOpen, setManageOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_CONN)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testInfo, setTestInfo] = useState(null)

  const [databases, setDatabases] = useState([])
  const [database, setDatabase] = useState('')
  const [sql, setSql] = useState('SELECT VERSION()')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const fetchConnections = useCallback(async () => {
    try {
      const res = await fetch('/api/system/db-connections')
      const data = await res.json()
      setConnections(data.connections || [])
    } catch {}
  }, [])

  useEffect(() => { fetchConnections() }, [fetchConnections])

  // When a remote host is picked, list its databases for the selector
  useEffect(() => {
    setDatabases([])
    setDatabase('')
    if (!selectedConn || selectedConn === 'local') return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/system/database?connection_id=${selectedConn}`)
        const data = await res.json()
        if (!cancelled && Array.isArray(data.databases)) {
          setDatabases(data.databases.map(d => d.name))
        }
      } catch {}
    })()
    return () => { cancelled = true }
  }, [selectedConn])

  async function saveConn(e) {
    e?.preventDefault()
    if (!form.name || !form.host || !form.username) return
    if (!form.id && !form.password) return
    setSaving(true)
    try {
      const res = await fetch('/api/system/db-connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan')
      await fetchConnections()
      setSelectedConn(data.id ?? form.id)
      setManageOpen(false)
      setForm(EMPTY_CONN)
    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function deleteConn(id) {
    if (!confirm('Hapus koneksi ini?')) return
    await fetch(`/api/system/db-connections?id=${id}`, { method: 'DELETE' }).catch(() => {})
    if (String(selectedConn) === String(id)) setSelectedConn('local')
    fetchConnections()
  }

  async function testConn(target = form) {
    setTesting(true)
    setTestInfo(null)
    try {
      const res = await fetch('/api/system/db-connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test', ...target }),
      })
      const data = await res.json()
      let dbs = []
      if (data.ok && target.id) {
        try {
          const r2 = await fetch(`/api/system/database?connection_id=${target.id}`)
          const d2 = await r2.json()
          dbs = (d2.databases || []).map(d => d.name)
        } catch {}
      }
      setTestInfo({ ok: data.ok, message: data.message, databases: dbs })
    } catch (err) {
      setTestInfo({ ok: false, message: err.message, databases: [] })
    } finally {
      setTesting(false)
    }
  }

  async function runQuery() {
    if (!sql.trim() || running) return
    setRunning(true)
    setError(null)
    try {
      const res = await fetch('/api/system/db-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connection_id: selectedConn, database: database || undefined, sql }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Query gagal')
      setResult(data)
    } catch (err) {
      setResult(null)
      setError(err.message)
    } finally {
      setRunning(false)
    }
  }

  function openEdit(c) {
    setForm({ id: c.id, type: c.type || 'mysql', name: c.name || '', host: c.host, port: String(c.port || DEFAULT_PORT[c.type || 'mysql']), username: c.username, password: '' })
  }

  const isRemote = selectedConn !== 'local'
  const selName = isRemote ? (connections.find(c => String(c.id) === String(selectedConn))?.name ?? '?') : 'Lokal (DevTrack)'

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="glass-panel p-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="sm:w-1/2">
            <label className="block text-[10px] text-gray-500 mb-1">Koneksi</label>
            <div className="flex gap-2">
              <select
                value={String(selectedConn)}
                onChange={(e) => setSelectedConn(e.target.value === 'local' ? 'local' : Number(e.target.value))}
                className="input-field !py-2 text-xs"
              >
                <option value="local">🏠 Lokal — DevTrack ({'{DB_NAME}'})</option>
                {connections.map(c => (
                  <option key={c.id} value={c.id}>{c.name} — {TYPE_LABEL[c.type || 'mysql']} — {c.username}@{c.host}:{c.port}</option>
                ))}
              </select>
              <button onClick={() => { setForm(EMPTY_CONN); setManageOpen(true) }}
                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white text-xs whitespace-nowrap transition-colors">
                <i className="fa-solid fa-gear mr-1"></i>Kelola
              </button>
            </div>
          </div>

          {isRemote && (
            <div className="sm:w-1/2">
              <label className="block text-[10px] text-gray-500 mb-1">Database</label>
              {databases.length > 0 ? (
                <select value={database} onChange={(e) => setDatabase(e.target.value)} className="input-field !py-2 text-xs">
                  <option value="">— pilih database —</option>
                  {databases.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              ) : (
                <input value={database} onChange={(e) => setDatabase(e.target.value)} placeholder="nama database (opsional)"
                  className="input-field !py-2 text-xs" />
              )}
            </div>
          )}
        </div>

        <div className="mt-3 relative">
          <textarea
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); runQuery() } }}
            placeholder="Tulis satu statement SQL... (Ctrl+Enter untuk jalankan)"
            rows={5}
            className="w-full bg-gray-900/80 border border-gray-700 rounded-lg px-4 py-3 font-mono text-sm text-emerald-100 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/60 resize-y"
          />
          <button
            onClick={runQuery}
            disabled={running || !sql.trim()}
            className="absolute bottom-3 right-3 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg text-white text-xs font-medium transition-colors shadow-lg"
          >
            {running ? <i className="fa-solid fa-spinner fa-spin mr-1"></i> : <i className="fa-solid fa-play mr-1"></i>}
            Run <kbd className="ml-1 opacity-70">Ctrl↵</kbd>
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/40 rounded-xl p-4 animate-fade-in">
          <p className="text-red-300 text-sm font-mono break-all"><i className="fa-solid fa-circle-exclamation mr-2"></i>{error}</p>
        </div>
      )}

      {/* Result */}
      {result && !error && (
        <div className="glass-panel overflow-hidden animate-fade-in-up">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/70">
            <p className="text-xs text-gray-400">
              <i className="fa-solid fa-table-cells mr-2 text-emerald-400"></i>
              Target: <span className="text-gray-200">{result.target}</span>
              &nbsp;·&nbsp; {result.total_rows ?? 0} baris
              {(result.affected != null) ? <> · <span className="text-amber-300">{result.affected} terpengaruh</span></> : null}
              &nbsp;·&nbsp; {result.duration_ms} ms
            </p>
            {result.truncated && (
              <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                ditampilkan {MAX_ROWS_DISPLAY} pertama
              </span>
            )}
          </div>

          {result.rows.length > 0 ? (
            <div className="overflow-auto max-h-[420px]">
              <table className="min-w-full text-xs">
                <thead className="sticky top-0">
                  <tr className="bg-gray-800">
                    {result.columns.map(col => (
                      <th key={col} className="text-left px-3 py-2.5 font-semibold text-gray-300 border-b border-gray-700 whitespace-nowrap">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, i) => (
                    <tr key={i} className={i % 2 ? 'bg-gray-800/40' : ''}>
                      {result.columns.map(col => (
                        <td key={col} className="px-3 py-2 text-gray-300 border-b border-gray-700/50 max-w-xs truncate" title={row[col] == null ? 'NULL' : String(row[col])}>
                          {row[col] == null ? <span className="text-gray-600 italic">NULL</span> : String(row[col])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-sm text-center py-8">{result.info || 'Query OK — tidak ada baris hasil.'}</p>
          )}
        </div>
      )}

      {/* Manage connections modal */}
      {manageOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setManageOpen(false)} />
          <div className="relative w-full max-w-lg glass-panel p-5 animate-scale-in max-h-[85vh] overflow-y-auto">
            <h3 className="text-white font-bold mb-4"><i className="fa-solid fa-database mr-2 text-emerald-400"></i>Kelola Koneksi Database</h3>

            <div className="space-y-2 mb-5">
              {connections.map(c => (
                <div key={c.id} className={`flex items-center justify-between px-3 py-2.5 rounded-lg border ${String(form.id) === String(c.id) ? 'border-emerald-500 bg-emerald-500/10' : 'border-gray-700 bg-gray-900/40'}`}>
                  <div className="min-w-0">
                    <p className="text-sm text-white font-medium truncate">{c.name} <span className="text-[9px] uppercase text-indigo-300 bg-indigo-500/10 border border-indigo-500/30 px-1 py-0.5 rounded-full ml-1">{TYPE_LABEL[c.type || 'mysql'] || 'MySQL'}</span></p>
                    <p className="text-[11px] text-gray-500 truncate">{c.username}@{c.host}:{c.port}</p>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <button onClick={() => testConn({ id: c.id })} disabled={testing}
                      className="p-1.5 text-gray-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-md transition-colors" title="Test">
                      <i className={`fa-solid ${testing ? 'fa-spinner fa-spin' : 'fa-wave-square'} text-xs`}></i>
                    </button>
                    <button onClick={() => openEdit(c)} className="p-1.5 text-gray-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-md transition-colors" title="Edit">
                      <i className="fa-solid fa-pen text-xs"></i>
                    </button>
                    <button onClick={() => deleteConn(c.id)} className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors" title="Hapus">
                      <i className="fa-solid fa-trash text-xs"></i>
                    </button>
                  </div>
                </div>
              ))}
              {connections.length === 0 && <p className="text-xs text-gray-500 text-center py-2">Belum ada koneksi tersimpan.</p>}
            </div>

            <form onSubmit={saveConn} className="space-y-3 border-t border-gray-700 pt-4">
              <p className="text-xs text-gray-400 font-semibold">{form.id ? `Edit: ${form.name}` : 'Tambah Koneksi'}</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-gray-500 mb-1">Tipe</label>
                  <select
                    value={form.type}
                    onChange={e => setForm(p => ({ ...p, type: e.target.value, port: DEFAULT_PORT[e.target.value] }))}
                    className="input-field !py-2 text-xs"
                  >
                    <option value="mysql">MySQL / MariaDB</option>
                    <option value="postgres">PostgreSQL</option>
                    <option value="mssql">SQL Server</option>
                  </select>
                </div>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Nama *" required className="input-field !py-2 text-xs" />
                <input value={form.host} onChange={e => setForm(p => ({ ...p, host: e.target.value }))} placeholder="Host / IP *" required className="input-field !py-2 text-xs" />
                <input value={form.port} onChange={e => setForm(p => ({ ...p, port: e.target.value }))} placeholder={`Port (${DEFAULT_PORT[form.type]})`} className="input-field !py-2 text-xs" />
                <input value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} placeholder="Username *" required className="input-field !py-2 text-xs" />
              </div>
              <div className="flex items-center gap-2">
                <input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  placeholder={form.id ? 'Password (kosongkan jika tetap)' : 'Password *'}
                  className="input-field !py-2 text-xs flex-1" />
                <button type="button" onClick={() => testConn(form)} disabled={testing || !form.host}
                  className="px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded-lg text-gray-200 text-xs whitespace-nowrap">
                  <i className={`fa-solid ${testing ? 'fa-spinner fa-spin' : 'fa-wave-square'} mr-1`}></i>Test
                </button>
              </div>
              {testInfo && (
                <div className={`rounded-lg px-3 py-2 text-xs ${testInfo.ok ? 'bg-emerald-900/30 text-emerald-300' : 'bg-red-900/30 text-red-300'}`}>
                  <p>{testInfo.ok ? '✅' : '❌'} {testInfo.message}</p>
                  {testInfo.ok && testInfo.databases.length > 0 && (
                    <p className="mt-1.5 text-gray-300">
                      <span className="text-[10px] uppercase text-gray-500 mr-1">Database:</span>
                      {testInfo.databases.map(d => (
                        <span key={d} className="inline-block bg-gray-800 text-gray-200 px-1.5 py-0.5 rounded mr-1 mb-0.5 font-mono">{d}</span>
                      ))}
                    </p>
                  )}
                </div>
              )}
              <div className="flex justify-end gap-2 pt-1">
                {form.id && <button type="button" onClick={() => setForm(EMPTY_CONN)} className="btn-secondary !py-1.5 !px-3 text-xs">Batal Edit</button>}
                <button type="submit" disabled={saving} className="btn-primary !py-1.5 !px-4 text-xs">
                  <i className="fa-solid fa-floppy-disk mr-1"></i>{form.id ? 'Update' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
