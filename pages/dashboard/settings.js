import { csrfFetch } from '@/lib/csrfFetch';
import { useState, useEffect, useMemo } from 'react'
import Layout from '@/components/layout/Layout'
import Loading from '@/components/common/Loading'
import Toast from '@/components/common/Toast'
import usePushNotifications from '@/hooks/usePushNotifications'
import { DICEBEAR_STYLES, STYLE_CUSTOMIZATION, getDiceBearUrl } from '@/components/common/Avatar'
import { useAuth } from '@/components/AuthContext'

const STYLE_INFO = {
  lorelei: { label: 'Lorelei', desc: 'Hand-drawn characters' },
  bottts: { label: 'Bottts', desc: 'Robot characters' },
  'pixel-art': { label: 'Pixel Art', desc: 'Retro pixel art' },
  avataaars: { label: 'Avataaars', desc: 'Customizable cartoon' },
  'fun-emoji': { label: 'Fun Emoji', desc: 'Emoji faces' },
  identicon: { label: 'Identicon', desc: 'Geometric patterns' },
  'open-peeps': { label: 'Open Peeps', desc: 'Hand-drawn people' },
  personas: { label: 'Personas', desc: 'Diverse characters' },
}

export default function Settings() {
  const { setUser: setAuthUser } = useAuth()
  const [activeTab, setActiveTab] = useState('profile')
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const push = usePushNotifications()

  const [profileForm, setProfileForm] = useState({
    name: '',
    email: '',
    avatar: '',
    avatar_style: '',
    avatar_seed: '',
    avatar_options: {}
  })

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })

  const [twoFA, setTwoFA] = useState({ enabled: false, loading: false })
  const [twoFASetup, setTwoFASetup] = useState({ show: false, secret: '', qrCode: '', token: '' })

  const [notifForm, setNotifForm] = useState({
    email_notifications: false,
    telegram_notifications: false,
    telegram_chat_id: ''
  })

  useEffect(() => { fetchUserData() }, [])

  async function fetchUserData() {
    try {
      const res = await fetch('/api/users/me')
      if (res.ok) {
        const data = await res.json()
        const u = data.user
        setUser(u)
        let parsedOptions = {}
        if (u.avatar_options) {
          try { parsedOptions = typeof u.avatar_options === 'string' ? JSON.parse(u.avatar_options) : u.avatar_options } catch {}
        }
        setProfileForm({
          name: u.name || '',
          email: u.email || '',
          avatar: u.avatar || '',
          avatar_style: u.avatar_style || '',
          avatar_seed: u.avatar_seed || u.name || '',
          avatar_options: parsedOptions
        })
        setTwoFA({ enabled: !!u.two_factor_enabled, loading: false })
      }
      const notifRes = await fetch('/api/users/me/settings')
      if (notifRes.ok) {
        const notifData = await notifRes.json()
        setNotifForm({
          email_notifications: notifData.settings?.email_notifications || false,
          telegram_notifications: notifData.settings?.telegram_notifications || false,
          telegram_chat_id: notifData.settings?.telegram_chat_id || ''
        })
      }
    } catch { setToast({ type: 'error', message: 'Failed to load settings' }) }
    finally { setLoading(false) }
  }

  async function handleProfileSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/users/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileForm)
      })
      if (res.ok) {
        setToast({ type: 'success', message: 'Profile updated successfully' })
        fetchUserData()
        const meRes = await fetch('/api/users/me')
        if (meRes.ok) { const meData = await meRes.json(); setAuthUser(meData.user) }
      } else {
        const data = await res.json()
        setToast({ type: 'error', message: data.error || 'Failed to update profile' })
      }
    } catch { setToast({ type: 'error', message: 'Failed to update profile' }) }
    finally { setSaving(false) }
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault()
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setToast({ type: 'error', message: 'New passwords do not match' }); return
    }
    if (passwordForm.newPassword.length < 8) {
      setToast({ type: 'error', message: 'Password must be at least 8 characters' }); return
    }
    if (!/[A-Z]/.test(passwordForm.newPassword)) {
      setToast({ type: 'error', message: 'Password must contain at least 1 uppercase letter' }); return
    }
    if (!/[a-z]/.test(passwordForm.newPassword)) {
      setToast({ type: 'error', message: 'Password must contain at least 1 lowercase letter' }); return
    }
    if (!/[0-9]/.test(passwordForm.newPassword)) {
      setToast({ type: 'error', message: 'Password must contain at least 1 number' }); return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/users/me/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword })
      })
      if (res.ok) {
        setToast({ type: 'success', message: 'Password changed successfully' })
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      } else {
        const data = await res.json()
        setToast({ type: 'error', message: data.error || 'Failed to change password' })
      }
    } catch { setToast({ type: 'error', message: 'Failed to change password' }) }
    finally { setSaving(false) }
  }

  async function handle2FASetup() {
    setTwoFA(prev => ({ ...prev, loading: true }))
    try {
      const res = await fetch('/api/auth/2fa/setup', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setTwoFASetup({ show: true, secret: data.secret, qrCode: data.qrCode, token: '' })
      } else {
        const data = await res.json()
        setToast({ type: 'error', message: data.error || 'Failed to setup 2FA' })
      }
    } catch { setToast({ type: 'error', message: 'Failed to setup 2FA' }) }
    finally { setTwoFA(prev => ({ ...prev, loading: false })) }
  }

  async function handle2FAVerify() {
    if (!twoFASetup.token) { setToast({ type: 'error', message: 'Enter the code from your authenticator app' }); return }
    setSaving(true)
    try {
      const res = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: twoFASetup.token })
      })
      if (res.ok) {
        setToast({ type: 'success', message: '2FA enabled successfully' })
        setTwoFA({ enabled: true, loading: false })
        setTwoFASetup({ show: false, secret: '', qrCode: '', token: '' })
      } else {
        const data = await res.json()
        setToast({ type: 'error', message: data.error || 'Invalid token' })
      }
    } catch { setToast({ type: 'error', message: 'Failed to verify 2FA' }) }
    finally { setSaving(false) }
  }

  async function handle2FADisable() {
    if (!twoFASetup.token) { setToast({ type: 'error', message: 'Enter your 2FA code to disable' }); return }
    setSaving(true)
    try {
      const res = await fetch('/api/auth/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: twoFASetup.token })
      })
      if (res.ok) {
        setToast({ type: 'success', message: '2FA disabled' })
        setTwoFA({ enabled: false, loading: false })
        setTwoFASetup({ show: false, secret: '', qrCode: '', token: '' })
      } else {
        const data = await res.json()
        setToast({ type: 'error', message: data.error || 'Invalid token' })
      }
    } catch { setToast({ type: 'error', message: 'Failed to disable 2FA' }) }
    finally { setSaving(false) }
  }

  async function handleNotifSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/users/me/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notifForm)
      })
      if (res.ok) setToast({ type: 'success', message: 'Notification settings updated' })
      else {
        const data = await res.json()
        setToast({ type: 'error', message: data.error || 'Failed to update settings' })
      }
    } catch { setToast({ type: 'error', message: 'Failed to update settings' }) }
    finally { setSaving(false) }
  }

  function handleRandomize() {
    const randomSeed = Math.random().toString(36).slice(2, 8)
    setProfileForm(prev => ({ ...prev, avatar_seed: randomSeed }))
  }

  function handleVariantChange(key, value) {
    setProfileForm(prev => {
      const opts = { ...prev.avatar_options }
      if (value === '' || value === null) delete opts[key]
      else opts[key] = value
      return { ...prev, avatar_options: opts }
    })
  }

  function handleColorChange(key, color) {
    setProfileForm(prev => {
      const opts = { ...prev.avatar_options }
      opts[key] = color
      return { ...prev, avatar_options: opts }
    })
  }

  const previewUrl = useMemo(() => {
    return getDiceBearUrl(
      profileForm.avatar_seed || profileForm.name || 'User',
      profileForm.avatar_style || 'lorelei',
      profileForm.avatar_seed || profileForm.name || 'User',
      profileForm.avatar_options
    )
  }, [profileForm.avatar_seed, profileForm.avatar_style, profileForm.avatar_options, profileForm.name])

  const customization = STYLE_CUSTOMIZATION[profileForm.avatar_style]

  if (loading) {
    return <Layout><div className="flex items-center justify-center h-64"><Loading /></div></Layout>
  }

  const tabs = [
    { id: 'profile', label: 'Profile' },
    { id: 'security', label: 'Security' },
    { id: 'notifications', label: 'Notifications' }
  ]

  return (
    <Layout>
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-white mb-6">Settings</h1>
        <div className="bg-gray-800 rounded-lg shadow-lg">
          <div className="border-b border-gray-700">
            <nav className="flex space-x-8 px-6">
              {tabs.map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === tab.id ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'}`}>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'profile' && (
              <form onSubmit={handleProfileSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Full Name</label>
                  <input type="text" value={profileForm.name} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Email Address</label>
                  <input type="email" value={profileForm.email} onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent" required />
                </div>

                {/* Avatar Section */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">Avatar Style</label>
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-3 mb-4">
                    {DICEBEAR_STYLES.map(style => (
                      <button key={style} type="button"
                        onClick={() => setProfileForm(prev => ({ ...prev, avatar_style: style, avatar: '' }))}
                        className={`relative flex flex-col items-center p-3 rounded-xl border-2 transition-all ${profileForm.avatar_style === style && !profileForm.avatar ? 'border-indigo-500 bg-indigo-500/10' : 'border-gray-700 bg-gray-800 hover:border-gray-500'}`}>
                        <img src={getDiceBearUrl(profileForm.avatar_seed || 'preview', style, profileForm.avatar_seed || 'preview', profileForm.avatar_options)}
                          alt={STYLE_INFO[style].label} className="w-12 h-12 rounded-full mb-2" />
                        <span className="text-[10px] text-gray-300 font-medium">{STYLE_INFO[style].label}</span>
                        {profileForm.avatar_style === style && !profileForm.avatar && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-500 rounded-full flex items-center justify-center">
                            <i className="fa-solid fa-check text-[8px] text-white"></i>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 mb-4">
                    <button type="button" onClick={handleRandomize}
                      className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs font-medium transition-colors">
                      <i className="fa-solid fa-shuffle mr-1.5"></i>Randomize
                    </button>
                    <span className="text-[10px] text-gray-500">Generates a new random avatar</span>
                  </div>
                </div>

                {/* Customization Panel */}
                {customization && (customization.variants.length > 0 || customization.colors.length > 0) && profileForm.avatar_style && !profileForm.avatar && (
                  <div className="bg-gray-900 rounded-xl border border-gray-700 p-4 space-y-4">
                    <div className="flex items-center gap-2">
                      <i className="fa-solid fa-wand-magic-sparkles text-indigo-400 text-sm"></i>
                      <h3 className="text-sm font-medium text-white">Customize {customization.label}</h3>
                    </div>

                    {/* Variant Selectors */}
                    {customization.variants.map(v => (
                      <div key={v.key}>
                        <label className="block text-xs text-gray-400 mb-1.5">{v.label}</label>
                        <div className="flex flex-wrap gap-1.5">
                          {v.clearable && (
                            <button type="button" onClick={() => handleVariantChange(v.key, '')}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${!profileForm.avatar_options[v.key] ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 border border-gray-700 hover:text-white'}`}>
                              None
                            </button>
                          )}
                          {v.options.filter(o => o !== 'none').map(opt => (
                            <button key={opt} type="button" onClick={() => handleVariantChange(v.key, opt)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${profileForm.avatar_options[v.key] === opt ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 border border-gray-700 hover:text-white'}`}>
                              {opt.replace(/([A-Z])/g, ' $1').replace(/variant(\d+)/i, 'v$1').trim()}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}

                    {/* Color Pickers */}
                    {customization.colors.map(c => (
                      <div key={c.key}>
                        <label className="block text-xs text-gray-400 mb-1.5">{c.label}</label>
                        <div className="flex flex-wrap gap-1.5">
                          {c.colors.map(color => (
                            <button key={color} type="button" onClick={() => handleColorChange(c.key, color)}
                              className={`w-7 h-7 rounded-full border-2 transition-all ${profileForm.avatar_options[c.key] === color ? 'border-white scale-110' : 'border-gray-700 hover:border-gray-500'}`}
                              style={{ backgroundColor: `#${color}` }} title={`#${color}`} />
                          ))}
                        </div>
                      </div>
                    ))}

                    {Object.keys(profileForm.avatar_options).length > 0 && (
                      <button type="button" onClick={() => setProfileForm(prev => ({ ...prev, avatar_options: {} }))}
                        className="text-[11px] text-red-400 hover:text-red-300">
                        <i className="fa-solid fa-rotate-left mr-1"></i>Reset customization
                      </button>
                    )}
                  </div>
                )}

                {/* Custom URL */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Custom Avatar URL <span className="text-gray-500 text-xs">(optional, overrides style)</span>
                  </label>
                  <input type="url" value={profileForm.avatar}
                    onChange={(e) => setProfileForm({ ...profileForm, avatar: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                    placeholder="https://example.com/avatar.jpg" />
                  <div className="mt-3 flex items-center gap-3">
                    <img src={profileForm.avatar || previewUrl} alt="Avatar preview" className="w-16 h-16 rounded-full"
                      onError={(e) => { e.target.src = getDiceBearUrl('fallback', 'identicon', 'fallback', {}) }} />
                    <div>
                      <p className="text-xs text-gray-400">
                        {profileForm.avatar ? 'Custom URL active' : `Using ${STYLE_INFO[profileForm.avatar_style || 'lorelei'].label} style`}
                      </p>
                      {profileForm.avatar && (
                        <button type="button" onClick={() => setProfileForm(prev => ({ ...prev, avatar: '' }))}
                          className="text-xs text-red-400 hover:text-red-300 mt-1">Remove custom URL</button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button type="submit" disabled={saving}
                    className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                    {saving ? 'Saving...' : 'Save Profile'}
                  </button>
                </div>
              </form>
            )}

            {activeTab === 'security' && (
              <>
              <form onSubmit={handlePasswordSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Current Password</label>
                  <input type="password" value={passwordForm.currentPassword} onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">New Password</label>
                  <input type="password" value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent" required minLength={6} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Confirm New Password</label>
                  <input type="password" value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent" required minLength={6} />
                </div>
                <div className="flex justify-end">
                  <button type="submit" disabled={saving}
                    className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                    {saving ? 'Changing...' : 'Change Password'}
                  </button>
                </div>
              </form>

              {/* 2FA Section */}
              <div className="mt-8 pt-6 border-t border-gray-700">
                <h3 className="text-lg font-medium text-white mb-2">Two-Factor Authentication (2FA)</h3>
                <p className="text-gray-400 text-sm mb-4">Add an extra layer of security to your account using an authenticator app.</p>

                {!twoFA.enabled && !twoFASetup.show && (
                  <button onClick={handle2FASetup} disabled={twoFA.loading}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors text-sm">
                    {twoFA.loading ? 'Setting up...' : 'Enable 2FA'}
                  </button>
                )}

                {twoFA.enabled && !twoFASetup.show && (
                  <div className="flex items-center gap-4">
                    <span className="text-green-400 text-sm font-medium">2FA is enabled</span>
                    <button onClick={() => setTwoFASetup({ show: true, secret: '', qrCode: '', token: '', disable: true })}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm">
                      Disable 2FA
                    </button>
                  </div>
                )}

                {twoFASetup.show && (
                  <div className="bg-gray-900 rounded-lg p-4 space-y-4">
                    {!twoFASetup.disable && twoFASetup.qrCode && (
                      <>
                        <p className="text-gray-300 text-sm">Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.):</p>
                        <img src={twoFASetup.qrCode} alt="2FA QR Code" className="w-48 h-48 rounded-lg" />
                        <div>
                          <p className="text-gray-400 text-xs mb-1">Or enter this secret manually:</p>
                          <code className="block bg-gray-800 px-3 py-2 rounded text-green-400 text-sm font-mono break-all">{twoFASetup.secret}</code>
                        </div>
                      </>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        {twoFASetup.disable ? 'Enter your 2FA code to disable' : 'Enter the 6-digit code from your app'}
                      </label>
                      <input type="text" value={twoFASetup.token} onChange={(e) => setTwoFASetup(prev => ({ ...prev, token: e.target.value }))}
                        className="w-48 px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 text-center font-mono text-lg tracking-widest"
                        placeholder="000000" maxLength={6} />
                    </div>
                    <div className="flex gap-3">
                      <button onClick={twoFASetup.disable ? handle2FADisable : handle2FAVerify} disabled={saving}
                        className={`px-4 py-2 text-white rounded-lg disabled:opacity-50 transition-colors text-sm ${twoFASetup.disable ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                        {saving ? 'Processing...' : twoFASetup.disable ? 'Disable 2FA' : 'Verify & Enable'}
                      </button>
                      <button onClick={() => setTwoFASetup({ show: false, secret: '', qrCode: '', token: '' })}
                        className="px-4 py-2 bg-gray-600 text-gray-300 rounded-lg hover:bg-gray-500 transition-colors text-sm">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
              </>
            )}

            {activeTab === 'notifications' && (
              <form onSubmit={handleNotifSubmit} className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
                    <div><h3 className="text-white font-medium">Email Notifications</h3><p className="text-gray-400 text-sm mt-1">Receive notifications via email</p></div>
                    <button type="button" onClick={() => setNotifForm({ ...notifForm, email_notifications: !notifForm.email_notifications })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${notifForm.email_notifications ? 'bg-indigo-600' : 'bg-gray-600'}`}>
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${notifForm.email_notifications ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
                    <div><h3 className="text-white font-medium">Telegram Notifications</h3><p className="text-gray-400 text-sm mt-1">Receive notifications via Telegram bot</p></div>
                    <button type="button" onClick={() => setNotifForm({ ...notifForm, telegram_notifications: !notifForm.telegram_notifications })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${notifForm.telegram_notifications ? 'bg-indigo-600' : 'bg-gray-600'}`}>
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${notifForm.telegram_notifications ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                  {notifForm.telegram_notifications && (
                    <div className="p-4 bg-gray-700 rounded-lg">
                      <label className="block text-sm font-medium text-gray-300 mb-2">Telegram Chat ID</label>
                      <input type="text" value={notifForm.telegram_chat_id} onChange={(e) => setNotifForm({ ...notifForm, telegram_chat_id: e.target.value })}
                        className="w-full px-4 py-3 bg-gray-600 border border-gray-500 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent" placeholder="Enter your Telegram chat ID" />
                      <p className="text-gray-400 text-xs mt-2">Message @userinfobot on Telegram to get your chat ID</p>
                    </div>
                  )}
                  <div className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
                    <div><h3 className="text-white font-medium">Push Notifications (Browser)</h3><p className="text-gray-400 text-sm mt-1">Receive push notifications on this device</p></div>
                    <button type="button" onClick={async () => {
                      if (!push.isSupported) { setToast({ type: 'error', message: push.needsHomeScreen ? 'Add to Home Screen first' : 'Push not supported' }); return }
                      if (push.isSubscribed) { const r = await push.unsubscribe(); if (r.success) setToast({ type: 'success', message: 'Push disabled' }); else setToast({ type: 'error', message: r.error }) }
                      else { const r = await push.subscribe(); if (r.success) setToast({ type: 'success', message: 'Push enabled' }); else setToast({ type: 'error', message: r.error }) }
                    }} disabled={push.loading}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${push.isSubscribed ? 'bg-indigo-600' : 'bg-gray-600'} ${push.loading ? 'opacity-50' : ''}`}>
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${push.isSubscribed ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                  {push.needsHomeScreen && (
                    <div className="p-4 bg-blue-900/30 border border-blue-700 rounded-lg space-y-2">
                      <p className="text-blue-300 text-sm font-medium">iOS detected — Add to Home Screen first.</p>
                      <ol className="text-blue-200 text-sm space-y-1 list-decimal list-inside">
                        <li>Tap <strong>Share</strong> in Safari</li><li>Tap <strong>"Add to Home Screen"</strong></li><li>Tap <strong>Add</strong></li><li>Open DevTrack from Home Screen</li><li>Enable Push Notifications</li>
                      </ol>
                    </div>
                  )}
                </div>
                <div className="flex justify-end">
                  <button type="submit" disabled={saving}
                    className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                    {saving ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
    </Layout>
  )
}
