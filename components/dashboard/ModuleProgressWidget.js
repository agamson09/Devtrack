import { useState, useEffect } from 'react'

const MODULE_COLORS = {
  cable: '#3b82f6', sales: '#22c55e', stock: '#f59e0b', inventory: '#a855f7',
  estimator: '#ec4899', purchasing: '#06b6d4', logistic: '#14b8a6', logistik: '#2dd4bf',
  quotation: '#6366f1', quotation_tracking: '#818cf8', opname: '#f97316', project: '#ef4444',
  it: '#6b7280', tender: '#eab308', approval: '#84cc16', general: '#4b5563'
}

export default function ModuleProgressWidget() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/deploy/file-activity?days=7&limit=500')
      .then(r => r.json())
      .then(d => {
        const summary = d.summary || []
        const max = Math.max(...summary.map(s => s.count), 1)
        setData(summary.map(s => ({
          module: s.module,
          count: parseInt(s.count),
          created: parseInt(s.created),
          modified: parseInt(s.modified),
          pct: Math.round((parseInt(s.count) / max) * 100)
        })).sort((a, b) => b.count - a.count).slice(0, 8))
        setLoading(false)
      }).catch(() => setLoading(false))
  }, [])

  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
        <i className="fa-solid fa-chart-bar text-emerald-400"></i>
        Module Activity (7d)
      </h3>

      {loading ? (
        <div className="flex justify-center py-6"><i className="fa-solid fa-spinner fa-spin text-gray-500"></i></div>
      ) : data.length === 0 ? (
        <div className="text-center py-6 text-gray-500 text-xs">No data yet</div>
      ) : (
        <div className="space-y-3">
          {data.map(d => (
            <div key={d.module}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-300 capitalize">{d.module}</span>
                <span className="text-[10px] text-gray-500">{d.count} changes</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="h-2 rounded-full transition-all duration-500"
                  style={{ width: `${d.pct}%`, backgroundColor: MODULE_COLORS[d.module] || '#6b7280' }}
                ></div>
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-[9px] text-green-400">+{d.created} new</span>
                <span className="text-[9px] text-amber-400">~{d.modified} modified</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
