import { useState, useEffect } from 'react'
import Layout from '@/components/layout/Layout'
import { useAuth } from '@/components/AuthContext'
import { useRouter } from 'next/router'

const CATEGORIES = [
  { value: 'Server', label: 'Server', icon: 'fa-server', color: 'text-emerald-400' },
  { value: 'PC/Laptop Admin', label: 'PC/Laptop Admin', icon: 'fa-user-shield', color: 'text-blue-400' },
  { value: 'PC/Laptop User', label: 'PC/Laptop User', icon: 'fa-user', color: 'text-purple-400' },
  { value: 'Router Mikrotik', label: 'Router Mikrotik', icon: 'fa-tower-broadcast', color: 'text-orange-400' },
  { value: 'Router Lainnya', label: 'Router Lainnya', icon: 'fa-wifi', color: 'text-cyan-400' },
  { value: 'Email Employee', label: 'Email Employee', icon: 'fa-envelope', color: 'text-yellow-400' },
  { value: 'email', label: 'Email', icon: 'fa-envelope', color: 'text-yellow-400' },
  { value: 'database', label: 'Database', icon: 'fa-database', color: 'text-pink-400' },
  { value: 'social', label: 'Social Media', icon: 'fa-share-nodes', color: 'text-red-400' },
  { value: 'vpn', label: 'VPN', icon: 'fa-shield-halved', color: 'text-green-400' },
  { value: 'admin', label: 'Admin Panel', icon: 'fa-gauge-high', color: 'text-amber-400' },
  { value: 'other', label: 'Other', icon: 'fa-key', color: 'text-gray-400' },
]

function getCategoryMeta(c) {
  return CATEGORIES.find(cat => cat.value === c) || { value: c, label: c || 'Uncategorized', icon: 'fa-key', color: 'text-gray-400' }
}

