import { useState, useEffect } from 'react'
import Layout from '@/components/layout/Layout'
import { useAuth } from '@/components/AuthContext'
import { useRouter } from 'next/router'

export default function EmailAccountsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [accounts, setAccounts] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [detail, setDetail] = useState(null)
  const [showPw, setShowPw] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [form, setForm] = useState({ email: '', user_id: '', provider: '', password: '', status: 'active', created_date: '', notes: '' })
  const [submitting, setSubmitting] = useState(false)
  const [copied, setCopied] = useState(null)

  const canManage = user?.role === 'admin' || user?.role === 'it_support'

  useEffect(() => { if (user && !canManage) router.push('/dashboard') }, [user])
  useEffect(() => { loadData() }, [user])

  async function loadData() {
    try {
      const [emailRes, usersRes] = await Promise.all([fetch('/api/it-support/email-accounts'), fetch('/api/users')])
      const emailData = await emailRes.json()
      const usersData = await usersRes.json()
      setAccounts(emailData.accounts || [])
      setUsers(usersData.users || [])
    } catch {}
    setLoading(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await fetch('/api/it-support/email-accounts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, user_id: form.user_id || null })
      })
      setShowForm(false)
      setForm({ email: '', user_id: '', provider: '', password: '', status: 'active', created_date: '', notes: '' })
      loadData()
    } catch {}
    setSubmitting(false)
  }

  async function handleEditSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await fetch(`/api/it-support/email-accounts/${editItem.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editItem, user_id: editItem.user_id || null })
      })
      setEditItem(null)
      loadData()
    } catch {}
    setSubmitting(false)
  }

  async function viewDetail(acc) {
    try {
      const res = await fetch(`/api/it-support/email-accounts/${acc.id}`)
      const data = await res.json()
      setDetail(data.account)
      setShowPw(false)
    } catch {}
  }

  async function handleDelete(id) {
    if (!confirm('Delete this email account?')) return
    try {
      await fetch(`/api/it-support/email-accounts/${id}`, { method: 'DELETE' })
      loadData()
    } catch {}
  }

  function copyToClipboard(text, id) {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  function providerIcon(p) {
    const icons = { google: 'fa-brands fa-google', microsoft: 'fa-brands fa-microsoft', outlook: 'fa-solid fa-envelope', gmail: 'fa-brands fa-google', yahoo: 'fa-brands fa-yahoo', other: 'fa-solid fa-at' }
    return icons[p?.toLowerCase()] || 'fa-solid fa-envelope'
  }

  function statusBadge(s) {
    const c = { active: 'bg-green-500/20 text-green-400', inactive: 'bg-gray-500/20 text-gray-400', suspended: 'bg-red-500/20 text-red-400', pending: 'bg-yellow-500/20 text-yellow-400' }
    return <span className={`px-2 py-1 rounded text-xs font-medium ${c[s] || 'bg-gray-600 text-gray-300'}`}>{s}</span>
  }

  const filtered = accounts.filter(a => {
    const matchSearch = !searchQuery ||
      a.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.user_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.provider?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchStatus = filterStatus === 'all' || a.status === filterStatus
    return matchSearch && matchStatus
  })

  if (loading) return <Layout title="Email Accounts"><div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full"></div></div></Layout>

  return (
    <Layout title="Email Accounts">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search emails, users..." className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-9 pr-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none" />
          </div>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none">
            <option value="all">All Status</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="suspended">Suspended</option><option value="pending">Pending</option>
          </select>
          {canManage && (
            <button onClick={() => { setShowForm(!showForm); setEditItem(null) }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors">
              <i className="fa-solid fa-plus text-xs"></i> Add Account
            </button>
          )}
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-gray-800 rounded-xl p-6 border border-gray-700 space-y-4">
            <h3 className="text-white font-semibold">New Email Account</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="block text-sm text-gray-400 mb-1">Email Address *</label>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none" required placeholder="user@company.com" /></div>
              <div><label className="block text-sm text-gray-400 mb-1">Provider</label>
                <select value={form.provider} onChange={e => setForm({ ...form, provider: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none">
                  <option value="">Select</option><option value="Google">Google Workspace</option><option value="Microsoft">Microsoft 365</option><option value="Yahoo">Yahoo</option><option value="Other">Other</option>
                </select></div>
              <div><label className="block text-sm text-gray-400 mb-1">Password *</label>
                <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none" required /></div>
              <div><label className="block text-sm text-gray-400 mb-1">Assign to User</label>
                <select value={form.user_id} onChange={e => setForm({ ...form, user_id: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none">
                  <option value="">Unassigned</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select></div>
              <div><label className="block text-sm text-gray-400 mb-1">Status</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none">
                  <option value="active">Active</option><option value="inactive">Inactive</option><option value="pending">Pending</option>
                </select></div>
              <div><label className="block text-sm text-gray-400 mb-1">Created Date</label>
                <input type="date" value={form.created_date} onChange={e => setForm({ ...form, created_date: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none" /></div>
            </div>
            <div><label className="block text-sm text-gray-400 mb-1">Notes</label>
              <textarea rows="2" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none" /></div>
            <div className="flex gap-3">
              <button type="submit" disabled={submitting} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">{submitting ? 'Saving...' : 'Add Account'}</button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium">Cancel</button>
            </div>
          </form>
        )}

        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-gray-700">
                <th className="text-left text-xs font-medium text-gray-400 uppercase px-6 py-3">Email</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase px-6 py-3">Provider</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase px-6 py-3">Assigned To</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase px-6 py-3">Status</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase px-6 py-3">Created</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase px-6 py-3">Actions</th>
              </tr></thead>
              <tbody>
                {filtered.map(acc => (
                  <tr key={acc.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <i className={`fa-solid ${providerIcon(acc.provider)} text-gray-400`}></i>
                        <span className="text-sm text-white font-medium">{acc.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-300">{acc.provider || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-300">{acc.user_name || <span className="text-gray-500">Unassigned</span>}</td>
                    <td className="px-6 py-4">{statusBadge(acc.status)}</td>
                    <td className="px-6 py-4 text-sm text-gray-400">{acc.created_date ? new Date(acc.created_date).toLocaleDateString() : '-'}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => viewDetail(acc)} className="text-indigo-400 hover:text-indigo-300 text-sm" title="View"><i className="fa-solid fa-eye"></i></button>
                        {canManage && <>
                          <button onClick={() => setEditItem({ ...acc, password: '' })} className="text-yellow-400 hover:text-yellow-300 text-sm" title="Edit"><i className="fa-solid fa-pen"></i></button>
                          {user?.role === 'admin' && (
                            <button onClick={() => handleDelete(acc.id)} className="text-red-400 hover:text-red-300 text-sm" title="Delete"><i className="fa-solid fa-trash"></i></button>
                          )}
                        </>}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan="6" className="px-6 py-12 text-center text-gray-500">No email accounts found</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {detail && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 w-full max-w-md">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold">Email Account Details</h3>
                <button onClick={() => setDetail(null)} className="text-gray-400 hover:text-white"><i className="fa-solid fa-xmark"></i></button>
              </div>
              <div className="space-y-3">
                <div><span className="text-gray-400 text-sm">Email: </span><span className="text-white text-sm">{detail.email}</span></div>
                <div><span className="text-gray-400 text-sm">Provider: </span><span className="text-white text-sm">{detail.provider || '-'}</span></div>
                <div><span className="text-gray-400 text-sm">Status: </span>{statusBadge(detail.status)}</div>
                {detail.user_name && <div><span className="text-gray-400 text-sm">Assigned to: </span><span className="text-white text-sm">{detail.user_name}</span></div>}
                {detail.password && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 text-sm">Password:</span>
                    <span className="text-white text-sm font-mono">{showPw ? detail.password : '••••••••'}</span>
                    <button onClick={() => setShowPw(!showPw)} className="text-gray-400 hover:text-white text-xs"><i className={`fa-solid ${showPw ? 'fa-eye-slash' : 'fa-eye'}`}></i></button>
                    <button onClick={() => copyToClipboard(detail.password, 'pw')} className="text-gray-400 hover:text-white text-xs"><i className={`fa-solid ${copied === 'pw' ? 'fa-check text-green-400' : 'fa-copy'}`}></i></button>
                  </div>
                )}
                {detail.notes && <div><span className="text-gray-400 text-sm">Notes: </span><span className="text-white text-sm">{detail.notes}</span></div>}
                {detail.created_date && <div><span className="text-gray-400 text-sm">Created: </span><span className="text-white text-sm">{new Date(detail.created_date).toLocaleDateString()}</span></div>}
              </div>
            </div>
          </div>
        )}

        {editItem && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold">Edit Email Account</h3>
                <button onClick={() => setEditItem(null)} className="text-gray-400 hover:text-white"><i className="fa-solid fa-xmark"></i></button>
              </div>
              <form onSubmit={handleEditSubmit} className="space-y-3">
                <div><label className="block text-sm text-gray-400 mb-1">Email</label>
                  <input type="email" value={editItem.email || ''} onChange={e => setEditItem({ ...editItem, email: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none" /></div>
                <div><label className="block text-sm text-gray-400 mb-1">Provider</label>
                  <select value={editItem.provider || ''} onChange={e => setEditItem({ ...editItem, provider: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none">
                    <option value="">Select</option><option value="Google">Google Workspace</option><option value="Microsoft">Microsoft 365</option><option value="Yahoo">Yahoo</option><option value="Other">Other</option>
                  </select></div>
                <div><label className="block text-sm text-gray-400 mb-1">New Password (leave blank to keep)</label>
                  <input type="password" value={editItem.password || ''} onChange={e => setEditItem({ ...editItem, password: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none" /></div>
                <div><label className="block text-sm text-gray-400 mb-1">Assign to User</label>
                  <select value={editItem.user_id || ''} onChange={e => setEditItem({ ...editItem, user_id: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none">
                    <option value="">Unassigned</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select></div>
                <div><label className="block text-sm text-gray-400 mb-1">Status</label>
                  <select value={editItem.status || 'active'} onChange={e => setEditItem({ ...editItem, status: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none">
                    <option value="active">Active</option><option value="inactive">Inactive</option><option value="suspended">Suspended</option><option value="pending">Pending</option>
                  </select></div>
                <div><label className="block text-sm text-gray-400 mb-1">Created Date</label>
                  <input type="date" value={editItem.created_date ? editItem.created_date.split('T')[0] : ''} onChange={e => setEditItem({ ...editItem, created_date: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none" /></div>
                <div><label className="block text-sm text-gray-400 mb-1">Notes</label>
                  <textarea rows="2" value={editItem.notes || ''} onChange={e => setEditItem({ ...editItem, notes: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none" /></div>
                <div className="flex gap-3 pt-2">
                  <button type="submit" disabled={submitting} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">{submitting ? 'Saving...' : 'Save Changes'}</button>
                  <button type="button" onClick={() => setEditItem(null)} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
