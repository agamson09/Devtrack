import { useState, useEffect, useCallback } from 'react'
import Head from 'next/head'

function StatusRow({ label, ok, detail, pending }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-gray-800 last:border-0">
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        {detail && <p className="text-xs text-gray-500 mt-0.5">{detail}</p>}
      </div>
      {pending ? (
        <span className="text-xs text-gray-500 animate-pulse">checking…</span>
      ) : ok ? (
        <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-3 py-1 whitespace-nowrap">OK</span>
      ) : (
        <span className="text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/30 rounded-full px-3 py-1 whitespace-nowrap">MISSING</span>
      )}
    </div>
  )
}

export default function SetupPage() {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [initting, setInitting] = useState(false)
  const [message, setMessage] = useState(null)
  const [useCustomAdmin, setUseCustomAdmin] = useState(false)
  const [admin, setAdmin] = useState({ name: '', email: '', password: '' })

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/system/db-status')
      setStatus(await res.json())
    } catch {
      setStatus({ mysql: false, error: 'FETCH_FAILED' })
    }
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  async function runSetup(e) {
    e?.preventDefault()
    setInitting(true)
    setMessage(null)
    try {
      const body = useCustomAdmin ? admin : {}
      const res = await fetch('/api/system/init-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Setup failed' })
      } else {
        setMessage({ type: 'success', text: data.message })
      }
    } catch {
      setMessage({ type: 'error', text: 'Could not reach the server.' })
    }
    setInitting(false)
    refresh()
  }

  const ready = status?.ready
  const needsInit = status?.mysql && !status?.tablesReady
  const needsAdmin = status?.tablesReady && status?.userCount === 0

  return (
    <>
      <Head>
        <title>Setup — DevTrack</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20 mx-auto mb-4">
              <i className="fa-solid fa-database text-xl"></i>
            </div>
            <h1 className="text-2xl font-bold">DevTrack Setup</h1>
            <p className="text-gray-400 text-sm mt-1">First-run wizard — check MySQL, create the database, and set up an admin account.</p>
          </div>

          {/* Step 1: status */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-5">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-2">1 · System Check</h2>
            {loading ? (
              <p className="text-gray-500 text-sm animate-pulse">Checking database connection…</p>
            ) : (
              <>
                <StatusRow
                  label="MySQL server"
                  ok={status?.mysql}
                  detail={status?.mysql ? `Connected${status?.mysqlVersion ? ` · MySQL ${status.mysqlVersion}` : ''}` : `Unreachable (${status?.error || 'unknown'})`}
                />
                <StatusRow
                  label={`Database "${status?.dbName || 'devtrack'}"`}
                  ok={status?.dbExists}
                  detail={status?.dbExists ? 'Database exists' : 'Will be created during setup'}
                />
                <StatusRow
                  label="Schema (tables)"
                  ok={status?.tablesReady}
                  detail={status?.tablesReady ? `${status.tableCount} tables found` : 'No tables yet'}
                />
                <StatusRow
                  label="Admin account"
                  ok={status?.userCount > 0}
                  detail={status?.userCount > 0 ? `${status.userCount} user(s)` : 'No users yet'}
                />
              </>
            )}
          </div>

          {/* MySQL troubleshooting */}
          {!loading && !status?.mysql && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-5 mb-5 text-sm text-red-200">
              <p className="font-semibold mb-2">MySQL is not reachable. Checklist:</p>
              <ul className="list-disc list-inside space-y-1 text-red-300/90">
                <li>Is the MySQL service running? (Windows: <code className="bg-black/30 px-1 rounded">services.msc</code> → MySQL80 → Start)</li>
                <li>Are <code className="bg-black/30 px-1 rounded">DB_HOST / DB_PORT / DB_USER / DB_PASSWORD</code> in <code className="bg-black/30 px-1 rounded">.env.local</code> correct?</li>
                <li>Restart the server after editing <code className="bg-black/30 px-1 rounded">.env.local</code>.</li>
              </ul>
            </div>
          )}

          {/* Step 2: initialize */}
          {(needsInit || needsAdmin) && (
            <form onSubmit={runSetup} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-5">
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">2 · Initialize Database</h2>
              <p className="text-sm text-gray-400 mb-4">
                This will create the database (if missing), import <code className="bg-black/30 px-1 rounded">schema.sql</code>, and seed initial data.
              </p>

              <label className="flex items-center gap-2 text-sm text-gray-300 mb-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useCustomAdmin}
                  onChange={(e) => setUseCustomAdmin(e.target.checked)}
                  className="accent-indigo-500 w-4 h-4"
                />
                Create a custom admin account (otherwise the default <code className="bg-black/30 px-1 rounded">admin@devtrack.local / password</code> is used)
              </label>

              {useCustomAdmin && (
                <div className="space-y-3 mb-4">
                  <input
                    value={admin.name}
                    onChange={(e) => setAdmin({ ...admin, name: e.target.value })}
                    placeholder="Admin name"
                    required
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  />
                  <input
                    type="email"
                    value={admin.email}
                    onChange={(e) => setAdmin({ ...admin, email: e.target.value })}
                    placeholder="Admin email"
                    required
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  />
                  <input
                    type="password"
                    value={admin.password}
                    onChange={(e) => setAdmin({ ...admin, password: e.target.value })}
                    placeholder="Admin password (min. 8 characters)"
                    required
                    minLength={8}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={initting}
                className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 disabled:opacity-50 text-white font-semibold rounded-lg px-4 py-2.5 text-sm transition-all"
              >
                {initting ? 'Initializing…' : 'Run Setup'}
              </button>
            </form>
          )}

          {/* Step 3: done */}
          {!loading && ready && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-6 mb-5">
              <h2 className="text-sm font-semibold text-emerald-300 uppercase tracking-wider mb-2">Setup Complete</h2>
              <p className="text-sm text-emerald-200/90 mb-4">
                Database is ready with {status.tableCount} tables and {status.userCount} user(s).
                {status.userCount === 1 && !message?.text?.includes('custom admin') && (
                  <> Default login: <code className="bg-black/30 px-1 rounded">admin@devtrack.local</code> / <code className="bg-black/30 px-1 rounded">password</code> — change it after first login.</>
                )}
              </p>
              <a
                href="/login"
                className="inline-block bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-semibold rounded-lg px-5 py-2.5 text-sm transition-colors"
              >
                Go to Login →
              </a>
            </div>
          )}

          {message && (
            <div className={`rounded-xl border p-4 text-sm mb-5 ${message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200' : 'bg-red-500/10 border-red-500/30 text-red-200'}`}>
              {message.text}
            </div>
          )}

          <p className="text-center text-xs text-gray-600 mt-6">
            <a href="/" className="hover:text-gray-400">← Back to homepage</a>
          </p>
        </div>
      </div>
    </>
  )
}
