import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Loading from '@/components/common/Loading'

export default function InviteAccept() {
  const router = useRouter()
  const { token } = router.query
  const [invite, setInvite] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  const [form, setForm] = useState({
    name: '',
    password: '',
    confirmPassword: '',
  })

  useEffect(() => {
    if (token) validateInvite()
  }, [token])

  async function validateInvite() {
    try {
      const res = await fetch(`/api/tenant/invite?token=${token}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Invalid invite')
      } else {
        setInvite(data)
      }
    } catch {
      setError('Failed to load invite')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: invite.email,
          password: form.password,
          role: 'member',
          inviteToken: token,
        }),
      })

      if (res.ok) {
        setSuccess(true)
        setTimeout(() => router.push('/dashboard'), 2000)
      } else {
        const data = await res.json()
        setError(data.error || 'Registration failed')
      }
    } catch {
      setError('Registration failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loading />
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="bg-gray-800 rounded-2xl p-8 max-w-md w-full text-center shadow-xl">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fa-solid fa-check text-2xl text-green-400"></i>
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Welcome to {invite?.tenantName}!</h1>
          <p className="text-gray-400">Your account has been created. Redirecting to dashboard...</p>
        </div>
      </div>
    )
  }

  if (error && !invite) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="bg-gray-800 rounded-2xl p-8 max-w-md w-full text-center shadow-xl">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fa-solid fa-times text-2xl text-red-400"></i>
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Invite Invalid</h1>
          <p className="text-gray-400">{error}</p>
          <button onClick={() => router.push('/')} className="mt-6 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
            Go Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-2xl p-8 max-w-md w-full shadow-xl">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-indigo-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fa-solid fa-user-plus text-2xl text-indigo-400"></i>
          </div>
          <h1 className="text-xl font-bold text-white">Join {invite?.tenantName}</h1>
          <p className="text-gray-400 mt-1">
            You've been invited as <span className="text-indigo-400 font-medium">{invite?.role}</span>
          </p>
          <p className="text-gray-500 text-sm mt-1">{invite?.email}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Your Name</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="John Doe" required />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Password</label>
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Min. 6 characters" required minLength={6} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Confirm Password</label>
            <input type="password" value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Repeat password" required minLength={6} />
          </div>

          <button type="submit" disabled={submitting}
            className="w-full py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium transition-colors">
            {submitting ? 'Creating Account...' : 'Accept Invite & Join'}
          </button>
        </form>
      </div>
    </div>
  )
}