export default function PasswordsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [detail, setDetail] = useState(null)
  const [detailPassword, setDetailPassword] = useState('')
  const [showDetailPw, setShowDetailPw] = useState(false)
  const [form, setForm] = useState({ service_name: '', category: '', username: '', password: '', url: '', notes: '' })
  const [editEntry, setEditEntry] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [copied, setCopied] = useState(null)
  const [activeCategory, setActiveCategory] = useState('All')
  const [viewMode, setViewMode] = useState('table')

  const canManage = user?.role === 'admin' || user?.role === 'it_support'

  useEffect(() => { if (user && !canManage) router.push('/dashboard') }, [user])
  useEffect(() => { loadEntries() }, [user])

  async function loadEntries() {
    try {
      const res = await fetch('/api/it-support/passwords')
      const data = await res.json()
      setEntries(data.entries || [])
    } catch {}
    setLoading(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await fetch('/api/it-support/passwords', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      setShowForm(false)
      setForm({ service_name: '', category: '', username: '', password: '', url: '', notes: '' })
      loadEntries()
    } catch {}
    setSubmitting(false)
  }

  async function handleEditSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await fetch(`/api/it-support/passwords/${editEntry.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editEntry)
      })
      setEditEntry(null)
      loadEntries()
    } catch {}
    setSubmitting(false)
  }

  async function viewDetail(entry) {
    try {
      const res = await fetch(`/api/it-support/passwords/${entry.id}`)
      const data = await res.json()
      setDetail(data.entry)
      setDetailPassword(data.entry?.password || '')
      setShowDetailPw(false)
    } catch {}
  }

  async function handleDelete(id) {
    if (!confirm('Delete this password entry?')) return
    try {
      await fetch(`/api/it-support/passwords/${id}`, { method: 'DELETE' })
      loadEntries()
    } catch {}
  }

  function copyToClipboard(text, id) {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  const searchFiltered = entries.filter(e =>
    e.service_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.notes?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filtered = activeCategory === 'All'
    ? searchFiltered
    : searchFiltered.filter(e => e.category === activeCategory)

  const categoryCounts = entries.reduce((acc, e) => {
    const cat = e.category || 'Other'
    acc[cat] = (acc[cat] || 0) + 1
    return acc
  }, {})

  const categoryOptions = CATEGORIES.filter(c => categoryCounts[c.value] > 0)

  if (loading) return <Layout title="Password Vault"><div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full"></div></div></Layout>

  return (
    <Layout title="Password Vault">
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="relative flex-1 max-w-md">
              <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search passwords..." className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-9 pr-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none" />
            </div>
            <span className="text-gray-400 text-sm whitespace-nowrap">{filtered.length} entries</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-gray-800 border border-gray-700 rounded-lg p-0.5">
              <button onClick={() => setViewMode('table')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === 'table' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`} title="Table view">
                <i className="fa-solid fa-table-list"></i>
              </button>
              <button onClick={() => setViewMode('list')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === 'list' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`} title="List view">
                <i className="fa-solid fa-list"></i>
              </button>
            </div>
            {canManage && (
              <button onClick={() => { setShowForm(!showForm); setEditEntry(null) }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors">
                <i className="fa-solid fa-plus text-xs"></i> Add Password
              </button>
            )}
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          <button onClick={() => setActiveCategory('All')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${activeCategory === 'All' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 border border-gray-700'}`}>
            <i className="fa-solid fa-layer-group text-[10px]"></i> All <span className="bg-black/20 px-1.5 py-0.5 rounded text-[10px]">{entries.length}</span>
          </button>
          {categoryOptions.map(c => {
            const meta = getCategoryMeta(c.value)
            return (
              <button key={c.value} onClick={() => setActiveCategory(c.value)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${activeCategory === c.value ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 border border-gray-700'}`}>
                <i className={`fa-solid ${meta.icon} ${meta.color} text-[10px]`}></i> {meta.label} <span className="bg-black/20 px-1.5 py-0.5 rounded text-[10px]">{categoryCounts[c.value] || 0}</span>
              </button>
            )
          })}
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-gray-800 rounded-xl p-6 border border-gray-700 space-y-4">
            <h3 className="text-white font-semibold">New Password Entry</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="block text-sm text-gray-400 mb-1">Service Name *</label>
                <input value={form.service_name} onChange={e => setForm({ ...form, service_name: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none" required placeholder="e.g. Google Workspace" /></div>
              <div><label className="block text-sm text-gray-400 mb-1">Category</label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none">
                  <option value="">Select</option>
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select></div>
              <div><label className="block text-sm text-gray-400 mb-1">Username</label>
                <input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none" /></div>
              <div><label className="block text-sm text-gray-400 mb-1">Password *</label>
                <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none" required /></div>
              <div className="md:col-span-2"><label className="block text-sm text-gray-400 mb-1">URL</label>
                <input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none" placeholder="https://..." /></div>
            </div>
            <div><label className="block text-sm text-gray-400 mb-1">Notes</label>
              <textarea rows="2" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none" /></div>
            <div className="flex gap-3">
              <button type="submit" disabled={submitting} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">{submitting ? 'Saving...' : 'Save Password'}</button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium">Cancel</button>
            </div>
          </form>
        )}

        {/* TABLE VIEW */}
        {viewMode === 'table' && (
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700 bg-gray-800/80">
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Service Name</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Category</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Username</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Password</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Notes</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/50">
                  {filtered.map(entry => {
                    const meta = getCategoryMeta(entry.category)
                    return (
                      <tr key={entry.id} className="hover:bg-gray-700/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <i className={`fa-solid ${meta.icon} ${meta.color} text-xs w-4 text-center`}></i>
                            <span className="text-white font-medium text-sm">{entry.service_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-700/50 rounded text-xs text-gray-300">
                            <i className={`fa-solid ${meta.icon} ${meta.color} text-[9px]`}></i>
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-300 text-sm">{entry.username || '-'}</td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-gray-500 text-sm">{'••••••••'}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-sm max-w-[200px] truncate">{entry.notes || '-'}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            <button onClick={() => viewDetail(entry)} className="px-2 py-1 hover:bg-gray-600 text-gray-400 hover:text-white rounded text-xs transition-colors" title="View"><i className="fa-solid fa-eye"></i></button>
                            <button onClick={() => setEditEntry({ ...entry, password: "" })} className="px-2 py-1 hover:bg-gray-600 text-gray-400 hover:text-white rounded text-xs transition-colors" title="Edit"><i className="fa-solid fa-pen"></i></button>
                            {user?.role === 'admin' && (
                              <button onClick={() => handleDelete(entry.id)} className="px-2 py-1 hover:bg-red-600/50 text-red-400 hover:text-red-300 rounded text-xs transition-colors" title="Delete"><i className="fa-solid fa-trash"></i></button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <i className="fa-solid fa-lock text-4xl mb-3 block"></i>
                  <p>No password entries found</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* LIST/CARD VIEW */}
        {viewMode === 'list' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(entry => {
              const meta = getCategoryMeta(entry.category)
              return (
                <div key={entry.id} className="bg-gray-800 rounded-xl p-4 border border-gray-700 hover:border-indigo-500/50 transition-colors">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-gray-700`}>
                      <i className={`fa-solid ${meta.icon} ${meta.color}`}></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-white font-medium text-sm truncate">{entry.service_name}</h4>
                      <p className="text-gray-400 text-xs truncate">{entry.username || 'No username'}</p>
                    </div>
                  </div>
                  {entry.category && <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-700/50 rounded text-xs text-gray-300 mb-3"><i className={`fa-solid ${meta.icon} ${meta.color} text-[9px]`}></i>{meta.label}</span>}
                  {entry.notes && <p className="text-gray-500 text-xs truncate mb-2">{entry.notes}</p>}
                  <div className="flex items-center gap-2 mt-2">
                    <button onClick={() => viewDetail(entry)} className="flex-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs font-medium transition-colors"><i className="fa-solid fa-eye mr-1"></i> View</button>
                    <button onClick={() => setEditEntry({ ...entry, password: "" })} className="flex-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs font-medium transition-colors"><i className="fa-solid fa-pen mr-1"></i> Edit</button>
                    {user?.role === 'admin' && (
                      <button onClick={() => handleDelete(entry.id)} className="px-3 py-1.5 bg-gray-700 hover:bg-red-600/50 text-red-400 rounded text-xs font-medium transition-colors"><i className="fa-solid fa-trash"></i></button>
                    )}
                  </div>
                </div>
              )
            })}
            {filtered.length === 0 && (
              <div className="col-span-full text-center py-12 text-gray-500">
                <i className="fa-solid fa-lock text-4xl mb-3 block"></i>
                <p>No password entries found</p>
              </div>
            )}
          </div>
        )}

        {/* Detail Modal */}
        {detail && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setDetail(null)}>
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 w-full max-w-md" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  {(() => { const m = getCategoryMeta(detail.category); return <i className={`fa-solid ${m.icon} ${m.color}`}></i> })()}
                  <h3 className="text-white font-semibold">{detail.service_name}</h3>
                </div>
                <button onClick={() => setDetail(null)} className="text-gray-400 hover:text-white"><i className="fa-solid fa-xmark"></i></button>
              </div>
              <div className="space-y-3">
                {detail.category && <div><span className="text-gray-400 text-sm">Category: </span><span className="text-white text-sm">{detail.category}</span></div>}
                {detail.username && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 text-sm">Username:</span>
                    <span className="text-white text-sm">{detail.username}</span>
                    <button onClick={() => copyToClipboard(detail.username, 'user')} className="text-gray-400 hover:text-white text-xs"><i className={`fa-solid ${copied === 'user' ? 'fa-check text-green-400' : 'fa-copy'}`}></i></button>
                  </div>
                )}
                {detailPassword && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 text-sm">Password:</span>
                    <span className="text-white text-sm font-mono">{showDetailPw ? detailPassword : '••••••••'}</span>
                    <button onClick={() => setShowDetailPw(!showDetailPw)} className="text-gray-400 hover:text-white text-xs"><i className={`fa-solid ${showDetailPw ? 'fa-eye-slash' : 'fa-eye'}`}></i></button>
                    <button onClick={() => copyToClipboard(detailPassword, 'pw')} className="text-gray-400 hover:text-white text-xs"><i className={`fa-solid ${copied === 'pw' ? 'fa-check text-green-400' : 'fa-copy'}`}></i></button>
                  </div>
                )}
                {detail.url && <div><span className="text-gray-400 text-sm">URL: </span><a href={detail.url} target="_blank" rel="noopener" className="text-indigo-400 hover:text-indigo-300 text-sm">{detail.url}</a></div>}
                {detail.notes && <div><span className="text-gray-400 text-sm">Notes: </span><span className="text-white text-sm">{detail.notes}</span></div>}
                <div><span className="text-gray-400 text-sm">Created by: </span><span className="text-white text-sm">{detail.created_by_name}</span></div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {editEntry && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setEditEntry(null)}>
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold">Edit Password</h3>
                <button onClick={() => setEditEntry(null)} className="text-gray-400 hover:text-white"><i className="fa-solid fa-xmark"></i></button>
              </div>
              <form onSubmit={handleEditSubmit} className="space-y-3">
                <div><label className="block text-sm text-gray-400 mb-1">Service Name</label>
                  <input value={editEntry.service_name || ''} onChange={e => setEditEntry({ ...editEntry, service_name: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none" /></div>
                <div><label className="block text-sm text-gray-400 mb-1">Category</label>
                  <select value={editEntry.category || ''} onChange={e => setEditEntry({ ...editEntry, category: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none">
                    <option value="">Select</option>
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select></div>
                <div><label className="block text-sm text-gray-400 mb-1">Username</label>
                  <input value={editEntry.username || ''} onChange={e => setEditEntry({ ...editEntry, username: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none" /></div>
                <div><label className="block text-sm text-gray-400 mb-1">New Password (leave blank to keep current)</label>
                  <input type="password" value={editEntry.password || ''} onChange={e => setEditEntry({ ...editEntry, password: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none" /></div>
                <div><label className="block text-sm text-gray-400 mb-1">URL</label>
                  <input value={editEntry.url || ''} onChange={e => setEditEntry({ ...editEntry, url: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none" /></div>
                <div><label className="block text-sm text-gray-400 mb-1">Notes</label>
                  <textarea rows="2" value={editEntry.notes || ''} onChange={e => setEditEntry({ ...editEntry, notes: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none" /></div>
                <div className="flex gap-3 pt-2">
                  <button type="submit" disabled={submitting} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">{submitting ? 'Saving...' : 'Save Changes'}</button>
                  <button type="button" onClick={() => setEditEntry(null)} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
