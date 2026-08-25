import { useState, useEffect } from 'react'

const MODULE_COLORS = {
  cable: 'bg-blue-500', sales: 'bg-green-500', stock: 'bg-amber-500',
  inventory: 'bg-purple-500', estimator: 'bg-pink-500', purchasing: 'bg-cyan-500',
  logistic: 'bg-teal-500', logistik: 'bg-teal-400', quotation: 'bg-indigo-500',
  quotation_tracking: 'bg-indigo-400', opname: 'bg-orange-500', project: 'bg-red-500',
  it: 'bg-gray-500', tender: 'bg-yellow-500', approval: 'bg-lime-500',
  general: 'bg-gray-600', config: 'bg-gray-700', system: 'bg-gray-800'
}

const ACTION_ICONS = {
  created: 'fa-plus text-green-400',
  modified: 'fa-pen text-amber-400',
  deleted: 'fa-trash text-red-400'
}

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const now = new Date()
  const diff = (now - d) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function FileActivityWidget({ token }) {
  const [activities, setActivities] = useState([])
  const [filter, setFilter] = useState('all')
  const [modules, setModules] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/deploy/file-activity?days=7&limit=15').then(r => r.json()),
      fetch('/api/deploy/modules').then(r => r.json())
    ]).then(([actData, modData]) => {
      setActivities(actData.activities || [])
      setModules(modData.modules || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const filtered = filter === 'all' ? activities : activities.filter(a => a.module === filter)

  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <i className="fa-solid fa-file-code text-indigo-400"></i>
          File Activity
        </h3>
        <select value={filter} onChange={e => setFilter(e.target.value)}
          className="text-xs bg-gray-700 border border-gray-600 text-gray-300 rounded-lg px-2 py-1 focus:outline-none">
          <option value="all">All Modules</option>
          {modules.map(m => <option key={m.name} value={m.name}>{m.display_name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-6"><i className="fa-solid fa-spinner fa-spin text-gray-500"></i></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-6 text-gray-500 text-xs">No activity yet</div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {filtered.map(a => (
            <div key={a.id} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-gray-700/30 hover:bg-gray-700/60 transition-colors">
              <i className={`fa-solid ${ACTION_ICONS[a.action] || 'fa-circle text-gray-500'} text-[10px] mt-1.5`}></i>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white truncate font-mono">{a.file_path}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full text-white font-medium ${MODULE_COLORS[a.module] || 'bg-gray-600'}`}>
                    {a.module}
                  </span>
                  <span className="text-[10px] text-gray-500">{a.changed_by}</span>
                  <span className="text-[10px] text-gray-600 ml-auto">{timeAgo(a.detected_at)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
