import { csrfFetch } from '@/lib/csrfFetch';
import { useState, useEffect, useRef } from 'react'
import Layout from '@/components/layout/Layout'
import Loading from '@/components/common/Loading'
import Toast from '@/components/common/Toast'
import { useTenant } from '@/hooks/useTenant'
import { useAuth } from '@/components/AuthContext'

const COLOR_PRESETS = [
  { name: 'Indigo', primary: '#6366f1', accent: '#818cf8' },
  { name: 'Blue', primary: '#3b82f6', accent: '#60a5fa' },
  { name: 'Green', primary: '#22c55e', accent: '#4ade80' },
  { name: 'Purple', primary: '#a855f7', accent: '#c084fc' },
  { name: 'Red', primary: '#ef4444', accent: '#f87171' },
  { name: 'Orange', primary: '#f97316', accent: '#fb923c' },
  { name: 'Cyan', primary: '#06b6d4', accent: '#22d3ee' },
  { name: 'Pink', primary: '#ec4899', accent: '#f472b6' },
  { name: 'Teal', primary: '#14b8a6', accent: '#2dd4bf' },
  { name: 'Amber', primary: '#f59e0b', accent: '#fbbf24' },
]

const DEFAULT_FEATURES = {
  projects: true,
  tasks: true,
  chat: true,
  deploy: true,
  remote: true,
  it_support: true,
  terminal: true,
  reports: true,
  calendar: true,
  database: true,
  server_monitor: true,
}

const FEATURE_LABELS = {
  projects: { label: 'Projects', icon: 'fa-folder-open' },
  tasks: { label: 'My Tasks', icon: 'fa-list-check' },
  chat: { label: 'Chat', icon: 'fa-comments' },
  deploy: { label: 'Deploy', icon: 'fa-rocket' },
  remote: { label: 'Remote Desktop', icon: 'fa-desktop' },
  it_support: { label: 'IT Support', icon: 'fa-headset' },
  terminal: { label: 'Terminal', icon: 'fa-terminal' },
  reports: { label: 'Reports', icon: 'fa-chart-bar' },
  calendar: { label: 'Calendar', icon: 'fa-calendar-days' },
  database: { label: 'Database', icon: 'fa-database' },
  server_monitor: { label: 'Server Monitor', icon: 'fa-server' },
}

