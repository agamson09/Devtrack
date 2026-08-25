import { useState } from 'react'
import { useRouter } from 'next/router'
import { useToast } from '@/components/ToastContext'

export default function RegisterPage() {
  const router = useRouter()
  const { showToast } = useToast()
  const [mode, setMode] = useState(null) // null = choose, 'create' = new workspace, 'join' = join existing
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', workspaceName: '', inviteCode: '' })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (form.password !== form.confirmPassword) {
      showToast('error', 'Passwords do not match')
      return
    }

    if (form.password.length < 8) {
      showToast('error', 'Password must be at least 8 characters')
      return
    }

    if (!/[A-Z]/.test(form.password)) {
      showToast('error', 'Password must contain at least 1 uppercase letter')
      return
    }

    if (!/[a-z]/.test(form.password)) {
      showToast('error', 'Password must contain at least 1 lowercase letter')
      return
    }

    if (!/[0-9]/.test(form.password)) {
      showToast('error', 'Password must contain at least 1 number')
      return
    }

    if (mode === 'create' && (!form.workspaceName || form.workspaceName.trim().length < 2)) {
      showToast('error', 'Workspace name must be at least 2 characters')
      return
    }

    if (mode === 'join' && !form.inviteCode.trim()) {
      showToast('error', 'Please enter an invite code')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
          mode,
          workspaceName: form.workspaceName,
          inviteCode: form.inviteCode,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        showToast('error', data.error || 'Registration failed')
        setLoading(false)
        return
      }

      const modeText = mode === 'create' ? 'Workspace created' : mode === 'join' ? 'Joined workspace' : 'Account created'
      showToast('success', `${modeText}! Please sign in.`)
      router.push('/login')
    } catch (err) {
      showToast('error', 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4 relative overflow-hidden">
      {/* Ambient glow blobs */}
      <div className="absolute -top-32 -left-32 w-[28rem] h-[28rem] rounded-full blur-[120px] opacity-20 animate-float pointer-events-none bg-indigo-600" />
      <div className="absolute -bottom-40 -right-24 w-[30rem] h-[30rem] rounded-full blur-[130px] opacity-15 animate-float pointer-events-none bg-violet-700" style={{ animationDelay: '2.5s' }} />

      <div className="w-full max-w-md relative z-10 animate-fade-in-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-2xl mb-4 shadow-glow">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold gradient-text">DevTrack</h1>
          <p className="text-gray-400 mt-2">Create your account</p>
        </div>

        {/* STEP 1: Choose mode */}
        {!mode && (
          <div className="space-y-4 animate-fade-in">
            <button
              onClick={() => setMode('create')}
              className="w-full glass-panel !rounded-2xl hover:border-indigo-500/60 p-6 text-left transition-all duration-200 group hover:-translate-y-0.5 hover:shadow-card-hover"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-600/20 rounded-xl flex items-center justify-center group-hover:bg-indigo-600/30 group-hover:scale-105 transition-all duration-200">
                  <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-white font-semibold text-lg">Create new workspace</h3>
                  <p className="text-gray-400 text-sm mt-1">Set up a new workspace for your team. You'll be the admin.</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setMode('join')}
              className="w-full glass-panel !rounded-2xl hover:border-emerald-500/60 p-6 text-left transition-all duration-200 group hover:-translate-y-0.5 hover:shadow-card-hover"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-600/20 rounded-xl flex items-center justify-center group-hover:bg-emerald-600/30 group-hover:scale-105 transition-all duration-200">
                  <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-white font-semibold text-lg">Join existing workspace</h3>
                  <p className="text-gray-400 text-sm mt-1">Join your team's workspace using an invite code.</p>
                </div>
              </div>
            </button>

            <div className="text-center pt-4">
              <p className="text-gray-400 text-sm">
                Already have an account?{' '}
                <a href="/login" className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
                  Sign in
                </a>
              </p>
            </div>
          </div>
        )}

        {/* STEP 2: Fill form */}
        {mode && (
          <div className="glass-panel p-8 animate-fade-in">
            {/* Back button */}
            <button
              onClick={() => setMode(null)}
              className="flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-6 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>

            {/* Mode header */}
            <div className="mb-6">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${mode === 'create' ? 'bg-indigo-600/20' : 'bg-emerald-600/20'}`}>
                  {mode === 'create' ? (
                    <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                  )}
                </div>
                <div>
                  <h2 className="text-white font-semibold">
                    {mode === 'create' ? 'Create new workspace' : 'Join workspace'}
                  </h2>
                  <p className="text-gray-400 text-sm">
                    {mode === 'create' ? "You'll be the admin of this workspace" : 'Enter the invite code from your team admin'}
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Workspace name (create mode) */}
              {mode === 'create' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Workspace Name</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Acme Corp"
                    value={form.workspaceName}
                    onChange={(e) => setForm({ ...form, workspaceName: e.target.value })}
                    required
                  />
                </div>
              )}

              {/* Invite code (join mode) */}
              {mode === 'join' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Invite Code</label>
                  <input
                    type="text"
                    className="input-field font-mono"
                    placeholder="e.g. AbCdEfGhIjKlMnOpQrStUvWxYz1234"
                    value={form.inviteCode}
                    onChange={(e) => setForm({ ...form, inviteCode: e.target.value })}
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Full Name</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="John Doe"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Email</label>
                <input
                  type="email"
                  className="input-field"
                  placeholder="you@company.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Password</label>
                <input
                  type="password"
                  className="input-field"
                  placeholder="Min 6 characters"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Confirm Password</label>
                <input
                  type="password"
                  className="input-field"
                  placeholder="Repeat your password"
                  value={form.confirmPassword}
                  onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-white transition-all duration-200 shadow-glow hover:brightness-110 active:scale-[0.98] ${
                  mode === 'create'
                    ? 'bg-gradient-to-b from-indigo-500 to-indigo-600'
                    : 'bg-gradient-to-b from-emerald-500 to-emerald-600'
                } disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:brightness-100`}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Creating account...
                  </>
                ) : (
                  mode === 'create' ? 'Create workspace & account' : 'Join workspace'
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-gray-400 text-sm">
                Already have an account?{' '}
                <a href="/login" className="text-indigo-400 hover:text-indigo-300 font-medium">
                  Sign in
                </a>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
