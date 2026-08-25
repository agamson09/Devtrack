import { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import RemoteTerminal from '@/components/deploy/RemoteTerminal'

const QUICK_COMMANDS = [
  { id: 'pull', label: 'Git Pull', icon: 'fa-code-pull-request', command: 'git pull origin main', color: 'bg-blue-600 hover:bg-blue-500' },
  { id: 'install', label: 'NPM Install', icon: 'fa-box-open', command: 'npm install --legacy-peer-deps', color: 'bg-purple-600 hover:bg-purple-500' },
  { id: 'build', label: 'Build', icon: 'fa-hammer', command: 'npm run build', color: 'bg-amber-600 hover:bg-amber-500' },
  { id: 'restart', label: 'Restart', icon: 'fa-rotate', command: 'pm2 restart devtrack', color: 'bg-green-600 hover:bg-green-500' },
]

const DEPLOY_SCRIPTS = [
  { id: 'full', label: 'Full Deploy', icon: 'fa-rocket', commands: ['git pull origin main', 'npm install --legacy-peer-deps', 'npm run build', 'pm2 restart devtrack'], color: 'bg-emerald-600 hover:bg-emerald-500' },
  { id: 'quick', label: 'Quick Deploy', icon: 'fa-bolt', commands: ['git pull origin main', 'pm2 restart devtrack'], color: 'bg-cyan-600 hover:bg-cyan-500' },
]

const EMPTY_FORM = { id: null, name: '', host: '', port: '22', username: 'root', password: '', project_path: '/var/www/devtrack' }

export default function RemoteDeploy() {
  const [configs, setConfigs] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [connectedHost, setConnectedHost] = useState('')
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [terminalOutput, setTerminalOutput] = useState('')
  const [customCommand, setCustomCommand] = useState('')
  const [runningScript, setRunningScript] = useState(null)
  const [manageOpen, setManageOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const socketRef = useRef(null)

  useEffect(() => {
    fetchConfigs()
    const socket = io({ transports: ['websocket'], auth: { token: localStorage.getItem('devtrack_socket_token') } })
    socketRef.current = socket

    socket.on('remote-deploy:connected', (data) => {
      setConnecting(false)
      setConnected(true)
      setConnectedHost(data?.host || '')
      setTerminalOutput('')
    })

    socket.on('remote-deploy:data', (data) => {
      setTerminalOutput(prev => prev + data)
    })

    socket.on('remote-deploy:error', (data) => {
      setTerminalOutput(prev => prev + `\r\n\x1b[31m[ERROR] ${data}\x1b[0m\r\n`)
      setConnecting(false)
      setConnected(false)
    })

    socket.on('remote-deploy:disconnected', (data) => {
      setTerminalOutput(prev => prev + `\r\n\x1b[33m[Disconnected] ${data.reason}\x1b[0m\r\n`)
      setConnected(false)
      setConnecting(false)
    })

    return () => {
      socket.emit('remote-deploy:disconnect')
      socket.disconnect()
      socketRef.current = null
    }
  }, [])

  async function fetchConfigs() {
    try {
      const res = await fetch('/api/deploy/remote-config')
      const data = await res.json()
      const list = data.configs || []
      setConfigs(list)
      setSelectedId(prev => (list.some(c => c.id === prev) ? prev : (list[0]?.id ?? null)))
    } catch {}
    setLoading(false)
  }

  function selectedConfig() {
    return configs.find(c => c.id === selectedId) || null
  }

  async function saveConfig(e) {
    e?.preventDefault()
    if (!form.host || !form.username) return
    if (!form.id && !form.password) return
    setSaving(true)
    try {
      const res = await fetch('/api/deploy/remote-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan')
      await fetchConfigs()
      setSelectedId(data.id ?? form.id)
      setManageOpen(false)
      setForm(EMPTY_FORM)
    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function deleteConfig(id) {
    if (!confirm('Hapus server ini dari daftar deploy?')) return
    try {
      await fetch(`/api/deploy/remote-config?id=${id}`, { method: 'DELETE' })
      if (selectedId === id) setSelectedId(null)
      fetchConfigs()
    } catch {}
  }

  async function testConnection(target = form) {
    setTesting(true)
    try {
      const res = await fetch('/api/deploy/remote-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test', ...target }),
      })
      const data = await res.json()
      alert(`${data.ok ? '✅' : '❌'} ${data.message}`)
    } catch (err) {
      alert(`❌ ${err.message}`)
    } finally {
      setTesting(false)
    }
  }

  function handleConnect() {
    const cfg = selectedConfig()
    if (!cfg && !configs.length) {
      setTerminalOutput('\r\n\x1b[31m[ERROR] Belum ada server tersimpan — klik "Kelola Server" untuk menambah.\x1b[0m\r\n')
      return
    }
    setConnecting(true)
    setTerminalOutput(`\r\n\x1b[36m[Connect] ${cfg.name} (${cfg.host}:${cfg.port}) → ${cfg.project_path}\x1b[0m\r\n`)
    socketRef.current.emit('remote-deploy:connect', {
      configId: cfg.id,
      projectPath: cfg.project_path,
    })
  }

  function handleDisconnect() {
    if (socketRef.current) {
      socketRef.current.emit('remote-deploy:disconnect')
    }
  }

  function executeCommand(command) {
    if (!socketRef.current || !connected) return
    socketRef.current.emit('remote-deploy:execute', { command })
  }

  function handleQuickCommand(cmd) {
    executeCommand(cmd.command)
  }

  async function handleDeployScript(script) {
    if (runningScript) return
    setRunningScript(script.id)
    setTerminalOutput(prev => prev + `\r\n\x1b[36m[Script] Running: ${script.label}...\x1b[0m\r\n`)

    for (let i = 0; i < script.commands.length; i++) {
      const cmd = script.commands[i]
      setTerminalOutput(prev => prev + `\r\n\x1b[33m[${i + 1}/${script.commands.length}] $ ${cmd}\x1b[0m\r\n`)
      executeCommand(cmd)
      await new Promise(resolve => setTimeout(resolve, 2000))
    }

    setTimeout(() => {
      setRunningScript(null)
      setTerminalOutput(prev => prev + `\r\n\x1b[32m[Script] ${script.label} completed!\x1b[0m\r\n`)
    }, 1000)
  }

  function handleCustomExecute() {
    if (!customCommand.trim()) return
    executeCommand(customCommand.trim())
    setCustomCommand('')
  }

  function openEdit(cfg) {
    setForm({ id: cfg.id, name: cfg.name || '', host: cfg.host, port: String(cfg.port || 22), username: cfg.username, password: '', project_path: cfg.project_path || '/var/www/devtrack' })
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <i className="fa-solid fa-spinner fa-spin text-gray-500 text-xl"></i>
      </div>
    )
  }

  const sel = selectedConfig()

  return (
    <div className="space-y-4">
      {/* Server selector */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-semibold text-sm">
            <i className="fa-solid fa-server mr-2 text-indigo-400"></i>
            Target Deploy
          </h3>
          <div className="flex items-center gap-2">
            {connected && (
              <button onClick={handleDisconnect}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded-lg text-white text-xs font-medium transition-colors">
                <i className="fa-solid fa-plug-circle-xmark mr-1"></i> Disconnect
              </button>
            )}
            <button onClick={() => { setForm(EMPTY_FORM); setManageOpen(true) }}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-white text-xs transition-colors">
              <i className="fa-solid fa-gear mr-1"></i> Kelola Server ({configs.length})
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          <div className="sm:col-span-6">
            <label className="block text-[10px] text-gray-500 mb-1">Server</label>
            <select
              value={selectedId ?? ''}
              onChange={(e) => setSelectedId(Number(e.target.value) || null)}
              disabled={connected || connecting}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-xs disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {configs.length === 0 && <option value="">— belum ada server —</option>}
              {configs.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name || c.host} — {c.username}@{c.host}{c.project_path ? ` : ${c.project_path}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-3 flex items-end">
            {!connected ? (
              <button onClick={handleConnect} disabled={connecting || !sel}
                className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg text-white text-xs font-medium transition-colors">
                {connecting ? (
                  <><i className="fa-solid fa-spinner fa-spin mr-1"></i>Connecting...</>
                ) : (
                  <><i className="fa-solid fa-plug mr-1"></i>Connect</>
                )}
              </button>
            ) : (
              <div className="w-full px-4 py-2 bg-green-600/20 border border-green-500/30 rounded-lg text-green-400 text-xs text-center font-medium truncate" title={connectedHost}>
                <i className="fa-solid fa-circle-check mr-1"></i>{connectedHost}
              </div>
            )}
          </div>
          {sel && !connected && (
            <div className="sm:col-span-3 flex items-end">
              <button onClick={() => testConnection({ id: sel.id })} disabled={testing}
                className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded-lg text-gray-200 text-xs font-medium transition-colors">
                {testing ? <><i className="fa-solid fa-spinner fa-spin mr-1"></i>Testing...</> : <><i className="fa-solid fa-wave-square mr-1"></i>Test Koneksi</>}
              </button>
            </div>
          )}
        </div>

        {sel && (
          <p className="mt-2 text-[10px] text-gray-500">
            <i className="fa-solid fa-folder-open mr-1"></i>Folder: <code className="text-gray-400">{sel.project_path || '(default server)'}</code>
            &nbsp;·&nbsp; terakhir connect: {sel.last_connected ? new Date(sel.last_connected).toLocaleString('id-ID') : 'belum pernah'}
          </p>
        )}
      </div>

      {/* Quick Deploy Actions */}
      {connected && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-semibold text-sm">
              <i className="fa-solid fa-bolt mr-2 text-amber-400"></i>
              Quick Actions
            </h3>
            {runningScript && (
              <span className="text-xs text-amber-400 flex items-center gap-1">
                <i className="fa-solid fa-spinner fa-spin"></i> Running script...
              </span>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-[10px] text-gray-500 mb-2">Individual Commands</p>
              <div className="flex gap-2 flex-wrap">
                {QUICK_COMMANDS.map(cmd => (
                  <button key={cmd.id} onClick={() => handleQuickCommand(cmd)}
                    disabled={!!runningScript}
                    className={`px-3 py-1.5 ${cmd.color} disabled:opacity-50 rounded-lg text-white text-xs font-medium transition-colors`}>
                    <i className={`fa-solid ${cmd.icon} mr-1`}></i>{cmd.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] text-gray-500 mb-2">Deploy Scripts</p>
              <div className="flex gap-2 flex-wrap">
                {DEPLOY_SCRIPTS.map(script => (
                  <button key={script.id} onClick={() => handleDeployScript(script)}
                    disabled={!!runningScript}
                    className={`px-4 py-2 ${script.color} disabled:opacity-50 rounded-lg text-white text-xs font-medium transition-colors`}>
                    <i className={`fa-solid ${script.icon} mr-1`}></i>{script.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Terminal Output */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden" style={{ height: '400px' }}>
        <RemoteTerminal output={terminalOutput} connected={connected} />
      </div>

      {/* Custom Command */}
      {connected && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
          <h3 className="text-white font-semibold text-sm mb-3">
            <i className="fa-solid fa-terminal mr-2 text-indigo-400"></i>
            Custom Command
          </h3>
          <div className="flex gap-2">
            <input type="text" value={customCommand} onChange={e => setCustomCommand(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCustomExecute() }}
              placeholder="Enter command..."
              className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <button onClick={handleCustomExecute}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white text-xs font-medium transition-colors">
              <i className="fa-solid fa-play mr-1"></i>Execute
            </button>
          </div>
        </div>
      )}

      {/* Manage servers modal */}
      {manageOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setManageOpen(false)} />
          <div className="relative w-full max-w-lg glass-panel p-5 animate-scale-in max-h-[85vh] overflow-y-auto">
            <h3 className="text-white font-bold mb-4">
              <i className="fa-solid fa-server mr-2 text-indigo-400"></i>Kelola Server Deploy
            </h3>

            {/* Existing list */}
            <div className="space-y-2 mb-5">
              {configs.map(c => (
                <div key={c.id} className={`flex items-center justify-between px-3 py-2.5 rounded-lg border ${form.id === c.id ? 'border-indigo-500 bg-indigo-500/10' : 'border-gray-700 bg-gray-900/40'}`}>
                  <button className="text-left min-w-0 flex-1" onClick={() => openEdit(c)}>
                    <p className="text-sm text-white font-medium truncate">{c.name || c.host}</p>
                    <p className="text-[11px] text-gray-500 truncate">{c.username}@{c.host}:{c.port} · {c.project_path}</p>
                  </button>
                  <div className="flex items-center gap-1 ml-2">
                    <button onClick={() => testConnection({ id: c.id })} disabled={testing}
                      className="p-1.5 text-gray-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-md transition-colors" title="Test koneksi">
                      <i className={`fa-solid ${testing ? 'fa-spinner fa-spin' : 'fa-wave-square'} text-xs`}></i>
                    </button>
                    <button onClick={() => openEdit(c)}
                      className="p-1.5 text-gray-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-md transition-colors" title="Edit">
                      <i className="fa-solid fa-pen text-xs"></i>
                    </button>
                    <button onClick={() => deleteConfig(c.id)}
                      className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors" title="Hapus">
                      <i className="fa-solid fa-trash text-xs"></i>
                    </button>
                  </div>
                </div>
              ))}
              {configs.length === 0 && <p className="text-xs text-gray-500 text-center py-2">Belum ada server tersimpan.</p>}
            </div>

            {/* Add / edit form */}
            <form onSubmit={saveConfig} className="space-y-3 border-t border-gray-700 pt-4">
              <p className="text-xs text-gray-400 font-semibold">{form.id ? `Edit: ${form.name || form.host}` : 'Tambah Server Baru'}</p>
              <div className="grid grid-cols-2 gap-3">
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Nama (mis. Produksi)"
                  className="input-field !py-2 text-xs" />
                <input value={form.host} onChange={e => setForm(p => ({ ...p, host: e.target.value }))} placeholder="Host / IP *" required
                  className="input-field !py-2 text-xs" />
                <input value={form.port} onChange={e => setForm(p => ({ ...p, port: e.target.value }))} placeholder="Port (22)"
                  className="input-field !py-2 text-xs" />
                <input value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} placeholder="Username *" required
                  className="input-field !py-2 text-xs" />
              </div>
              <input value={form.project_path} onChange={e => setForm(p => ({ ...p, project_path: e.target.value }))} placeholder="Folder proyek di server (/var/www/devtrack)"
                className="input-field !py-2 text-xs font-mono" />
              <div className="flex items-center gap-2">
                <input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  placeholder={form.id ? 'Password (kosongkan jika tidak diubah)' : 'Password SSH *'}
                  className="input-field !py-2 text-xs flex-1" />
                <button type="button" onClick={() => testConnection(form)} disabled={testing || !form.host}
                  className="px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded-lg text-gray-200 text-xs whitespace-nowrap">
                  <i className={`fa-solid ${testing ? 'fa-spinner fa-spin' : 'fa-wave-square'} mr-1`}></i>Test
                </button>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                {form.id && (
                  <button type="button" onClick={() => setForm(EMPTY_FORM)} className="btn-secondary !py-1.5 !px-3 text-xs">Batal Edit</button>
                )}
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
