import { useState, useEffect } from 'react'
import Layout from '@/components/layout/Layout'
import { useAuth } from '@/components/AuthContext'
import { useRouter } from 'next/router'

export default function InventoryPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [items, setItems] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showAssign, setShowAssign] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailHistory, setDetailHistory] = useState([])
  const [form, setForm] = useState({ item_name: '', category: '', brand: '', model: '', serial_number: '', purchase_date: '', warranty_until: '', status: 'available', location: '', notes: '' })
  const [assignForm, setAssignForm] = useState({ user_id: '', notes: '' })
  const [submitting, setSubmitting] = useState(false)
  const [editItem, setEditItem] = useState(null)

  const canManage = user?.role === 'admin' || user?.role === 'it_support'

  useEffect(() => { if (user && !canManage) router.push('/dashboard') }, [user])
  useEffect(() => { loadData() }, [user])

  async function loadData() {
    try {
      const [itemsRes, usersRes] = await Promise.all([fetch('/api/it-support/inventory'), fetch('/api/users')])
      const itemsData = await itemsRes.json()
      const usersData = await usersRes.json()
      setItems(itemsData.items || [])
      setUsers(usersData.users || [])
    } catch {}
    setLoading(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await fetch('/api/it-support/inventory', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      setShowForm(false)
      setForm({ item_name: '', category: '', brand: '', model: '', serial_number: '', purchase_date: '', warranty_until: '', status: 'available', location: '', notes: '' })
      loadData()
    } catch {}
    setSubmitting(false)
  }

  async function handleEditSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await fetch(`/api/it-support/inventory/${editItem.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editItem)
      })
      setEditItem(null)
      loadData()
    } catch {}
    setSubmitting(false)
  }

  async function handleAssign(itemId) {
    if (!assignForm.user_id) return
    try {
      await fetch('/api/it-support/inventory/assign', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inventory_id: itemId, user_id: assignForm.user_id, notes: assignForm.notes })
      })
      setShowAssign(null)
      setAssignForm({ user_id: '', notes: '' })
      loadData()
    } catch {}
  }

  async function handleUnassign(itemId) {
    try {
      await fetch('/api/it-support/inventory/assign', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unassign', inventory_id: itemId })
      })
      loadData()
    } catch {}
  }

  async function handleDelete(id) {
    if (!confirm('Delete this item?')) return
    try {
      await fetch(`/api/it-support/inventory/${id}`, { method: 'DELETE' })
      loadData()
    } catch {}
  }

  async function viewDetail(item) {
    try {
      const res = await fetch(`/api/it-support/inventory/${item.id}`)
      const data = await res.json()
      setDetail(data.item)
      setDetailHistory(data.history || [])
    } catch {}
  }

  function statusBadge(s) {
    const c = { available: 'bg-green-500/20 text-green-400', in_use: 'bg-blue-500/20 text-blue-400', repair: 'bg-yellow-500/20 text-yellow-400', retired: 'bg-gray-500/20 text-gray-400', lost: 'bg-red-500/20 text-red-400' }
    return <span className={`px-2 py-1 rounded text-xs font-medium ${c[s] || 'bg-gray-600 text-gray-300'}`}>{s?.replace('_', ' ')}</span>
  }

  if (loading) return <Layout title="Inventory"><div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full"></div></div></Layout>

  return (
    <Layout title="IT Inventory">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-gray-400">{items.length} items total</p>
          {canManage && (
            <button onClick={() => { setShowForm(!showForm); setEditItem(null) }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors">
              <i className="fa-solid fa-plus text-xs"></i> Add Item
            </button>
          )}
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-gray-800 rounded-xl p-6 border border-gray-700 space-y-4">
            <h3 className="text-white font-semibold">New Inventory Item</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><label className="block text-sm text-gray-400 mb-1">Item Name *</label>
                <input value={form.item_name} onChange={e => setForm({ ...form, item_name: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none" required /></div>
              <div><label className="block text-sm text-gray-400 mb-1">Category</label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none">
                  <option value="">Select</option><option value="laptop">Laptop</option><option value="desktop">Desktop</option><option value="monitor">Monitor</option><option value="peripheral">Peripheral</option><option value="network">Network</option><option value="server">Server</option><option value="other">Other</option>
                </select></div>
              <div><label className="block text-sm text-gray-400 mb-1">Brand</label>
                <input value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none" /></div>
              <div><label className="block text-sm text-gray-400 mb-1">Model</label>
                <input value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none" /></div>
              <div><label className="block text-sm text-gray-400 mb-1">Serial Number</label>
                <input value={form.serial_number} onChange={e => setForm({ ...form, serial_number: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none" /></div>
              <div><label className="block text-sm text-gray-400 mb-1">Location</label>
                <input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none" /></div>
              <div><label className="block text-sm text-gray-400 mb-1">Purchase Date</label>
                <input type="date" value={form.purchase_date} onChange={e => setForm({ ...form, purchase_date: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none" /></div>
              <div><label className="block text-sm text-gray-400 mb-1">Warranty Until</label>
                <input type="date" value={form.warranty_until} onChange={e => setForm({ ...form, warranty_until: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none" /></div>
              <div><label className="block text-sm text-gray-400 mb-1">Status</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none">
                  <option value="available">Available</option><option value="in_use">In Use</option><option value="repair">Repair</option><option value="retired">Retired</option>
                </select></div>
            </div>
            <div><label className="block text-sm text-gray-400 mb-1">Notes</label>
              <textarea rows="2" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none" /></div>
            <div className="flex gap-3">
              <button type="submit" disabled={submitting} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">{submitting ? 'Saving...' : 'Add Item'}</button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium">Cancel</button>
            </div>
          </form>
        )}

        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-gray-700">
                <th className="text-left text-xs font-medium text-gray-400 uppercase px-6 py-3">Item</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase px-6 py-3">Category</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase px-6 py-3">Brand/Model</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase px-6 py-3">Serial</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase px-6 py-3">Status</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase px-6 py-3">Assigned To</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase px-6 py-3">Actions</th>
              </tr></thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                    <td className="px-6 py-4 text-sm text-white font-medium">{item.item_name}</td>
                    <td className="px-6 py-4 text-sm text-gray-300 capitalize">{item.category || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-300">{[item.brand, item.model].filter(Boolean).join(' ') || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-400 font-mono text-xs">{item.serial_number || '-'}</td>
                    <td className="px-6 py-4">{statusBadge(item.status)}</td>
                    <td className="px-6 py-4 text-sm text-gray-300">{item.assigned_to_name || <span className="text-gray-500">Unassigned</span>}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => viewDetail(item)} className="text-indigo-400 hover:text-indigo-300 text-sm" title="View"><i className="fa-solid fa-eye"></i></button>
                        {canManage && <>
                          <button onClick={() => setEditItem(item)} className="text-yellow-400 hover:text-yellow-300 text-sm" title="Edit"><i className="fa-solid fa-pen"></i></button>
                          {item.status === 'available' ? (
                            <button onClick={() => { setShowAssign(item.id) }} className="text-green-400 hover:text-green-300 text-sm" title="Assign"><i className="fa-solid fa-user-plus"></i></button>
                          ) : item.status === 'in_use' ? (
                            <button onClick={() => handleUnassign(item.id)} className="text-orange-400 hover:text-orange-300 text-sm" title="Unassign"><i className="fa-solid fa-user-minus"></i></button>
                          ) : null}
                          {user?.role === 'admin' && (
                            <button onClick={() => handleDelete(item.id)} className="text-red-400 hover:text-red-300 text-sm" title="Delete"><i className="fa-solid fa-trash"></i></button>
                          )}
                        </>}
                      </div>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && <tr><td colSpan="7" className="px-6 py-12 text-center text-gray-500">No inventory items yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {showAssign && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 w-full max-w-md">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold">Assign Item</h3>
                <button onClick={() => setShowAssign(null)} className="text-gray-400 hover:text-white"><i className="fa-solid fa-xmark"></i></button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Assign to *</label>
                  <select value={assignForm.user_id} onChange={e => setAssignForm({ ...assignForm, user_id: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none">
                    <option value="">Select user</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Notes</label>
                  <input value={assignForm.notes} onChange={e => setAssignForm({ ...assignForm, notes: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none" placeholder="Optional notes" />
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={() => handleAssign(showAssign)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium">Assign</button>
                  <button onClick={() => setShowAssign(null)} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium">Cancel</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {editItem && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold">Edit Item</h3>
                <button onClick={() => setEditItem(null)} className="text-gray-400 hover:text-white"><i className="fa-solid fa-xmark"></i></button>
              </div>
              <form onSubmit={handleEditSubmit} className="space-y-3">
                <div><label className="block text-sm text-gray-400 mb-1">Item Name</label>
                  <input value={editItem.item_name} onChange={e => setEditItem({ ...editItem, item_name: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none" /></div>
                <div><label className="block text-sm text-gray-400 mb-1">Category</label>
                  <select value={editItem.category || ''} onChange={e => setEditItem({ ...editItem, category: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none">
                    <option value="">Select</option><option value="laptop">Laptop</option><option value="desktop">Desktop</option><option value="monitor">Monitor</option><option value="peripheral">Peripheral</option><option value="network">Network</option><option value="server">Server</option><option value="other">Other</option>
                  </select></div>
                <div><label className="block text-sm text-gray-400 mb-1">Brand</label>
                  <input value={editItem.brand || ''} onChange={e => setEditItem({ ...editItem, brand: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none" /></div>
                <div><label className="block text-sm text-gray-400 mb-1">Model</label>
                  <input value={editItem.model || ''} onChange={e => setEditItem({ ...editItem, model: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none" /></div>
                <div><label className="block text-sm text-gray-400 mb-1">Serial Number</label>
                  <input value={editItem.serial_number || ''} onChange={e => setEditItem({ ...editItem, serial_number: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none" /></div>
                <div><label className="block text-sm text-gray-400 mb-1">Status</label>
                  <select value={editItem.status || 'available'} onChange={e => setEditItem({ ...editItem, status: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none">
                    <option value="available">Available</option><option value="in_use">In Use</option><option value="repair">Repair</option><option value="retired">Retired</option><option value="lost">Lost</option>
                  </select></div>
                <div><label className="block text-sm text-gray-400 mb-1">Location</label>
                  <input value={editItem.location || ''} onChange={e => setEditItem({ ...editItem, location: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none" /></div>
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

        {detail && (
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">{detail.item_name}</h3>
              <button onClick={() => setDetail(null)} className="text-gray-400 hover:text-white"><i className="fa-solid fa-xmark"></i></button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
              <div><span className="text-gray-400">Status:</span> <span className="ml-2">{statusBadge(detail.status)}</span></div>
              <div><span className="text-gray-400">Category:</span> <span className="ml-2 text-white capitalize">{detail.category || '-'}</span></div>
              <div><span className="text-gray-400">Brand:</span> <span className="ml-2 text-white">{detail.brand || '-'}</span></div>
              <div><span className="text-gray-400">Model:</span> <span className="ml-2 text-white">{detail.model || '-'}</span></div>
              <div><span className="text-gray-400">Serial:</span> <span className="ml-2 text-white font-mono text-xs">{detail.serial_number || '-'}</span></div>
              <div><span className="text-gray-400">Location:</span> <span className="ml-2 text-white">{detail.location || '-'}</span></div>
              <div><span className="text-gray-400">Purchased:</span> <span className="ml-2 text-white">{detail.purchase_date ? new Date(detail.purchase_date).toLocaleDateString() : '-'}</span></div>
              <div><span className="text-gray-400">Warranty:</span> <span className="ml-2 text-white">{detail.warranty_until ? new Date(detail.warranty_until).toLocaleDateString() : '-'}</span></div>
            </div>
            {detailHistory.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium text-white mb-2">Assignment History</h4>
                <div className="space-y-2">
                  {detailHistory.map(h => (
                    <div key={h.id} className="bg-gray-700/50 rounded-lg px-4 py-2 text-sm">
                      <span className="text-white">{h.user_name}</span>
                      <span className="text-gray-400"> assigned by </span>
                      <span className="text-white">{h.assigned_by_name}</span>
                      <span className="text-gray-400"> on {new Date(h.assigned_at).toLocaleDateString()}</span>
                      {h.returned_at && <span className="text-orange-400"> (returned {new Date(h.returned_at).toLocaleDateString()})</span>}
                      {h.notes && <span className="text-gray-500 ml-2">- {h.notes}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}
