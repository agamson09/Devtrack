import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function DeployStatusWidget() {
  const [diff, setDiff] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/deploy/diff?module=all').then(r => r.json()),
      fetch('/api/deploy/history?limit=5').then(r => r.json()),
      fetch('/api/deploy/backup').then(r => r.json())
    ]).then(([diffData, histData, bakData]) => {
      setDiff(diffData)
      setHistory(histData.history || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  function timeAgo(dateStr) {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    const diff = (new Date() - d) / 1000
    if (diff < 60) return 'just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return `${Math.floor(diff / 86400)}d ago`
  }

  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <i className="fa-solid fa-rocket text-blue-400"></i>
          Deploy Status
        </h3>
        <Link href="/dashboard/deploy" className="text-[10px] text-indigo-400 hover:text-indigo-300">
          View All <i className="fa-solid fa-arrow-right text-[8px]"></i>
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-6"><i className="fa-solid fa-spinner fa-spin text-gray-500"></i></div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="text-center p-2 rounded-lg bg-gray-700/50">
              <p className="text-lg font-bold text-amber-400">{diff?.summary?.pending_deploy || 0}</p>
              <p className="text-[10px] text-gray-500">Pending</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-gray-700/50">
              <p className="text-lg font-bold text-green-400">{diff?.summary?.deployed || 0}</p>
              <p className="text-[10px] text-gray-500">Deployed</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-gray-700/50">
              <p className="text-lg font-bold text-gray-400">{diff?.summary?.total_files || 0}</p>
              <p className="text-[10px] text-gray-500">Total</p>
            </div>
          </div>

          {history.length > 0 && (
            <div>
              <p className="text-[10px] text-gray-500 font-medium mb-2">RECENT DEPLOYS</p>
              <div className="space-y-1.5">
                {history.slice(0, 4).map(h => (
                  <div key={h.id} className="flex items-center gap-2 px-2 py-1.5 rounded bg-gray-700/30">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      h.status === 'deployed' ? 'bg-green-400' :
                      h.status === 'rolled_back' ? 'bg-red-400' : 'bg-amber-400'
                    }`}></span>
                    <span className="text-[10px] text-gray-300 truncate flex-1">
                      {h.files?.length || 0} files - {h.module}
                    </span>
                    <span className="text-[10px] text-gray-500">{timeAgo(h.deployed_at || h.created_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
