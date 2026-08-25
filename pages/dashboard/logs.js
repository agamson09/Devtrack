import { useState, useEffect, useRef } from 'react'
import Layout from '@/components/layout/Layout'
import Loading from '@/components/common/Loading'

export default function LogsPage() {
  const [logs, setLogs] = useState([])
  const [logType, setLogType] = useState('out')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [processes, setProcesses] = useState([])
  const logRef = useRef(null)
  const intervalRef = useRef(null)

  useEffect(() => {
    fetchLogs()
    fetchProcesses()
  }, [logType])

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => { fetchLogs(); fetchProcesses() }, 5000)
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [autoRefresh, logType])

  async function fetchLogs() {
    try {
      let url = `/api/system/logs?type=${logType}&lines=500`
      if (search) url += `&search=${encodeURIComponent(search)}`
      const res = await fetch(url)
      const data = await res.json()
      setLogs(data.logs || [])
      setTotal(data.total || 0)
    } catch (err) {
      console.error('Failed to fetch logs:', err)
    } finally {
      setLoading(false)
    }
  }

  async function fetchProcesses() {
    try {
      const res = await fetch('/api/system/pm2')
      const data = await res.json()
      setProcesses(data.processes || [])
    } catch {}
  }

  function handleSearch(e) {
    e.preventDefault()
    fetchLogs()
  }

  function getLineColor(line) {
    if (/\berror\b|ERR!|Error:/i.test(line)) return 'text-red-400'
    if (/\bwarn\b|WARN|Warning/i.test(line)) return 'text-amber-400'
    if (/\bsuccess\b|ready|connected|online/i.test(line)) return 'text-emerald-400'
    if (/\binfo\b|INFO/i.test(line)) return 'text-blue-400'
    return 'text-gray-300'
  }

  function formatMemory(bytes) {
    if (!bytes) return '0 MB'
    return `${(bytes / 1024 / 1024).toFixed(0)} MB`
  }

  function formatUptime(ms) {
    if (!ms) return '-'
    const s = Math.floor((Date.now() - ms) / 1000)
    const d = Math.floor(s / 86400)
    const h = Math.floor((s % 86400) / 3600)
    const m = Math.floor((s % 3600) / 60)
    if (d > 0) return `${d}d ${h}h`
    if (h > 0) return `${h}h ${m}m`
    return `${m}m`
  }

  return (
    <Layout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Log Viewer</h1>
            <p className="text-gray-400 text-sm mt-1">View PM2 application logs</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setAutoRefresh(!autoRefresh)} className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${autoRefresh ? 'bg-emerald-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
              <i className={`fa-solid ${autoRefresh ? 'fa-pause' : 'fa-play'} mr-1`}></i>
              {autoRefresh ? 'Auto ON' : 'Auto OFF'}
            </button>
            <button onClick={() => { fetchLogs(); fetchProcesses() }} className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white text-sm transition-colors">
              <i className="fa-solid fa-refresh mr-1"></i> Refresh
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {processes.map(p => (
            <div key={p.name} className="bg-gray-800 rounded-xl border border-gray-700 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white font-medium text-sm">{p.name}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${p.status === 'online' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                  {p.status}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div><span className="text-gray-500">PID</span><p className="text-gray-300">{p.pid || '-'}</p></div>
                <div><span className="text-gray-500">CPU</span><p className="text-gray-300">{p.cpu}%</p></div>
                <div><span className="text-gray-500">RAM</span><p className="text-gray-300">{formatMemory(p.memory)}</p></div>
              </div>
              <div className="flex items-center justify-between mt-2 text-[10px] text-gray-500">
                <span>Uptime: {formatUptime(p.uptime)}</span>
                <span>Restarts: {p.restarts}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-700">
            <div className="flex bg-gray-700 rounded-lg overflow-hidden">
              <button onClick={() => setLogType('out')} className={`px-3 py-1.5 text-sm font-medium transition-colors ${logType === 'out' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}>Standard</button>
              <button onClick={() => setLogType('error')} className={`px-3 py-1.5 text-sm font-medium transition-colors ${logType === 'error' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'}`}>Error</button>
            </div>
            <form onSubmit={handleSearch} className="flex-1 flex gap-2">
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search logs..." className="flex-1 bg-gray-700 text-white text-sm rounded-lg px-3 py-1.5 border border-gray-600 focus:border-indigo-500 focus:outline-none" />
              <button type="submit" className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 rounded-lg text-white text-sm transition-colors"><i className="fa-solid fa-search"></i></button>
            </form>
            <span className="text-gray-500 text-xs">{logs.length} lines / {total} total</span>
          </div>

          <div ref={logRef} className="max-h-[600px] overflow-y-auto font-mono text-xs leading-5 p-4 bg-gray-900">
            {loading ? <Loading /> : logs.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No logs found</p>
            ) : (
              logs.map((line, i) => (
                <div key={i} className={`${getLineColor(line)} hover:bg-gray-800 px-2 -mx-2 rounded whitespace-pre-wrap break-all`}>{line}</div>
              ))
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}
