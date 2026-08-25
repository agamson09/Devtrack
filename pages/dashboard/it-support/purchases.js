import { useState, useEffect } from 'react'
import Layout from '@/components/layout/Layout'
import { useAuth } from '@/components/AuthContext'
import { useRouter } from 'next/router'

export default function PurchasesPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [purchases, setPurchases] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [detail, setDetail] = useState(null)
  const [form, setForm] = useState({ item_name: '', description: '', quantity: 1, estimated_price: '', urgency: 'medium', reason: '' })
  const [reviewForm, setReviewForm] = useState({ status: '', review_note: '' })
  const [submitting, setSubmitting] = useState(false)

  const isAdmin = user?.role === 'admin' || user?.role === 'it_support'

  useEffect(() => { if (user && !isAdmin) router.push('/dashboard') }, [user])
  useEffect(() => { loadPurchases() }, [user])

  async function loadPurchases() {
    try {
      const res = await fetch('/api/it-support/purchases')
      const data = await res.json()
      setPurchases(data.purchases || [])
    } catch {}
    setLoading(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await fetch('/api/it-support/purchases', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, estimated_price: form.estimated_price || null })
      })
      setShowForm(false)
      setForm({ item_name: '', description: '', quantity: 1, estimated_price: '', urgency: 'medium', reason: '' })
      loadPurchases()
    } catch {}
    setSubmitting(false)
  }

  async function handleReview(id) {
    try {
      await fetch(`/api/it-support/purchases/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reviewForm)
      })
      setDetail(null)
      setReviewForm({ status: '', review_note: '' })
      loadPurchases()
    } catch {}
  }

  function statusBadge(s) {
    const colors = { pending: 'bg-yellow-500/20 text-yellow-400', approved: 'bg-green-500/20 text-green-400', rejected: 'bg-red-500/20 text-red-400', ordered: 'bg-blue-500/20 text-blue-400', received: 'bg-purple-500/20 text-purple-400' }
    return <span className={`px-2 py-1 rounded text-xs font-medium ${colors[s] || 'bg-gray-600 text-gray-300'}`}>{s}</span>
  }

  function urgencyBadge(u) {
    const c = { low: 'text-gray-400', medium: 'text-yellow-400', high: 'text-orange-400', critical: 'text-red-400' }
    return <span className={`text-xs font-medium capitalize ${c[u] || ''}`}>{u}</span>
  }

  if (loading) return <Layout title="Purchases"><div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full"></div></div></Layout>

  return (
    <Layout title="Purchase Requests">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-gray-400">{purchases.length} total requests</p>
          <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors">
            <i className="fa-solid fa-plus text-xs"></i> New Request
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-gray-800 rounded-xl p-6 border border-gray-700 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Item Name *</label>
                <input value={form.item_name} onChange={e => setForm({ ...form, item_name: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none" required />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Quantity</label>
                <input type="number" min="1" value={form.quantity} onChange={e => setForm({ ...form, quantity: parseInt(e.target.value) || 1 })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Estimated Price (Rp)</label>
                <input type="number" value={form.estimated_price} onChange={e => setForm({ ...form, estimated_price: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none" placeholder="e.g. 15000000" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Urgency</label>
                <select value={form.urgency} onChange={e => setForm({ ...form, urgency: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none">
                  <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Description</label>
              <textarea rows="2" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Reason / Justification</label>
              <textarea rows="2" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none" />
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={submitting} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">{submitting ? 'Submitting...' : 'Submit Request'}</button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium">Cancel</button>
            </div>
          </form>
        )}

        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <table className="w-full">
            <thead><tr className="border-b border-gray-700">
              <th className="text-left text-xs font-medium text-gray-400 uppercase px-6 py-3">Item</th>
              <th className="text-left text-xs font-medium text-gray-400 uppercase px-6 py-3">Qty</th>
              <th className="text-left text-xs font-medium text-gray-400 uppercase px-6 py-3">Est. Price</th>
              <th className="text-left text-xs font-medium text-gray-400 uppercase px-6 py-3">Urgency</th>
              <th className="text-left text-xs font-medium text-gray-400 uppercase px-6 py-3">Status</th>
              <th className="text-left text-xs font-medium text-gray-400 uppercase px-6 py-3">Requested By</th>
              <th className="text-left text-xs font-medium text-gray-400 uppercase px-6 py-3">Date</th>
              <th className="text-left text-xs font-medium text-gray-400 uppercase px-6 py-3">Action</th>
            </tr></thead>
            <tbody>
              {purchases.map(p => (
                <tr key={p.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="px-6 py-4 text-sm text-white font-medium">{p.item_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-300">{p.quantity}</td>
                  <td className="px-6 py-4 text-sm text-gray-300">{p.estimated_price ? `Rp ${Number(p.estimated_price).toLocaleString()}` : '-'}</td>
                  <td className="px-6 py-4">{urgencyBadge(p.urgency)}</td>
                  <td className="px-6 py-4">{statusBadge(p.status)}</td>
                  <td className="px-6 py-4 text-sm text-gray-300">{p.requested_by_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-400">{new Date(p.created_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4">
                    <button onClick={() => setDetail(detail?.id === p.id ? null : p)} className="text-indigo-400 hover:text-indigo-300 text-sm"><i className="fa-solid fa-eye"></i></button>
                  </td>
                </tr>
              ))}
              {purchases.length === 0 && <tr><td colSpan="8" className="px-6 py-12 text-center text-gray-500">No purchase requests yet</td></tr>}
            </tbody>
          </table>
        </div>

        {detail && (
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">{detail.item_name}</h3>
              <button onClick={() => setDetail(null)} className="text-gray-400 hover:text-white"><i className="fa-solid fa-xmark"></i></button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
              <div><span className="text-gray-400">Status:</span> <span className="ml-2">{statusBadge(detail.status)}</span></div>
              <div><span className="text-gray-400">Quantity:</span> <span className="ml-2 text-white">{detail.quantity}</span></div>
              <div><span className="text-gray-400">Est. Price:</span> <span className="ml-2 text-white">{detail.estimated_price ? `Rp ${Number(detail.estimated_price).toLocaleString()}` : '-'}</span></div>
              <div><span className="text-gray-400">Urgency:</span> <span className="ml-2">{urgencyBadge(detail.urgency)}</span></div>
            </div>
            {detail.description && <p className="text-gray-300 text-sm mb-2"><span className="text-gray-400">Description:</span> {detail.description}</p>}
            {detail.reason && <p className="text-gray-300 text-sm mb-4"><span className="text-gray-400">Reason:</span> {detail.reason}</p>}
            {detail.review_note && <p className="text-gray-300 text-sm mb-4"><span className="text-gray-400">Review Note:</span> {detail.review_note}</p>}

            {(isAdmin && detail.status === 'pending') && (
              <div className="border-t border-gray-700 pt-4 space-y-3">
                <h4 className="text-sm font-medium text-white">Review Request</h4>
                <div className="flex gap-3">
                  {['approved', 'rejected'].map(s => (
                    <button key={s} onClick={() => setReviewForm({ ...reviewForm, status: s })} className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${reviewForm.status === s ? (s === 'approved' ? 'bg-green-600 text-white' : 'bg-red-600 text-white') : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>{s.charAt(0).toUpperCase() + s.slice(1)}</button>
                  ))}
                  <button onClick={() => setReviewForm({ ...reviewForm, status: 'ordered' })} className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${reviewForm.status === 'ordered' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>Ordered</button>
                </div>
                <textarea rows="2" value={reviewForm.review_note} onChange={e => setReviewForm({ ...reviewForm, review_note: e.target.value })} placeholder="Review note (optional)" className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none" />
                {reviewForm.status && (
                  <button onClick={() => handleReview(detail.id)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium">Submit Review</button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}
