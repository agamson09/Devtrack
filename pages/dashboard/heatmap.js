import { useState, useEffect, useCallback } from 'react'
import Layout from '@/components/layout/Layout'
import Loading from '@/components/common/Loading'

function HeatmapGrid({ data, maxCount }) {
  const today = new Date()
  const days = []
  for (let i = 364; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().split('T')[0]
    days.push({ date: key, count: data[key] || 0, day: d })
  }

  const weeks = []
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7))
  }

  const getColor = (count) => {
    if (count === 0) return 'bg-gray-700'
    const ratio = maxCount > 0 ? count / maxCount : 0
    if (ratio <= 0.15) return 'bg-emerald-900'
    if (ratio <= 0.35) return 'bg-emerald-700'
    if (ratio <= 0.55) return 'bg-emerald-500'
    if (ratio <= 0.75) return 'bg-emerald-400'
    return 'bg-emerald-300'
  }

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  let lastMonth = -1
  const monthPositions = []
  weeks.forEach((week, i) => {
    const m = week[0]?.day.getMonth()
    if (m !== lastMonth) {
      monthPositions.push({ month: m, index: i })
      lastMonth = m
    }
  })

  return (
    <div className="overflow-x-auto">
      <div className="inline-flex flex-col gap-0.5">
        <div className="flex gap-0.5 ml-8">
          {monthPositions.map(({ month, index }) => (
            <div key={`${month}-${index}`} className="text-[10px] text-gray-500" style={{ marginLeft: index === 0 ? 0 : `${Math.max(0, (index - (monthPositions[monthPositions.indexOf({ month, index }) - 1]?.index || 0)) * 14 - 20)}px` }}>
              {months[month]}
            </div>
          ))}
        </div>

        <div className="flex gap-0.5">
          <div className="flex flex-col gap-0.5 mr-1 justify-between text-[10px] text-gray-500 py-0">
            {['', 'Mon', '', 'Wed', '', 'Fri', ''].map((d, i) => (
              <div key={i} className="h-[11px] leading-[11px]">{d}</div>
            ))}
          </div>

          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-0.5">
              {week.map((day, di) => (
                <div
                  key={day.date}
                  className={`w-[11px] h-[11px] rounded-sm ${getColor(day.count)} cursor-pointer hover:ring-1 hover:ring-gray-400 transition-all`}
                  title={`${day.date}: ${day.count} action${day.count !== 1 ? 's' : ''}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 mt-4 ml-8">
        <span className="text-[10px] text-gray-500">Less</span>
        {[0, 0.15, 0.35, 0.55, 0.75].map((_, i) => (
          <div key={i} className={`w-[11px] h-[11px] rounded-sm ${['bg-gray-700', 'bg-emerald-900', 'bg-emerald-700', 'bg-emerald-500', 'bg-emerald-300'][i]}`} />
        ))}
        <span className="text-[10px] text-gray-500">More</span>
      </div>
    </div>
  )
}

export default function HeatmapPage() {
  const [data, setData] = useState({})
  const [users, setUsers] = useState([])
  const [selectedUser, setSelectedUser] = useState('')
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ total: 0, activeDays: 0, maxDay: 0, streak: 0 })

  useEffect(() => {
    fetchHeatmap()
  }, [selectedUser])

  async function fetchHeatmap() {
    setLoading(true)
    try {
      let url = '/api/activity/heatmap?days=365'
      if (selectedUser) url += `&user_id=${selectedUser}`
      const res = await fetch(url)
      const json = await res.json()
      setData(json.heatmap || {})
      setUsers(json.users || [])

      const counts = Object.values(json.heatmap || {})
      const total = counts.reduce((s, c) => s + c, 0)
      const activeDays = counts.filter(c => c > 0).length
      const maxDay = Math.max(0, ...counts)

      let streak = 0
      const today = new Date()
      for (let i = 0; i < 365; i++) {
        const d = new Date(today)
        d.setDate(d.getDate() - i)
        const key = d.toISOString().split('T')[0]
        if ((json.heatmap || {})[key]) streak++
        else break
      }

      setStats({ total, activeDays, maxDay, streak })
    } catch (err) {
      console.error('Heatmap error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Activity Heatmap</h1>
            <p className="text-gray-400 text-sm mt-1">Your contribution activity over the past year</p>
          </div>
          <select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)} className="bg-gray-700 text-white text-sm rounded-lg px-3 py-2 border border-gray-600 focus:border-indigo-500 focus:outline-none">
            <option value="">All Members</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
            <p className="text-2xl font-bold text-white">{stats.total}</p>
            <p className="text-gray-400 text-xs">Total Actions</p>
          </div>
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
            <p className="text-2xl font-bold text-emerald-400">{stats.activeDays}</p>
            <p className="text-gray-400 text-xs">Active Days</p>
          </div>
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
            <p className="text-2xl font-bold text-amber-400">{stats.maxDay}</p>
            <p className="text-gray-400 text-xs">Max Actions in a Day</p>
          </div>
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
            <p className="text-2xl font-bold text-indigo-400">{stats.streak}</p>
            <p className="text-gray-400 text-xs">Current Streak (days)</p>
          </div>
        </div>

        {loading ? <Loading /> : (
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <HeatmapGrid data={data} maxCount={stats.maxDay} />
          </div>
        )}
      </div>
    </Layout>
  )
}
