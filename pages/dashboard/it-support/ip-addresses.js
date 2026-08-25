import { useState, useEffect } from 'react'
import Layout from '@/components/layout/Layout'
import { useAuth } from '@/components/AuthContext'
import { useRouter } from 'next/router'

export default function IpAddressesPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [addresses, setAddresses] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [form, setForm] = useState({ ip_address: '', subnet: '', device_name: '', user_id: '', location: '', status: 'available', notes: '' })
  const [submitting, setSubmitting] = useState(false)

  const canManage = user?.role === 'admin' || user?.role === 'it_support'

  useEffect(() => { if (user && !canManage) router.push('/dashboard') }, [user])
  useEffect(() => { loadData() }, [user])

  async function loadData() {
    try {
      const [ipRes, usersRes] = await Promise.all([fetch('/api/it-support/ip-addresses'), fetch('/api/users')])
      const ipData = await ipRes.json()
      const usersData = await usersRes.json()
      setAddresses(ipData.addresses || [])
      setUsers(usersData.users || [])
    } catch {}
    setLoading(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await fetch('/api/it-support/ip-addresses', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, user_id: form.user_id || null })
      })
      setShowForm(false)
      setForm({ ip_address: '', subnet: '', device_name: '', user_id: '', location: '', status: 'available', notes: '' })
      loadData()
    } catch {}
    setSubmitting(false)
  }

  async function handleEditSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await fetch(`/api/it-support/ip-addresses/${editItem.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editItem, user_id: editItem.user_id || null })
      })
      setEditItem(null)
      loadData()
    } catch {}
    setSubmitting(false)
  }

  async function handleDelete(id) {
    if (!confirm('Delete this IP entry?')) return
    try {
      await fetch(`/api/it-support/ip-addresses/${id}`, { method: 'DELETE' })
      loadData()
    } catch {}
  }

  function statusBadge(s) {
    const c = { available: 'bg-green-500/20 text-green-400', used: 'bg-blue-500/20 text-blue-400', reserved: 'bg-yellow-500/20 text-yellow-400', blocked: 'bg-red-500/20 text-red-400' }
    return <span className={`px-2 py-1 rounded text-xs font-medium ${c[s] || 'bg-gray-600 text-gray-300'}`}>{s}</span>
  }

  const filtered = addresses.filter(a => {
    const matchSearch = !searchQuery ||
      a.ip_address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.device_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.user_name?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchStatus = filterStatus === 'all' || a.status === filterStatus
    return matchSearch && matchStatus
  })

  const statusCounts = { all: addresses.length, available: addresses.filter(a => a.status === 'available').length, used: addresses.filter(a => a.status === 'used').length, reserved: addresses.filter(a => a.status === 'reserved').length, blocked: addresses.filter(a => a.status === 'blocked').length }

  if (loading) return <Layout title="IP Addresses"><div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full"></div></div></Layout>

  return (
    <Layout title="IP Address Management">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search IPs, devices, users..." className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-9 pr-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none" />
          </div>
          <div className="flex gap-1 bg-gray-800 rounded-lg p-1 border border-gray-700">
            {Object.entries(statusCounts).map(([k, v]) => (
              <button key={k} onClick={() => setFilterStatus(k)} className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${filterStatus === k ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                {k === 'all' ? 'All' : k.charAt(0).toUpperCase() + k.slice(1)} ({v})
              </button>
            ))}
          </div>
          {canManage && (
            <button onClick={() => { setShowForm(!showForm); setEditItem(null) }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors">
              <i className="fa-solid fa-plus text-xs"></i> Add IP
            </button>
          )}
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-gray-800 rounded-xl p-6 border border-gray-700 space-y-4">
            <h3 className="text-white font-semibold">New IP Address Entry</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><label className="block text-sm text-gray-400 mb-1">IP Address *</label>
                <input value={form.ip_address} onChange={e => setForm({ ...form, ip_address: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm font-mono focus:border-indigo-500 focus:outline-none" required placeholder="192.168.1.100" /></div>
              <div><label className="block text-sm text-gray-400 mb-1">Subnet</label>
                <input value={form.subnet} onChange={e => setForm({ ...form, subnet: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm font-mono focus:border-indigo-500 focus:outline-none" placeholder="255.255.255.0 or /24" /></div>
              <div><label className="block text-sm text-gray-400 mb-1">Device Name</label>
                <input value={form.device_name} onChange={e => setForm({ ...form, device_name: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none" placeholder="e.g. Office PC John" /></div>
              <div><label className="block text-sm text-gray-400 mb-1">Assign to User</label>
                <select value={form.user_id} onChange={e => setForm({ ...form, user_id: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none">
                  <option value="">Unassigned</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select></div>
              <div><label className="block text-sm text-gray-400 mb-1">Location</label>
                <input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none" placeholder="e.g. Floor 2 Room 3" /></div>
              <div><label className="block text-sm text-gray-400 mb-1">Status</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none">
                  <option value="available">Available</option><option value="used">Used</option><option value="reserved">Reserved</option><option value="blocked">Blocked</option>
                </select></div>
            </div>
            <div><label className="block text-sm text-gray-400 mb-1">Notes</label>
              <textarea rows="2" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none" /></div>
            <div className="flex gap-3">
              <button type="submit" disabled={submitting} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">{submitting ? 'Saving...' : 'Add IP'}</button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium">Cancel</button>
            </div>
          </form>
        )}

        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-gray-700">
                <th className="text-left text-xs font-medium text-gray-400 uppercase px-6 py-3">IP Address</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase px-6 py-3">Subnet</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase px-6 py-3">Device</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase px-6 py-3">Assigned To</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase px-6 py-3">Location</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase px-6 py-3">Status</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase px-6 py-3">Actions</th>
              </tr></thead>
              <tbody>
                {filtered.map(addr => (
                  <tr key={addr.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                    <td className="px-6 py-4 text-sm text-white font-mono font-medium">{addr.ip_address}</td>
                    <td className="px-6 py-4 text-sm text-gray-400 font-mono">{addr.subnet || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-300">{addr.device_name || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-300">{addr.user_name || <span className="text-gray-500">Unassigned</span>}</td>
                    <td className="px-6 py-4 text-sm text-gray-400">{addr.location || '-'}</td>
                    <td className="px-6 py-4">{statusBadge(addr.status)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {canManage && <>
                          <button onClick={() => setEditItem(addr)} className="text-yellow-400 hover:text-yellow-300 text-sm" title="Edit"><i className="fa-solid fa-pen"></i></button>
                          {user?.role === 'admin' && (
                            <button onClick={() => handleDelete(addr.id)} className="text-red-400 hover:text-red-300 text-sm" title="Delete"><i className="fa-solid fa-trash"></i></button>
                          )}
                        </>}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan="7" className="px-6 py-12 text-center text-gray-500">No IP addresses found</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {editItem && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 w-full max-w-md">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold">Edit IP Address</h3>
                <button onClick={() => setEditItem(null)} className="text-gray-400 hover:text-white"><i className="fa-solid fa-xmark"></i></button>
              </div>
              <form onSubmit={handleEditSubmit} className="space-y-3">
                <div><label className="block text-sm text-gray-400 mb-1">IP Address</label>
                  <input value={editItem.ip_address || ''} onChange={e => setEditItem({ ...editItem, ip_address: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm font-mono focus:border-indigo-500 focus:outline-none" /></div>
                <div><label className="block text-sm text-gray-400 mb-1">Subnet</label>
                  <input value={editItem.subnet || ''} onChange={e => setEditItem({ ...editItem, subnet: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm font-mono focus:border-indigo-500 focus:outline-none" /></div>
                <div><label className="block text-sm text-gray-400 mb-1">Device Name</label>
                  <input value={editItem.device_name || ''} onChange={e => setEditItem({ ...editItem, device_name: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none" /></div>
                <div><label className="block text-sm text-gray-400 mb-1">Assign to User</label>
                  <select value={editItem.user_id || ''} onChange={e => setEditItem({ ...editItem, user_id: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none">
                    <option value="">Unassigned</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select></div>
                <div><label className="block text-sm text-gray-400 mb-1">Location</label>
                  <input value={editItem.location || ''} onChange={e => setEditItem({ ...editItem, location: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none" /></div>
                <div><label className="block text-sm text-gray-400 mb-1">Status</label>
                  <select value={editItem.status || 'available'} onChange={e => setEditItem({ ...editItem, status: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none">
                    <option value="available">Available</option><option value="used">Used</option><option value="reserved">Reserved</option><option value="blocked">Blocked</option>
                  </select></div>
                <div><label className="block text-sm text-gray-400 mb-1">Notes</label>
                  <textarea rows="2" value={editItem.notes || ''} onChange={e => setEditItem({ ...editItem, notes: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none" /></div>
                <div className="flex gap-3 pt-2">
                  <button type="submit" disabled={submitting} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">{submitting ? 'Saving...' : 'Save'}</button>
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