export default function BrandingAdmin() {
  const { user } = useAuth()
  const { settings: tenantSettings, refreshSettings } = useTenant()
  const [toast, setToast] = useState(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const logoInputRef = useRef(null)
  const iconInputRef = useRef(null)
  const faviconInputRef = useRef(null)

  const [form, setForm] = useState({
    app_name: 'DevTrack',
    app_tagline: '',
    logo_url: '',
    logo_icon_url: '',
    primary_color: '#6366f1',
    accent_color: '#818cf8',
    favicon_url: '',
    login_bg: '',
    footer_text: '',
    theme: 'dark',
    features: { ...DEFAULT_FEATURES },
  })

  const [logoPreview, setLogoPreview] = useState('')
  const [iconPreview, setIconPreview] = useState('')
  const loginBgInputRef = useRef(null)

  useEffect(() => {
    if (tenantSettings) {
      let features = DEFAULT_FEATURES
      if (tenantSettings.features) {
        try {
          features = typeof tenantSettings.features === 'string'
            ? JSON.parse(tenantSettings.features)
            : tenantSettings.features
        } catch { features = DEFAULT_FEATURES }
      }

      setForm({
        app_name: tenantSettings.app_name || 'DevTrack',
        app_tagline: tenantSettings.app_tagline || '',
        logo_url: tenantSettings.logo_url || '',
        logo_icon_url: tenantSettings.logo_icon_url || '',
        primary_color: tenantSettings.primary_color || '#6366f1',
        accent_color: tenantSettings.accent_color || '#818cf8',
        favicon_url: tenantSettings.favicon_url || '',
        login_bg: tenantSettings.login_bg || '',
        footer_text: tenantSettings.footer_text || '',
        theme: tenantSettings.theme || 'dark',
        features,
      })
      setLogoPreview(tenantSettings.logo_url || '')
      setIconPreview(tenantSettings.logo_icon_url || '')
      setLoading(false)
    }
  }, [tenantSettings])

  if (user?.role !== 'admin') {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-400">Admin access required</p>
        </div>
      </Layout>
    )
  }

  if (loading) {
    return <Layout><div className="flex items-center justify-center h-64"><Loading /></div></Layout>
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch('/api/tenant/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        setToast({ type: 'success', message: 'Branding settings saved!' })
        await refreshSettings()
      } else {
        const data = await res.json()
        setToast({ type: 'error', message: data.error || 'Failed to save' })
      }
    } catch {
      setToast({ type: 'error', message: 'Failed to save settings' })
    } finally {
      setSaving(false)
    }
  }

  async function handleFileUpload(file, type) {
    if (!file) return
    const formData = new FormData()
    formData.append('logo', file)
    formData.append('type', type)

    try {
      const res = await fetch('/api/tenant/logo', {
        method: 'POST',
        body: formData,
      })
      if (res.ok) {
        const data = await res.json()
        if (type === 'icon') {
          setForm(prev => ({ ...prev, logo_icon_url: data.url }))
          setIconPreview(data.url)
        } else if (type === 'favicon') {
          setForm(prev => ({ ...prev, favicon_url: data.url }))
        } else {
          setForm(prev => ({ ...prev, logo_url: data.url }))
          setLogoPreview(data.url)
        }
        setToast({ type: 'success', message: 'Logo uploaded!' })
      } else {
        setToast({ type: 'error', message: 'Upload failed' })
      }
    } catch {
      setToast({ type: 'error', message: 'Upload failed' })
    }
  }

  function toggleFeature(key) {
    setForm(prev => ({
      ...prev,
      features: { ...prev.features, [key]: !prev.features[key] },
    }))
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto p-6 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Branding & White Label</h1>
          <p className="text-gray-400 mt-1">Customize the look and feel of your DevTrack instance</p>
        </div>

        {/* Logo Section */}
        <section className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <i className="fa-solid fa-image text-indigo-400"></i>
            Logo & Branding
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Main Logo */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Main Logo (Sidebar)</label>
              <div className="flex items-center gap-4">
                <div className="w-48 h-16 bg-gray-900 rounded-lg border border-gray-700 flex items-center justify-center overflow-hidden">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo preview" className="max-h-12 max-w-full object-contain" />
                  ) : (
                    <span className="text-gray-500 text-xs">No logo</span>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => logoInputRef.current?.click()}
                    className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors"
                  >
                    <i className="fa-solid fa-upload mr-2"></i>Upload
                  </button>
                  {logoPreview && (
                    <button
                      onClick={() => { setForm(prev => ({ ...prev, logo_url: '' })); setLogoPreview('') }}
                      className="px-3 py-2 bg-gray-700 hover:bg-red-600/20 text-gray-400 hover:text-red-400 rounded-lg text-sm transition-colors"
                    >
                      <i className="fa-solid fa-trash mr-2"></i>Remove
                    </button>
                  )}
                </div>
              </div>
              <input ref={logoInputRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => handleFileUpload(e.target.files?.[0], 'logo')} />
            </div>

            {/* Icon Logo (collapsed) */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Icon Logo (Collapsed Sidebar)</label>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gray-900 rounded-lg border border-gray-700 flex items-center justify-center overflow-hidden">
                  {iconPreview ? (
                    <img src={iconPreview} alt="Icon preview" className="max-h-12 max-w-full object-contain" />
                  ) : (
                    <span className="text-gray-500 text-xs">No icon</span>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => iconInputRef.current?.click()}
                    className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors"
                  >
                    <i className="fa-solid fa-upload mr-2"></i>Upload
                  </button>
                  {iconPreview && (
                    <button
                      onClick={() => { setForm(prev => ({ ...prev, logo_icon_url: '' })); setIconPreview('') }}
                      className="px-3 py-2 bg-gray-700 hover:bg-red-600/20 text-gray-400 hover:text-red-400 rounded-lg text-sm transition-colors"
                    >
                      <i className="fa-solid fa-trash mr-2"></i>Remove
                    </button>
                  )}
                </div>
              </div>
              <input ref={iconInputRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => handleFileUpload(e.target.files?.[0], 'icon')} />
            </div>

            {/* Favicon */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Favicon</label>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gray-900 rounded-lg border border-gray-700 flex items-center justify-center overflow-hidden">
                  {form.favicon_url ? (
                    <img src={form.favicon_url} alt="Favicon" className="max-h-8 max-w-full object-contain" />
                  ) : (
                    <i className="fa-solid fa-star text-gray-500 text-sm"></i>
                  )}
                </div>
                <button
                  onClick={() => faviconInputRef.current?.click()}
                  className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors"
                >
                  <i className="fa-solid fa-upload mr-2"></i>Upload
                </button>
              </div>
              <input ref={faviconInputRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => handleFileUpload(e.target.files?.[0], 'favicon')} />
            </div>

            {/* Login Background */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-2">Login Background Image</label>
              <div className="flex items-center gap-4">
                <div className="w-full max-w-sm h-32 bg-gray-900 rounded-lg border border-gray-700 flex items-center justify-center overflow-hidden">
                  {form.login_bg ? (
                    <img src={form.login_bg} alt="Login background" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center">
                      <i className="fa-solid fa-image text-gray-600 text-2xl mb-1"></i>
                      <p className="text-gray-500 text-xs">Default gradient background</p>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => loginBgInputRef.current?.click()}
                    className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors"
                  >
                    <i className="fa-solid fa-upload mr-2"></i>Upload
                  </button>
                  {form.login_bg && (
                    <button
                      onClick={() => setForm(prev => ({ ...prev, login_bg: '' }))}
                      className="px-3 py-2 bg-gray-700 hover:bg-red-600/20 text-gray-400 hover:text-red-400 rounded-lg text-sm transition-colors"
                    >
                      <i className="fa-solid fa-trash mr-2"></i>Remove
                    </button>
                  )}
                </div>
              </div>
              <input ref={loginBgInputRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => handleFileUpload(e.target.files?.[0], 'login_bg')} />
              <p className="text-xs text-gray-500 mt-2">Background image shown on the login/register page. Recommended: 1920x1080</p>
            </div>

            {/* Custom URL fields */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Logo URL (manual)</label>
              <input type="text" value={form.logo_url}
                onChange={(e) => { setForm(prev => ({ ...prev, logo_url: e.target.value })); setLogoPreview(e.target.value) }}
                placeholder="https://example.com/logo.png"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
        </section>

        {/* App Info Section */}
        <section className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <i className="fa-solid fa-tag text-indigo-400"></i>
            App Info
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">App Name</label>
              <input type="text" value={form.app_name}
                onChange={(e) => setForm(prev => ({ ...prev, app_name: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Tagline</label>
              <input type="text" value={form.app_tagline}
                onChange={(e) => setForm(prev => ({ ...prev, app_tagline: e.target.value }))}
                placeholder="Project Management & IT Support"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-2">Footer Text</label>
              <input type="text" value={form.footer_text}
                onChange={(e) => setForm(prev => ({ ...prev, footer_text: e.target.value }))}
                placeholder="© 2026 Your Company. All rights reserved."
                className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
        </section>

        {/* Color Theme */}
        <section className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <i className="fa-solid fa-palette text-indigo-400"></i>
            Color Theme
          </h2>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-3">Color Presets</label>
            <div className="flex flex-wrap gap-2">
              {COLOR_PRESETS.map(preset => (
                <button key={preset.name}
                  onClick={() => setForm(prev => ({ ...prev, primary_color: preset.primary, accent_color: preset.accent }))}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
                    form.primary_color === preset.primary
                      ? 'border-indigo-500 bg-indigo-500/10 text-white'
                      : 'border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-500'
                  }`}>
                  <div className="w-4 h-4 rounded-full" style={{ background: preset.primary }}></div>
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Primary Color</label>
              <div className="flex items-center gap-3">
                <input type="color" value={form.primary_color}
                  onChange={(e) => setForm(prev => ({ ...prev, primary_color: e.target.value }))}
                  className="w-10 h-10 rounded cursor-pointer bg-transparent" />
                <input type="text" value={form.primary_color}
                  onChange={(e) => setForm(prev => ({ ...prev, primary_color: e.target.value }))}
                  className="flex-1 px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm font-mono focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Accent Color</label>
              <div className="flex items-center gap-3">
                <input type="color" value={form.accent_color}
                  onChange={(e) => setForm(prev => ({ ...prev, accent_color: e.target.value }))}
                  className="w-10 h-10 rounded cursor-pointer bg-transparent" />
                <input type="text" value={form.accent_color}
                  onChange={(e) => setForm(prev => ({ ...prev, accent_color: e.target.value }))}
                  className="flex-1 px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm font-mono focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
          </div>

          {/* Live preview */}
          <div className="mt-6 p-4 bg-gray-900 rounded-xl border border-gray-700">
            <p className="text-xs text-gray-500 mb-3">PREVIEW</p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                style={{ background: form.primary_color }}>
                {form.app_name?.charAt(0) || 'D'}
              </div>
              <div>
                <p className="text-white font-semibold">{form.app_name || 'DevTrack'}</p>
                <p className="text-gray-400 text-xs">{form.app_tagline || 'Project Management'}</p>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button className="px-4 py-1.5 rounded-lg text-white text-sm font-medium" style={{ background: form.primary_color }}>
                Primary Button
              </button>
              <button className="px-4 py-1.5 rounded-lg text-sm font-medium border" style={{ borderColor: form.accent_color, color: form.accent_color }}>
                Accent Button
              </button>
            </div>
          </div>
        </section>

        {/* Feature Toggles */}
        <section className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <i className="fa-solid fa-sliders text-indigo-400"></i>
            Feature Toggles
          </h2>
          <p className="text-gray-400 text-sm mb-4">Enable or disable features for your users</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(FEATURE_LABELS).map(([key, { label, icon }]) => (
              <button key={key}
                onClick={() => toggleFeature(key)}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                  form.features[key]
                    ? 'border-green-600/50 bg-green-500/10 text-green-400'
                    : 'border-gray-700 bg-gray-900 text-gray-500'
                }`}>
                <i className={`fa-solid ${icon} text-sm w-5 text-center`}></i>
                <span className="text-sm font-medium flex-1 text-left">{label}</span>
                <i className={`fa-solid ${form.features[key] ? 'fa-toggle-on text-lg' : 'fa-toggle-off text-lg'}`}></i>
              </button>
            ))}
          </div>
        </section>

        {/* Save Button */}
        <div className="flex justify-end gap-3">
          <button onClick={() => {
            setForm({
              app_name: 'DevTrack',
              app_tagline: '',
              logo_url: '',
              logo_icon_url: '',
              primary_color: '#6366f1',
              accent_color: '#818cf8',
              favicon_url: '',
              login_bg: '',
              footer_text: '',
              theme: 'dark',
              features: { ...DEFAULT_FEATURES },
            })
            setLogoPreview('')
            setIconPreview('')
          }}
            className="px-6 py-3 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors">
            Reset to Defaults
          </button>
          <button onClick={handleSave} disabled={saving}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
            {saving ? 'Saving...' : 'Save Branding'}
          </button>
        </div>

        {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
      </div>
    </Layout>
  )
}
