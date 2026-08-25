import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '@/components/AuthContext'
import { useToast } from '@/components/ToastContext'

const SSO_ERRORS = {
  sso_not_configured: 'Provider SSO belum dikonfigurasi di server.',
  sso_config: 'Konfigurasi SSO di server bermasalah. Hubungi admin.',
  sso_state: 'Sesi login SSO kedaluwarsa. Coba lagi.',
  sso_failed: 'Login SSO gagal. Coba lagi.',
  sso_no_email: 'Provider tidak memberikan akses email — izinkan akses email lalu coba lagi.',
  sso_email_unverified: 'Email di provider lo belum terverifikasi. Verifikasi dulu, lalu coba lagi.',
}

const SSO_LABELS = { google: 'Google', github: 'GitHub', oidc: 'SSO Perusahaan' }

export default function LoginPage() {
  const router = useRouter()
  const { login } = useAuth()
  const { showToast } = useToast()
  const [form, setForm] = useState({ email: '', password: '', rememberMe: false })
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [branding, setBranding] = useState({ appName: 'DevTrack', logo: '', loginBg: '', primaryColor: '#6366f1' })
  const [ssoProviders, setSsoProviders] = useState([])

  // 2FA state
  const [twoFARequired, setTwoFARequired] = useState(false)
  const [twoFAToken, setTwoFAToken] = useState('')
  const [pendingTwoFA, setPendingTwoFA] = useState(null)

  useEffect(() => {
    fetch('/api/tenant/settings')
      .then(r => r.json())
      .then(data => {
        if (data.settings) {
          setBranding({
            appName: data.settings.app_name || 'DevTrack',
            logo: data.settings.logo_url || '',
            loginBg: data.settings.login_bg || '',
            primaryColor: data.settings.primary_color || '#6366f1',
          })
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/auth/oauth/providers')
      .then(r => r.json())
      .then(d => setSsoProviders(d.providers || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const err = router.query.error
    if (err && String(err).startsWith('sso')) {
      showToast('error', SSO_ERRORS[err] || 'Login SSO gagal. Coba lagi.')
      router.replace('/login', undefined, { shallow: true })
    }
  }, [router.query.error])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const result = await login(form.email, form.password, form.rememberMe)

      if (result.requiresTwoFactor) {
        setTwoFARequired(true)
        setPendingTwoFA(result.tempToken)
        setLoading(false)
        return
      }

      if (!result.success) {
        showToast('error', result.error || 'Login failed')
        setLoading(false)
        return
      }

      showToast('success', 'Welcome back!')
      router.push('/dashboard')
    } catch (err) {
      showToast('error', 'Something went wrong')
      setLoading(false)
    }
  }

  const handleTwoFASubmit = async (e) => {
    e.preventDefault()
    if (!twoFAToken || twoFAToken.length !== 6) {
      showToast('error', 'Enter a valid 6-digit code')
      return
    }

    setLoading(true)
    try {
      const result = await login(form.email, form.password, form.rememberMe, twoFAToken, pendingTwoFA)

      if (!result.success) {
        showToast('error', result.error || 'Invalid 2FA code')
        setLoading(false)
        return
      }

      showToast('success', 'Welcome back!')
      router.push('/dashboard')
    } catch (err) {
      showToast('error', 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
      style={branding.loginBg ? {
        backgroundImage: `url(${branding.loginBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      } : {
        background: `linear-gradient(135deg, ${branding.primaryColor}15 0%, #111827 50%, ${branding.primaryColor}10 100%)`,
      }}
    >
      {/* Ambient glow blobs */}
      {!branding.loginBg && (
        <>
          <div
            className="absolute -top-32 -left-32 w-[28rem] h-[28rem] rounded-full blur-[120px] opacity-20 animate-float pointer-events-none"
            style={{ background: branding.primaryColor }}
          />
          <div
            className="absolute -bottom-40 -right-24 w-[30rem] h-[30rem] rounded-full blur-[130px] opacity-15 animate-float pointer-events-none"
            style={{ background: '#7c3aed', animationDelay: '2.5s' }}
          />
        </>
      )}
      <div className="absolute inset-0 bg-gray-900/70" />

      <div className="w-full max-w-md relative z-10 animate-fade-in-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            {branding.logo ? (
              <img src={branding.logo} alt={branding.appName} className="h-16 w-auto drop-shadow-lg" />
            ) : (
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-glow overflow-hidden"
                style={{ background: `linear-gradient(135deg, ${branding.primaryColor}, ${branding.primaryColor}aa)` }}
              >
                <img src="/favicon-white.webp" alt={branding.appName} className="w-12 h-12 object-contain" />
              </div>
            )}
          </div>
          <h1 className="text-3xl font-bold gradient-text">{branding.appName}</h1>
          <p className="text-gray-400 mt-2">
            {twoFARequired ? 'Enter your 2FA code' : 'Sign in to your workspace'}
          </p>
        </div>

        <div className="glass-panel p-8">
          {router.query.error && String(router.query.error).startsWith('sso') && (
            <div className="mb-5 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-300">
              <i className="fa-solid fa-circle-exclamation mr-2"></i>
              {SSO_ERRORS[router.query.error] || 'Login SSO gagal. Coba lagi.'}
            </div>
          )}
          {!twoFARequired ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Email</label>
                <input
                  type="email"
                  className="input-field"
                  placeholder="you@company.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  autoComplete="email"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="input-field pr-11"
                    placeholder="Enter your password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors p-1 rounded-md"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-sm`}></i>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-gray-800 cursor-pointer"
                    checked={form.rememberMe}
                    onChange={(e) => setForm({ ...form, rememberMe: e.target.checked })}
                  />
                  <span className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors">Remember me for 30 days</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-white transition-all duration-200 shadow-glow hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:brightness-100"
                style={{ background: `linear-gradient(to bottom, ${branding.primaryColor}, ${branding.primaryColor}dd)` }}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign In
                    <i className="fa-solid fa-arrow-right-to-bracket text-sm"></i>
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleTwoFASubmit} className="space-y-5 animate-fade-in">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Two-Factor Code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  className="w-full px-4 py-3 bg-gray-700/60 border border-gray-600 rounded-xl text-white text-center text-2xl tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/70 focus:border-indigo-500/50 transition-all placeholder:text-gray-600"
                  placeholder="000000"
                  value={twoFAToken}
                  onChange={(e) => setTwoFAToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  autoFocus
                />
                <p className="text-gray-400 text-xs mt-2">Enter the 6-digit code from your authenticator app</p>
              </div>

              <button
                type="submit"
                disabled={loading || twoFAToken.length !== 6}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-white transition-all duration-200 shadow-glow hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:brightness-100"
                style={{ background: `linear-gradient(to bottom, ${branding.primaryColor}, ${branding.primaryColor}dd)` }}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Verifying...
                  </>
                ) : (
                  'Verify'
                )}
              </button>

              <button
                type="button"
                onClick={() => { setTwoFARequired(false); setTwoFAToken(''); setPendingTwoFA(null) }}
                className="w-full text-center text-gray-400 hover:text-gray-200 transition-colors text-sm py-1"
              >
                Back to login
              </button>
            </form>
          )}

          {!twoFARequired && ssoProviders.length > 0 && (
            <>
              <div className="flex items-center gap-3 my-6">
                <div className="h-px bg-gray-700 flex-1" />
                <span className="text-xs text-gray-500">atau lanjut dengan</span>
                <div className="h-px bg-gray-700 flex-1" />
              </div>
              <div className="space-y-2.5">
                {ssoProviders.map((p) => (
                  <a
                    key={p}
                    href={`/api/auth/oauth/${p}`}
                    className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl bg-gray-700/50 hover:bg-gray-600/70 border border-gray-600 text-white text-sm font-medium transition-colors"
                  >
                    {p === 'google' && <i className="fa-brands fa-google text-[#EA4335] text-base"></i>}
                    {p === 'github' && <i className="fa-brands fa-github text-lg"></i>}
                    {p === 'oidc' && <i className="fa-solid fa-building-columns"></i>}
                    Lanjut dengan {SSO_LABELS[p] || p}
                  </a>
                ))}
              </div>
            </>
          )}

          <div className="mt-6 pt-5 border-t border-gray-700/60 text-center">
            <p className="text-gray-400 text-sm">
              Don&apos;t have an account?{' '}
              <a href="/register" className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
                Create one
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
