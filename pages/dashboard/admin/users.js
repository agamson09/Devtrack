import { csrfFetch } from '@/lib/csrfFetch';
import { useState, useEffect, useRef } from 'react'
import Layout from '@/components/layout/Layout'
import Loading from '@/components/common/Loading'
import Toast from '@/components/common/Toast'
import Avatar from '@/components/common/Avatar'
import { useAuth } from '@/components/AuthContext'
import { useTenant } from '@/hooks/useTenant'

const ROLE_COLORS = {
  owner: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  admin: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  member: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  viewer: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
}

const ROLE_OPTIONS = [
  { value: 'member', label: 'Member', desc: 'Can view and edit tasks' },
  { value: 'admin', label: 'Admin', desc: 'Can manage users and settings' },
  { value: 'viewer', label: 'Viewer', desc: 'Read-only access' },
]

export default function AdminUsers() {
  const { user } = useAuth()
  const { settings: tenantSettings, tenant } = useTenant()
  const [members, setMembers] = useState([])
  const [pendingInvites, setPendingInvites] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showAddUserModal, setShowAddUserModal] = useState(false)
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'member', name: '', password: '' })
  const [addForm, setAddForm] = useState({ email: '', role: 'member' })
  const [allUsers, setAllUsers] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [inviteLink, setInviteLink] = useState('')
  const [creatingInvite, setCreatingInvite] = useState(false)

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchMembers()
      fetchAllUsers()
    }
  }, [user])

  async function fetchMembers() {
    try {
      const res = await fetch('/api/tenant/users')
      if (res.ok) {
        const data = await res.json()
        setMembers(data.members || [])
        setPendingInvites(data.pendingInvites || [])
      }
    } catch {} finally { setLoading(false) }
  }

  async function fetchAllUsers() {
    try {
      const res = await fetch('/api/users')
      if (res.ok) {
        const data = await res.json()
        setAllUsers(data.users || [])
      }
    } catch {}
  }

  async function handleInvite(e) {
    e.preventDefault()
    setCreatingInvite(true)
    try {
      const res = await fetch('/api/tenant/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inviteForm),
      })
      const data = await res.json()
      if (res.ok) {
        setToast({ type: 'success', message: data.message })
        if (data.inviteToken) {
          setInviteLink(`${window.location.origin}/invite/${data.inviteToken}`)
        }
        setInviteForm({ email: '', role: 'member', name: '', password: '' })
        fetchMembers()
      } else {
        setToast({ type: 'error', message: data.error })
      }
    } catch { setToast({ type: 'error', message: 'Failed to create invite' }) }
    finally { setCreatingInvite(false) }
  }

  async function handleAddExisting(e) {
    e.preventDefault()
    try {
      const res = await fetch('/api/tenant/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: addForm.email, role: addForm.role }),
      })
      const data = await res.json()
      if (res.ok) {
        setToast({ type: 'success', message: data.message })
        setShowAddUserModal(false)
        setAddForm({ email: '', role: 'member' })
        fetchMembers()
      } else {
        setToast({ type: 'error', message: data.error })
      }
    } catch { setToast({ type: 'error', message: 'Failed to add user' }) }
  }

  async function handleRoleChange(userId, newRole) {
    try {
      const res = await fetch('/api/tenant/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: newRole }),
      })
      const data = await res.json()
      if (res.ok) {
        setToast({ type: 'success', message: 'Role updated' })
        fetchMembers()
      } else {
        setToast({ type: 'error', message: data.error })
      }
    } catch { setToast({ type: 'error', message: 'Failed to update role' }) }
  }

  async function handleRemoveMember(userId, name) {
    if (!confirm(`Remove ${name} from this tenant?`)) return
    try {
      const res = await fetch('/api/tenant/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const data = await res.json()
      if (res.ok) {
        setToast({ type: 'success', message: `${name} removed` })
        fetchMembers()
      } else {
        setToast({ type: 'error', message: data.error })
      }
    } catch { setToast({ type: 'error', message: 'Failed to remove member' }) }
  }

  async function handleRevokeInvite(inviteId) {
    try {
      const res = await fetch('/api/tenant/invite', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteId }),
      })
      if (res.ok) {
        setToast({ type: 'success', message: 'Invite revoked' })
        fetchMembers()
      }
    } catch { setToast({ type: 'error', message: 'Failed to revoke invite' }) }
  }

  function copyInviteLink() {
    navigator.clipboard.writeText(inviteLink)
    setToast({ type: 'success', message: 'Invite link copied!' })
  }

  const filteredUsers = allUsers.filter(u => {
    const isMember = members.some(m => m.id === u.id)
    const matchesSearch = u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesSearch
  })

  if (user?.role !== 'admin') {
    return <Layout><div className="flex items-center justify-center h-64"><p className="text-gray-400">Admin access required</p></div></Layout>
  }

  if (loading) {
    return <Layout><div className="flex items-center justify-center h-64"><Loading /></div></Layout>
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto p-6 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Team Members</h1>
            <p className="text-gray-400 mt-1">Manage who has access to {tenantSettings?.app_name || 'DevTrack'}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setShowInviteModal(true); setInviteLink(''); setShowAddUserModal(false) }}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors">
              <i className="fa-solid fa-paper-plane mr-2"></i>Invite
            </button>
            <button onClick={() => { setShowAddUserModal(true); setShowInviteModal(false) }}
              className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 text-sm font-medium transition-colors">
              <i className="fa-solid fa-user-plus mr-2"></i>Add Existing
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {['owner', 'admin', 'member', 'viewer'].map(role => {
            const count = members.filter(m => m.tenant_role === role).length
            return (
              <div key={role} className="bg-gray-800 rounded-xl border border-gray-700 p-4 text-center">
                <p className="text-2xl font-bold text-white">{count}</p>
                <p className="text-xs text-gray-400 capitalize mt-1">{role}s</p>
              </div>
            )
          })}
        </div>

        {/* Pending Invites */}
        {pendingInvites.length > 0 && (
          <section className="bg-gray-800 rounded-xl border border-gray-700">
            <div className="px-6 py-4 border-b border-gray-700">
              <h2 className="text-sm font-semibold text-gray-300">
                <i className="fa-solid fa-clock mr-2 text-yellow-400"></i>
                Pending Invites ({pendingInvites.length})
              </h2>
            </div>
            <div className="divide-y divide-gray-700/50">
              {pendingInvites.map(invite => (
                <div key={invite.id} className="px-6 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center">
                      <i className="fa-solid fa-envelope text-gray-400 text-sm"></i>
                    </div>
                    <div>
                      <p className="text-sm text-white">{invite.email}</p>
                      <p className="text-xs text-gray-500">
                        Invited by {invite.invited_by_name} · expires {new Date(invite.expires_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${ROLE_COLORS[invite.role] || ROLE_COLORS.member}`}>
                      {invite.role}
                    </span>
                    <button onClick={() => handleRevokeInvite(invite.id)}
                      className="text-gray-500 hover:text-red-400 transition-colors p-1" title="Revoke">
                      <i className="fa-solid fa-times text-sm"></i>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Members List */}
        <section className="bg-gray-800 rounded-xl border border-gray-700">
          <div className="px-6 py-4 border-b border-gray-700">
            <h2 className="text-sm font-semibold text-gray-300">
              <i className="fa-solid fa-users mr-2 text-indigo-400"></i>
              Members ({members.length})
            </h2>
          </div>
          <div className="divide-y divide-gray-700/50">
            {members.map(member => (
              <div key={member.membership_id} className="px-6 py-3 flex items-center justify-between hover:bg-gray-700/50 transition-colors">
                <div className="flex items-center gap-3">
                  <Avatar name={member.name} src={member.avatar} avatarStyle={member.avatar_style}
                    avatarSeed={member.avatar_seed} avatarOptions={member.avatar_options} size="sm" />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white">{member.name}</p>
                      {member.id === user?.id && (
                        <span className="text-[10px] text-gray-500">(you)</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">{member.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{member.task_count} tasks</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${ROLE_COLORS[member.tenant_role] || ROLE_COLORS.member}`}>
                      {member.tenant_role}
                    </span>
                  </div>

                  {member.tenant_role !== 'owner' && member.id !== user?.id && (
                    <div className="flex items-center gap-1">
                      <select value={member.tenant_role}
                        onChange={(e) => handleRoleChange(member.id, e.target.value)}
                        className="bg-gray-700 border border-gray-600 rounded text-xs text-gray-300 px-2 py-1 focus:ring-1 focus:ring-indigo-500">
                        <option value="admin">Admin</option>
                        <option value="member">Member</option>
                        <option value="viewer">Viewer</option>
                      </select>
                      <button onClick={() => handleRemoveMember(member.id, member.name)}
                        className="text-gray-500 hover:text-red-400 transition-colors p-1" title="Remove">
                        <i className="fa-solid fa-trash text-xs"></i>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {members.length === 0 && (
              <div className="px-6 py-8 text-center text-gray-500">
                No members yet. Invite someone to get started.
              </div>
            )}
          </div>
        </section>

        {/* Invite Modal */}
        {showInviteModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowInviteModal(false)}>
            <div className="bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full p-6" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-white">Invite Team Member</h2>
                <button onClick={() => setShowInviteModal(false)} className="text-gray-400 hover:text-white">
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>

              <form onSubmit={handleInvite} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                  <input type="email" value={inviteForm.email} onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-indigo-500"
                    placeholder="colleague@company.com" required />
                  <p className="text-xs text-gray-500 mt-1">If user exists, they'll be added directly. Otherwise, an invite link will be generated.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Role</label>
                  <div className="grid grid-cols-3 gap-2">
                    {ROLE_OPTIONS.map(opt => (
                      <button key={opt.value} type="button"
                        onClick={() => setInviteForm({ ...inviteForm, role: opt.value })}
                        className={`p-3 rounded-lg border text-center transition-all ${
                          inviteForm.role === opt.value
                            ? 'border-indigo-500 bg-indigo-500/10 text-white'
                            : 'border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-500'
                        }`}>
                        <p className="text-sm font-medium">{opt.label}</p>
                        <p className="text-[10px] text-gray-500 mt-1">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {inviteLink && (
                  <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <p className="text-xs text-green-400 mb-2">Invite link generated! Share this link:</p>
                    <div className="flex items-center gap-2">
                      <input type="text" value={inviteLink} readOnly
                        className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded text-xs text-gray-300 font-mono" />
                      <button type="button" onClick={copyInviteLink}
                        className="px-3 py-2 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700">
                        <i className="fa-solid fa-copy"></i>
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setShowInviteModal(false)}
                    className="px-4 py-2 text-gray-400 hover:text-white text-sm transition-colors">Cancel</button>
                  <button type="submit" disabled={creatingInvite}
                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium transition-colors">
                    {creatingInvite ? 'Sending...' : 'Send Invite'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Add Existing User Modal */}
        {showAddUserModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowAddUserModal(false)}>
            <div className="bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full p-6" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-white">Add Existing User</h2>
                <button onClick={() => setShowAddUserModal(false)} className="text-gray-400 hover:text-white">
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>

              <div className="mb-4">
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search users..." className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-indigo-500" />
              </div>

              <div className="max-h-64 overflow-y-auto space-y-1">
                {filteredUsers.filter(u => !members.some(m => m.id === u.id)).map(u => (
                  <button key={u.id}
                    onClick={() => { setAddForm({ ...addForm, email: u.email }); handleAddExisting({ preventDefault: () => {} }) }}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-700 transition-colors text-left">
                    <Avatar name={u.name} src={u.avatar} size="sm" />
                    <div>
                      <p className="text-sm text-white">{u.name}</p>
                      <p className="text-xs text-gray-500">{u.email}</p>
                    </div>
                    <span className={`ml-auto px-2 py-0.5 rounded text-xs ${u.is_active ? 'bg-green-500/20 text-green-400' : 'bg-gray-600 text-gray-500'}`}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </button>
                ))}
                {filteredUsers.filter(u => !members.some(m => m.id === u.id)).length === 0 && (
                  <p className="text-gray-500 text-sm text-center py-4">No users found</p>
                )}
              </div>

              <div className="flex justify-end mt-4">
                <button onClick={() => setShowAddUserModal(false)}
                  className="px-4 py-2 text-gray-400 hover:text-white text-sm transition-colors">Close</button>
              </div>
            </div>
          </div>
        )}

        {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
      </div>
    </Layout>
  )
}
