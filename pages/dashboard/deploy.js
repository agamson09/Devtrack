import { useState, useEffect, useRef, useCallback } from 'react'
import Layout from '@/components/layout/Layout'
import { useAuth } from '@/components/AuthContext'
import DiffViewer from '@/components/deploy/DiffViewer'
import RemoteDeploy from '@/components/deploy/RemoteDeploy'
import GitDeploy from '@/components/deploy/GitDeploy'
import { io } from 'socket.io-client'

const STATUS_COLORS = {
  pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  approved: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  deployed: 'bg-green-500/20 text-green-400 border-green-500/30',
  rolled_back: 'bg-red-500/20 text-red-400 border-red-500/30'
}

const STATUS_ICONS = {
  pending: 'fa-clock',
  approved: 'fa-check-circle',
  deployed: 'fa-rocket',
  rolled_back: 'fa-undo'
}

export default function DeployPage() {
  const { user } = useAuth()
  const [diff, setDiff] = useState(null)
  const [history, setHistory] = useState([])
  const [modules, setModules] = useState([])
  const [selectedFiles, setSelectedFiles] = useState([])
  const [moduleFilter, setModuleFilter] = useState('all')
  const [deployNote, setDeployNote] = useState('')
  const [deploying, setDeploying] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('git')
  const [backupStats, setBackupStats] = useState(null)
  const [diffFile, setDiffFile] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [historySearch, setHistorySearch] = useState('')
  const [historyLimit, setHistoryLimit] = useState(20)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [showDeployConfirm, setShowDeployConfirm] = useState(false)
  const [toasts, setToasts] = useState([])
  const [expandedDeploy, setExpandedDeploy] = useState(null)
  const [rollbackFiles, setRollbackFiles] = useState({})
  const [rollingBack, setRollingBack] = useState(false)
  const socketRef = useRef(null)
  const autoRefreshRef = useRef(null)

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000)
  }, [])

  function loadData() {
    setLoading(true)
    Promise.all([
      fetch('/api/deploy/diff?module=' + moduleFilter).then(r => r.json()),
      fetch('/api/deploy/history?limit=' + historyLimit).then(r => r.json()),
      fetch('/api/deploy/modules').then(r => r.json()),
      fetch('/api/deploy/backup').then(r => r.json())
    ]).then(([diffData, histData, modData, bakData]) => {
      setDiff(diffData)
      setHistory(histData.history || [])
      setModules(modData.modules || [])
      setBackupStats(bakData.stats)
      setLastUpdated(new Date())
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [moduleFilter, historyLimit])

  useEffect(() => {
    if (!user) return
    const socket = io({ transports: ['websocket'], auth: { token: localStorage.getItem('token') } })
    socketRef.current = socket
    socket.on('deploy:executed', (data) => {
      if (data.deployer !== user.name) {
        addToast(`${data.deployer} deployed ${data.fileCount} file(s) to ${data.module}`, 'deploy')
        loadData()
      }
    })
    socket.on('deploy:file-changed', () => {
      loadData()
    })
    return () => { socket.disconnect() }
  }, [user])

  useEffect(() => {
    autoRefreshRef.current = setInterval(() => {
      if (tab === 'changes') loadData()
    }, 30000)
    return () => clearInterval(autoRefreshRef.current)
  }, [tab, moduleFilter])

  function toggleFile(file) {
    setSelectedFiles(prev =>
      prev.includes(file) ? prev.filter(f => f !== file) : [...prev, file]
    )
  }

  function selectAll() {
    const pending = filteredFiles.filter(f => f.status === 'pending_deploy' || f.status === 'new')
    setSelectedFiles(pending.map(f => f.file))
  }

  const filteredFiles = (diff?.changed_files || []).filter(f => {
    if (searchQuery && !f.file.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })

  const filteredHistory = history.filter(h => {
    if (!historySearch) return true
    const q = historySearch.toLowerCase()
    if (h.deployed_by_name?.toLowerCase().includes(q)) return true
    if (h.module?.toLowerCase().includes(q)) return true
    if (h.note?.toLowerCase().includes(q)) return true
    if (h.files?.some(fp => fp.toLowerCase().includes(q))) return true
    return false
  })

  function openDeployConfirm() {
    if (selectedFiles.length === 0) return
    if (!deployNote.trim()) {
      addToast('Deploy note is required!', 'error')
      return
    }
    setShowDeployConfirm(true)
  }

  async function executeDeploy() {
    if (selectedFiles.length === 0) return
    setShowDeployConfirm(false)
    setDeploying(true)
    try {
      const detectedModule = moduleFilter !== 'all' ? moduleFilter : 'general'
      const res = await fetch('/api/deploy/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: selectedFiles,
          module: detectedModule,
          note: deployNote
        })
      })
      const data = await res.json()
      if (data.success) {
        setSelectedFiles([])
        setDeployNote('')
        loadData()
        addToast(`Deployed ${data.deployed_files.length} file(s) successfully!`, 'success')
      } else {
        addToast('Deploy failed: ' + (data.error || 'Unknown error'), 'error')
      }
    } catch (err) {
      addToast('Deploy failed: ' + err.message, 'error')
    }
    setDeploying(false)
  }

  async function rollback(deployLogId, specificFiles = null) {
    setRollingBack(true)
    try {
      const body = { deploy_log_id: deployLogId }
      if (specificFiles && specificFiles.length > 0) {
        body.files = specificFiles
      }
      const res = await fetch('/api/deploy/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await res.json()
      if (data.success) {
        loadData()
        addToast(`Rolled back ${data.restored_files} file(s)!`, 'success')
        setExpandedDeploy(null)
        setRollbackFiles(prev => { const n = { ...prev }; delete n[deployLogId]; return n })
      } else {
        addToast('Rollback failed: ' + (data.error || 'Unknown'), 'error')
      }
    } catch (err) {
      addToast('Rollback failed: ' + err.message, 'error')
    }
    setRollingBack(false)
  }

  function timeAgo(dateStr) {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    const diff = (new Date() - d) / 1000
    if (diff < 60) return 'just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return `${Math.floor(diff / 86400)}d ago`
  }

  function toggleRollbackFile(deployId, filePath) {
    setRollbackFiles(prev => {
      const current = prev[deployId] || []
      const next = current.includes(filePath) ? current.filter(f => f !== filePath) : [...current, filePath]
      return { ...prev, [deployId]: next }
    })
  }

  if (!user) return null

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Deploy Manager</h1>
            <p className="text-sm text-gray-500 mt-1">Compare dev & prod, backup, and deploy files</p>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="text-[10px] text-gray-600">Updated {timeAgo(lastUpdated)}</span>
            )}
            <button onClick={loadData} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors">
              <i className="fa-solid fa-refresh mr-1"></i>Refresh
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 text-center">
            <p className="text-2xl font-bold text-white">{diff?.summary?.total_files || 0}</p>
            <p className="text-[10px] text-gray-500 mt-1">Total Files</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 text-center">
            <p className="text-2xl font-bold text-amber-400">{diff?.summary?.pending_deploy || 0}</p>
            <p className="text-[10px] text-gray-500 mt-1">Pending Deploy</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 text-center">
            <p className="text-2xl font-bold text-green-400">{diff?.summary?.deployed || 0}</p>
            <p className="text-[10px] text-gray-500 mt-1">Up to Date</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 text-center">
            <p className="text-2xl font-bold text-blue-400">{backupStats?.total_files || 0}</p>
            <p className="text-[10px] text-gray-500 mt-1">Backups</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 text-center">
            <p className="text-2xl font-bold text-gray-400">{history.length}</p>
            <p className="text-[10px] text-gray-500 mt-1">Deploys</p>
          </div>
        </div>

        {/* Module filter + Search */}
        <div className="flex items-center gap-3 flex-wrap">
          <select value={moduleFilter} onChange={e => setModuleFilter(e.target.value)}
            className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="all">All Modules</option>
            {modules.map(m => (
              <option key={m.name} value={m.name}>{m.display_name}</option>
            ))}
          </select>
          {tab === 'changes' && (
            <div className="relative flex-1 max-w-xs">
              <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs"></i>
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search files..."
                className="w-full pl-8 pr-3 py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                  <i className="fa-solid fa-xmark text-xs"></i>
                </button>
              )}
            </div>
          )}
          {tab === 'history' && (
            <div className="relative flex-1 max-w-xs">
              <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs"></i>
              <input type="text" value={historySearch} onChange={e => setHistorySearch(e.target.value)}
                placeholder="Search history by file, person, module..."
                className="w-full pl-8 pr-3 py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              {historySearch && (
                <button onClick={() => setHistorySearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                  <i className="fa-solid fa-xmark text-xs"></i>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700">
          <button onClick={() => setTab('git')} className={`px-4 py-2 text-sm font-medium transition-colors ${tab === 'git' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-gray-500 hover:text-white'}`}>
            <i className="fa-brands fa-git-alt mr-1"></i>Git Deploy
          </button>
          <button onClick={() => setTab('changes')} className={`px-4 py-2 text-sm font-medium transition-colors ${tab === 'changes' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-gray-500 hover:text-white'}`}>
            <i className="fa-solid fa-code-compare mr-1"></i>Changes ({filteredFiles.length})
          </button>
          <button onClick={() => setTab('history')} className={`px-4 py-2 text-sm font-medium transition-colors ${tab === 'history' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-gray-500 hover:text-white'}`}>
            <i className="fa-solid fa-clock-rotate-left mr-1"></i>History ({filteredHistory.length})
          </button>
          <button onClick={() => setTab('remote')} className={`px-4 py-2 text-sm font-medium transition-colors ${tab === 'remote' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-gray-500 hover:text-white'}`}>
            <i className="fa-solid fa-server mr-1"></i>Remote Deploy
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><i className="fa-solid fa-spinner fa-spin text-gray-500 text-xl"></i></div>
        ) : tab === 'git' ? (
          <GitDeploy showToast={(type, message) => addToast(message, type)} />
        ) : tab === 'remote' ? (
          <RemoteDeploy />
        ) : tab === 'changes' ? (
          <>
            {/* Deploy actions */}
            {selectedFiles.length > 0 && (
              <div className="bg-indigo-600/10 border border-indigo-500/30 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-indigo-400 font-medium">{selectedFiles.length} file(s) selected</span>
                  <div className="flex gap-2">
                    <button onClick={() => setSelectedFiles([])} className="px-3 py-1 text-xs bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600">Clear</button>
                    <button onClick={openDeployConfirm} disabled={deploying}
                      className="px-4 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50 transition-colors">
                      {deploying ? <><i className="fa-solid fa-spinner fa-spin mr-1"></i>Deploying...</> : <><i className="fa-solid fa-rocket mr-1"></i>Deploy to Prod</>}
                    </button>
                  </div>
                </div>
                <input type="text" value={deployNote} onChange={e => setDeployNote(e.target.value)}
                  placeholder="Deploy note (required)..." className="w-full px-3 py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-white text-xs" />
              </div>
            )}

            {/* File list */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700">
                <span className="text-xs text-gray-500">{filteredFiles.length} file(s) {searchQuery ? `matching "${searchQuery}"` : 'changed (dev vs prod)'}</span>
                <button onClick={selectAll} className="text-[10px] text-indigo-400 hover:text-indigo-300">Select All Pending</button>
              </div>
              <div className="max-h-[500px] overflow-y-auto">
                {filteredFiles.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <i className="fa-solid fa-check-circle text-3xl text-green-500 mb-3"></i>
                    <p className="text-sm">{searchQuery ? 'No files match your search' : 'All files are in sync!'}</p>
                  </div>
                ) : (
                  filteredFiles.map(f => (
                    <div key={f.file}
                      className={`flex items-center gap-3 px-4 py-2.5 border-b border-gray-700/50 cursor-pointer transition-colors ${
                        selectedFiles.includes(f.file) ? 'bg-indigo-600/10' : 'hover:bg-gray-700/30'
                      }`}
                      onClick={() => toggleFile(f.file)}
                    >
                      <input type="checkbox" checked={selectedFiles.includes(f.file)} readOnly
                        className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-indigo-500 focus:ring-indigo-500" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white font-mono truncate">{f.file}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[9px] text-gray-500 capitalize">{f.module}</span>
                          {f.status === 'new' && <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">NEW</span>}
                          {f.status === 'pending_deploy' && <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">MODIFIED</span>}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-[10px] text-gray-500">Dev: {timeAgo(f.dev_modified)}</p>
                        <p className="text-[10px] text-gray-600">Prod: {f.prod_modified ? timeAgo(f.prod_modified) : 'N/A'}</p>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); setDiffFile(f.file) }}
                        className="text-gray-500 hover:text-indigo-400 transition-colors flex-shrink-0" title="View Diff">
                        <i className="fa-solid fa-code text-xs"></i>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        ) : (
          /* History tab */
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            <div className="max-h-[600px] overflow-y-auto">
              {filteredHistory.length === 0 ? (
                <div className="text-center py-12 text-gray-500 text-sm">{historySearch ? 'No history matches your search' : 'No deploy history'}</div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-700 text-left">
                      <th className="px-4 py-2 text-[10px] text-gray-500 font-medium">Date</th>
                      <th className="px-4 py-2 text-[10px] text-gray-500 font-medium">Module</th>
                      <th className="px-4 py-2 text-[10px] text-gray-500 font-medium">Files</th>
                      <th className="px-4 py-2 text-[10px] text-gray-500 font-medium">By</th>
                      <th className="px-4 py-2 text-[10px] text-gray-500 font-medium">Note</th>
                      <th className="px-4 py-2 text-[10px] text-gray-500 font-medium">Status</th>
                      <th className="px-4 py-2 text-[10px] text-gray-500 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.map(h => (
                      <>
                        <tr key={h.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                          <td className="px-4 py-2.5 text-xs text-gray-300">{timeAgo(h.created_at)}</td>
                          <td className="px-4 py-2.5"><span className="text-xs capitalize">{h.module}</span></td>
                          <td className="px-4 py-2.5 text-xs text-gray-400">
                            <button onClick={() => setExpandedDeploy(expandedDeploy === h.id ? null : h.id)} className="hover:text-indigo-400 transition-colors">
                              {h.files?.length || 0} <i className={`fa-solid fa-chevron-${expandedDeploy === h.id ? 'up' : 'down'} ml-1 text-[8px]`}></i>
                            </button>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-gray-400">{h.deployed_by_name}</td>
                          <td className="px-4 py-2.5 text-xs text-gray-500 max-w-[120px] truncate">{h.note || '-'}</td>
                          <td className="px-4 py-2.5">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${STATUS_COLORS[h.status]}`}>
                              <i className={`fa-solid ${STATUS_ICONS[h.status]} mr-1`}></i>
                              {h.status}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            {h.status === 'deployed' && (
                              <button onClick={() => rollback(h.id)}
                                disabled={rollingBack}
                                className="text-[10px] text-red-400 hover:text-red-300 disabled:opacity-50">
                                <i className="fa-solid fa-undo mr-1"></i>Rollback
                              </button>
                            )}
                          </td>
                        </tr>
                        {expandedDeploy === h.id && h.files && h.files.length > 0 && (
                          <tr key={h.id + '-expand'}>
                            <td colSpan={7} className="px-4 py-2 bg-gray-800/50">
                              <div className="space-y-1">
                                {h.files.map(fp => (
                                  <div key={fp} className="flex items-center gap-2 py-1">
                                    {h.status === 'deployed' && (
                                      <input type="checkbox" checked={(rollbackFiles[h.id] || []).includes(fp)}
                                        onChange={() => toggleRollbackFile(h.id, fp)}
                                        className="w-3 h-3 rounded bg-gray-700 border-gray-600 text-red-500 focus:ring-red-500" />
                                    )}
                                    <span className="text-[11px] text-gray-400 font-mono">{fp}</span>
                                  </div>
                                ))}
                                {h.status === 'deployed' && (
                                  <button onClick={() => rollback(h.id, rollbackFiles[h.id] || [])}
                                    disabled={rollingBack || !(rollbackFiles[h.id]?.length > 0)}
                                    className="mt-2 px-3 py-1 text-[10px] bg-red-600/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-600/30 disabled:opacity-30 transition-colors">
                                    <i className="fa-solid fa-undo mr-1"></i>
                                    Rollback {(rollbackFiles[h.id] || []).length || 'all'} selected file(s)
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            {history.length >= historyLimit && (
              <div className="border-t border-gray-700 p-3 text-center">
                <button onClick={() => setHistoryLimit(prev => prev + 20)} className="text-xs text-indigo-400 hover:text-indigo-300">
                  Load more history...
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {diffFile && <DiffViewer file={diffFile} onClose={() => setDiffFile(null)} />}

      {/* Deploy confirmation modal */}
      {showDeployConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowDeployConfirm(false)}>
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md border border-gray-700" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white mb-4">Confirm Deploy</h3>
            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Files:</span>
                <span className="text-white font-medium">{selectedFiles.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Module:</span>
                <span className="text-white capitalize">{moduleFilter !== 'all' ? moduleFilter : 'general'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Deployer:</span>
                <span className="text-white">{user?.name}</span>
              </div>
              <div className="text-sm">
                <span className="text-gray-400">Note:</span>
                <p className="text-white mt-1 p-2 bg-gray-700 rounded text-xs">{deployNote}</p>
              </div>
              <div className="text-[10px] text-gray-500 max-h-32 overflow-y-auto">
                {selectedFiles.map(f => <div key={f} className="font-mono truncate">{f}</div>)}
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowDeployConfirm(false)} className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg text-sm hover:bg-gray-600">Cancel</button>
              <button onClick={executeDeploy} disabled={deploying}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm disabled:opacity-50 transition-colors">
                {deploying ? <><i className="fa-solid fa-spinner fa-spin mr-1"></i>Deploying...</> : <><i className="fa-solid fa-rocket mr-1"></i>Deploy</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast notifications */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map(t => (
          <div key={t.id} className={`px-4 py-3 rounded-lg shadow-lg text-sm text-white flex items-center gap-2 animate-slide-in ${
            t.type === 'success' ? 'bg-green-600' : t.type === 'error' ? 'bg-red-600' : t.type === 'deploy' ? 'bg-indigo-600' : 'bg-gray-700'
          }`}>
            <i className={`fa-solid ${t.type === 'success' ? 'fa-check-circle' : t.type === 'error' ? 'fa-exclamation-circle' : t.type === 'deploy' ? 'fa-rocket' : 'fa-info-circle'}`}></i>
            {t.message}
          </div>
        ))}
      </div>
    </Layout>
  )
}
