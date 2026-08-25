import { csrfFetch } from '@/lib/csrfFetch';
import { useState, useEffect, useMemo } from 'react'
import Layout from '@/components/layout/Layout'
import { useAuth } from '@/components/AuthContext'
import Avatar from '@/components/common/Avatar'

const ROLE_CONFIG = {
  admin: { label: 'Admin', color: 'bg-indigo-500/20 border-indigo-500/30 text-indigo-400', icon: 'fa-crown' },
  member: { label: 'Member', color: 'bg-gray-600/20 border-gray-600/30 text-gray-300', icon: 'fa-user' },
  it_support: { label: 'IT Support', color: 'bg-green-500/20 border-green-500/30 text-green-400', icon: 'fa-headset' },
}

export default function TeamPage() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'member' })
  const [saving, setSaving] = useState(false)
  const [confirmAction, setConfirmAction] = useState(null)

  useEffect(() => { fetchUsers() }, [])

  async function fetchUsers() {
    try {
      const res = await fetch('/api/users')
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users || [])
      }
    } catch {}
    setLoading(false)
  }

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      if (filterRole !== 'all' && u.role !== filterRole) return false
      if (search) {
        const q = search.toLowerCase()
        if (!u.name?.toLowerCase().includes(q) && !u.email?.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [users, search, filterRole])

  const roleCounts = useMemo(() => {
    const counts = { all: users.length, admin: 0, member: 0, it_support: 0 }
    users.forEach(u => { if (counts[u.role] !== undefined) counts[u.role]++ })
    return counts
  }, [users])

  function openCreate() {
    setEditingUser(null)
    setForm({ name: '', email: '', password: '', role: 'member' })
    setShowModal(true)
  }

  function openEdit(u) {
    setEditingUser(u)
    setForm({ name: u.name, email: u.email, password: '', role: u.role })
    setShowModal(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      if (editingUser) {
        const body = { name: form.name, email: form.email, role: form.role }
        const res = await csrfFetch(`/api/users/${editingUser.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (res.ok) {
          const data = await res.json()
          setUsers(prev => prev.map(u => u.id === editingUser.id ? data.user : u))
          setShowModal(false)
        } else {
          const data = await res.json()
          alert(data.error || 'Failed to update user')
        }
      } else {
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        if (res.ok) {
          const data = await res.json()
          setUsers(prev => [...prev, data.user])
          setShowModal(false)
        } else {
          const data = await res.json()
          alert(data.error || 'Failed to create user')
        }
      }
    } catch {}
    setSaving(false)
  }

  async function toggleActive(userId, currentStatus) {
    try {
      const res = await csrfFetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentStatus }),
      })
      if (res.ok) {
        const data = await res.json()
        setUsers(prev => prev.map(u => u.id === userId ? data.user : u))
      }
    } catch {}
    setConfirmAction(null)
  }

  async function deleteUser(userId) {
    try {
      const res = await csrfFetch(`/api/users/${userId}`, { method: 'DELETE' })
      if (res.ok) {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: 0 } : u))
      }
    } catch {}
    setConfirmAction(null)
  }

  if (currentUser?.role !== 'admin') {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <i className="fa-solid fa-lock text-4xl text-gray-600 mb-4"></i>
            <p className="text-gray-400 text-lg">Access Denied</p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout title="Team Management">
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white">Team</h1>
            <p className="text-gray-400 text-sm">{users.length} members</p>
          </div>
          <button onClick={openCreate} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors">
            <i className="fa-solid fa-plus mr-2"></i>Add Member
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {[
            { key: 'all', label: 'All' },
            { key: 'admin', label: 'Admin' },
            { key: 'member', label: 'Member' },
            { key: 'it_support', label: 'IT Support' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilterRole(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${filterRole === f.key ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 border border-gray-700 hover:text-white'}`}
            >
              {f.label}
              <span className="ml-1.5 text-[10px] opacity-70">{roleCounts[f.key]}</span>
            </button>
          ))}
        </div>

        <div className="relative">
          <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm"></i>
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full"></div>
          </div>
        ) : (
          <div className="grid gap-3">
            {filteredUsers.map(u => (
              <div key={u.id} className={`bg-gray-800 rounded-xl border border-gray-700 p-4 flex items-center gap-4 ${!u.is_active ? 'opacity-50' : ''}`}>
                <Avatar name={u.name} src={u.avatar} avatarStyle={u.avatar_style} avatarSeed={u.avatar_seed} avatarOptions={u.avatar_options} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-white truncate">{u.name}</p>
                    {u.id === currentUser.id && <span className="text-[10px] text-indigo-400">(you)</span>}
                    {!u.is_active && <span className="text-[10px] text-red-400">Inactive</span>}
                  </div>
                  <p className="text-xs text-gray-500 truncate">{u.email}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium border ${ROLE_CONFIG[u.role]?.color || ''}`}>
                    <i className={`fa-solid ${ROLE_CONFIG[u.role]?.icon || 'fa-user'}`}></i>
                    {ROLE_CONFIG[u.role]?.label || u.role}
                  </span>
                  {u.task_count > 0 && (
                    <span className="text-[10px] text-gray-500">{u.task_count} tasks</span>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => openEdit(u)} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors" title="Edit">
                    <i className="fa-solid fa-pen text-xs"></i>
                  </button>
                  {u.id !== currentUser.id && (
                    <>
                      {u.is_active ? (
                        <button onClick={() => setConfirmAction({ type: 'deactivate', userId: u.id })} className="p-2 text-gray-400 hover:text-amber-400 hover:bg-gray-700 rounded-lg transition-colors" title="Deactivate">
                          <i className="fa-solid fa-user-slash text-xs"></i>
                        </button>
                      ) : (
                        <button onClick={() => toggleActive(u.id, true)} className="p-2 text-gray-400 hover:text-emerald-400 hover:bg-gray-700 rounded-lg transition-colors" title="Activate">
                          <i className="fa-solid fa-user-check text-xs"></i>
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
            {filteredUsers.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <i className="fa-solid fa-users text-4xl mb-3 block"></i>
                <p>No members found</p>
              </div>
            )}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
          <div className="relative bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">{editingUser ? 'Edit Member' : 'Add Member'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white"><i className="fa-solid fa-xmark"></i></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Name</label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Email</label>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
              </div>
              {!editingUser && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Password</label>
                  <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                </div>
              )}
              <div>
                <label className="block text-xs text-gray-400 mb-1">Role</label>
                <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                  <option value="admin">Admin</option>
                  <option value="member">Member</option>
                  <option value="it_support">IT Support</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={handleSave} disabled={saving}
                className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                {saving ? 'Saving...' : editingUser ? 'Save Changes' : 'Create Member'}
              </button>
              <button onClick={() => setShowModal(false)} className="px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm font-medium transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setConfirmAction(null)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
          <div className="relative bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="text-center">
              <i className={`fa-solid ${confirmAction.type === 'deactivate' ? 'fa-user-slash text-amber-400' : 'fa-trash text-red-400'} text-3xl mb-3`}></i>
              <h3 className="text-lg font-bold text-white">{confirmAction.type === 'deactivate' ? 'Deactivate User?' : 'Delete User?'}</h3>
              <p className="text-gray-400 text-sm mt-1">
                {confirmAction.type === 'deactivate'
                  ? 'This user will no longer be able to log in.'
                  : 'This action cannot be undone.'}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => confirmAction.type === 'deactivate'
                  ? toggleActive(confirmAction.userId, false)
                  : deleteUser(confirmAction.userId)}
                className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-colors ${confirmAction.type === 'deactivate' ? 'bg-amber-600 hover:bg-amber-500' : 'bg-red-600 hover:bg-red-500'}`}
              >
                {confirmAction.type === 'deactivate' ? 'Deactivate' : 'Delete'}
              </button>
              <button onClick={() => setConfirmAction(null)} className="flex-1 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm font-medium transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
