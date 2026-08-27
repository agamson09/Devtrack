import { useState, useEffect } from 'react'
import Layout from '@/components/layout/Layout'
import Loading from '@/components/common/Loading'
import Toast from '@/components/common/Toast'
import Avatar from '@/components/common/Avatar'
import { useAuth } from '@/components/AuthContext'
import { useRouter } from 'next/router'

export default function PendingApprovals() {
  const { user } = useAuth()
  const router = useRouter()
  const [pendingUsers, setPendingUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const [approving, setApproving] = useState(null)

  useEffect(() => {
    if (user && user.id !== 1) {
      router.push('/dashboard')
    } else if (user?.id === 1) {
      fetchPendingUsers()
    }
  }, [user])

  async function fetchPendingUsers() {
    try {
      const res = await fetch('/api/admin/pending-users')
      if (res.ok) {
        const data = await res.json()
        setPendingUsers(data.users || [])
      } else {
        throw new Error('Failed to fetch pending users')
      }
    } catch (err) {
      console.error(err)
      setToast({ message: err.message, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  async function handleApprove(userId, name) {
    setApproving(userId)
    try {
      const res = await fetch('/api/admin/approve-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: userId })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to approve user')
      }

      setToast({ message: `${name} has been approved successfully!`, type: 'success' })
      fetchPendingUsers()
    } catch (err) {
      setToast({ message: err.message, type: 'error' })
    } finally {
      setApproving(null)
    }
  }

  if (loading || !user || user.id !== 1) {
    return (
      <Layout title="Pending Approvals">
        <Loading />
      </Layout>
    )
  }

  return (
    <Layout title="Pending Approvals">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Registration Approvals</h1>
        <p className="text-gray-500 dark:text-gray-400">Review and approve new users trying to access the system.</p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-500 dark:text-gray-400">
              <tr>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Registration Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {pendingUsers.length === 0 ? (
                <tr>
                  <td colSpan="3" className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <i className="fa-solid fa-check-circle text-4xl text-green-500/50"></i>
                      <p>No pending users to approve.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                pendingUsers.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/25 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <Avatar name={u.name} size="sm" />
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">{u.name}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {new Date(u.created_at).toLocaleDateString()} at {new Date(u.created_at).toLocaleTimeString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleApprove(u.id, u.name)}
                        disabled={approving === u.id}
                        className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                      >
                        {approving === u.id ? (
                          <i className="fa-solid fa-spinner fa-spin mr-2"></i>
                        ) : (
                          <i className="fa-solid fa-check mr-2"></i>
                        )}
                        Approve User
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  )
}
