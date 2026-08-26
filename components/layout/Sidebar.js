import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Avatar from '@/components/common/Avatar'
import { useAuth } from '@/components/AuthContext'
import { useTenant } from '@/hooks/useTenant'
import TenantSwitcher from '@/components/tenant/TenantSwitcher'

const navSections = [
  {
    label: 'Workspace',
    links: [
      { label: 'Dashboard', href: '/dashboard', icon: 'fa-gauge-high' },
      { label: 'Projects', href: '/dashboard/projects', icon: 'fa-folder-open' },
      { label: 'My Tasks', href: '/dashboard/my-tasks', icon: 'fa-list-check' },
      { label: 'Calendar', href: '/dashboard/calendar', icon: 'fa-calendar-days' },
      { label: 'Wiki', href: '/dashboard/wiki', icon: 'fa-book-open' },
    ],
  },
  {
    label: 'Communication',
    links: [
      { label: 'Chat', href: '/dashboard/chat', icon: 'fa-comments' },
      { label: 'Team', href: '/dashboard/team', icon: 'fa-users', adminOnly: true },
    ],
  },
  {
    label: 'Operations',
    links: [
      { label: 'Reports', href: '/dashboard/reports', icon: 'fa-chart-bar', adminOnly: true },
      { label: 'Deploy', href: '/dashboard/deploy', icon: 'fa-rocket', adminOnly: true },
      { label: 'Heatmap', href: '/dashboard/heatmap', icon: 'fa-fire', adminOnly: true },
      { label: 'Remote Desktop', href: '/dashboard/remote', icon: 'fa-desktop', adminOnly: true },
      {
        label: 'DevOps',
        href: '/dashboard/logs',
        icon: 'fa-screwdriver-wrench',
        adminOnly: true,
        children: [
          { label: 'Log Viewer', href: '/dashboard/logs', icon: 'fa-scroll' },
          { label: 'Terminal', href: '/dashboard/terminal', icon: 'fa-terminal' },
        ],
      },
      { label: 'Server Monitor', href: '/dashboard/server-monitor', icon: 'fa-server', adminOnly: true },
    ],
  },
  {
    label: 'IT Support',
    itSupportOnly: true,
    links: [
      {
        label: 'IT Support',
        href: '/dashboard/it-support',
        icon: 'fa-headset',
        children: [
          { label: 'Overview', href: '/dashboard/it-support', icon: 'fa-chart-pie' },
          { label: 'Purchases', href: '/dashboard/it-support/purchases', icon: 'fa-cart-shopping' },
          { label: 'Inventory', href: '/dashboard/it-support/inventory', icon: 'fa-boxes-stacked' },
          { label: 'Passwords', href: '/dashboard/it-support/passwords', icon: 'fa-lock' },
          { label: 'IP Addresses', href: '/dashboard/it-support/ip-addresses', icon: 'fa-network-wired' },
          { label: 'AI Search', href: '/dashboard/it-support/ai-search', icon: 'fa-robot' },
        ],
      },
    ],
  },
  {
    label: 'Administration',
    adminOnly: true,
    links: [
      { label: 'Database', href: '/dashboard/database', icon: 'fa-database' },
      { label: 'Env Config', href: '/dashboard/env-editor', icon: 'fa-file-code' },
      { label: 'Security', href: '/dashboard/security', icon: 'fa-shield-alt' },
      { label: 'Activity Log', href: '/dashboard/activity', icon: 'fa-clock-rotate-left' },
      {
        label: 'Admin',
        href: '/dashboard/admin',
        icon: 'fa-crown',
        children: [
          { label: 'Branding', href: '/dashboard/admin/branding', icon: 'fa-palette' },
          { label: 'Users', href: '/dashboard/admin/users', icon: 'fa-users' },
        ],
      },
    ],
  },
  {
    label: 'Account',
    links: [
      { label: 'Settings', href: '/dashboard/settings', icon: 'fa-gear' },
    ],
  },
]

function linkVisible(link, user) {
  if (link.adminOnly && user?.role !== 'admin') return false
  if (link.itSupportOnly && user?.role !== 'admin' && user?.role !== 'it_support') return false
  return true
}

export default function Sidebar({ isOpen, onClose, collapsed, onToggleCollapse }) {
  const router = useRouter()
  const { user, logout } = useAuth()
  const { settings: tenantSettings } = useTenant()
  const [unreadChat, setUnreadChat] = useState(0)

  const handleLogout = async () => {
    await logout()
    router.push('/login')
  }

  useEffect(() => {
    fetchUnread()
    const interval = setInterval(fetchUnread, 15000)
    return () => clearInterval(interval)
  }, [])

  async function fetchUnread() {
    try {
      const res = await fetch('/api/chat')
      if (res.ok) {
        const data = await res.json()
        const total = (data.conversations || []).reduce((sum, c) => sum + (c.unread_count || 0), 0)
        setUnreadChat(total)
      }
    } catch {}
  }

  const [expandedMenus, setExpandedMenus] = useState({})
  const [hoveredParent, setHoveredParent] = useState(null)
  const [flyoutPos, setFlyoutPos] = useState({ top: 0 })

  function toggleExpand(href) {
    setExpandedMenus(prev => ({ ...prev, [href]: !prev[href] }))
  }

  function handleParentHover(e, href) {
    if (!collapsed) return
    const rect = e.currentTarget.getBoundingClientRect()
    setFlyoutPos({ top: rect.top })
    setHoveredParent(href)
  }

  function navigate(href) {
    router.push(href)
    onClose?.()
  }

  const visibleSections = navSections
    .filter(section => linkVisible(section, user))
    .map(section => ({ ...section, links: section.links.filter(link => linkVisible(link, user)) }))
    .filter(section => section.links.length > 0)

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden animate-fade-in"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 left-0 h-full z-50 bg-gray-800/95 backdrop-blur-xl border-r border-gray-700/70 flex flex-col transition-all duration-300 ease-out-expo
          ${collapsed ? 'w-[4.5rem]' : 'w-64'}
          ${isOpen ? 'translate-x-0 shadow-panel lg:shadow-none' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Logo */}
        <div className="flex items-center h-16 px-4 border-b border-gray-700/70 flex-shrink-0 justify-center">
          {collapsed ? (
            tenantSettings?.logo_icon_url ? (
              <img src={tenantSettings.logo_icon_url} alt={tenantSettings?.app_name || 'DevTrack'} className="h-9 w-9 flex-shrink-0" />
            ) : (
              <>
                <img src="/favicon-white.webp" alt={tenantSettings?.app_name || 'DevTrack'} className="h-9 w-9 flex-shrink-0 theme-logo-dark" />
                <img src="/favicon.webp" alt={tenantSettings?.app_name || 'DevTrack'} className="h-9 w-9 flex-shrink-0 theme-logo-light" />
              </>
            )
          ) : tenantSettings?.logo_url ? (
            <img src={tenantSettings.logo_url} alt={tenantSettings?.app_name || 'DevTrack'} className="h-8 w-auto flex-shrink-0" />
          ) : (
            <>
              <img src="/favicon-white.webp" alt={tenantSettings?.app_name || 'DevTrack'} className="h-8 w-auto flex-shrink-0 theme-logo-dark" />
              <img src="/favicon.webp" alt={tenantSettings?.app_name || 'DevTrack'} className="h-8 w-auto flex-shrink-0 theme-logo-light" />
            </>
          )}

          <button
            onClick={onClose}
            className="lg:hidden ml-auto text-gray-400 hover:text-white transition-colors p-1 rounded-md hover:bg-gray-700"
            aria-label="Close menu"
          >
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>

        {/* Tenant Switcher */}
        {!collapsed && <TenantSwitcher collapsed={collapsed} />}

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 overflow-y-auto">
          {visibleSections.map((section, sIdx) => (
            <div key={section.label} className={sIdx > 0 ? 'mt-4' : ''}>
              {!collapsed && (
                <p className="section-label !px-3">{section.label}</p>
              )}
              {collapsed && sIdx > 0 && (
                <div className="mx-auto my-3 h-px w-8 bg-gray-700" />
              )}
              <div className="space-y-0.5 px-0">
                {section.links.map((link) => {
                  const isActive = router.pathname === link.href ||
                    (link.href !== '/dashboard' && router.pathname.startsWith(link.href))
                  const showBadge = link.href === '/dashboard/chat' && unreadChat > 0
                  const hasChildren = link.children && link.children.length > 0
                  const isExpanded = expandedMenus[link.href] || (hasChildren && isActive)

                  if (hasChildren) {
                    return (
                      <div key={link.href} className="relative" onMouseEnter={(e) => handleParentHover(e, link.href)} onMouseLeave={() => collapsed && setHoveredParent(null)}>
                        <button
                          onClick={() => toggleExpand(link.href)}
                          title={collapsed ? link.label : undefined}
                          className={`group relative flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                            collapsed ? 'justify-center' : ''
                          } ${
                            isActive
                              ? 'bg-indigo-500/15 text-indigo-300'
                              : 'text-gray-400 hover:bg-gray-700/60 hover:text-white hover:translate-x-0.5'
                          }`}
                        >
                          {isActive && (
                            <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-gradient-to-b from-indigo-400 to-violet-500" />
                          )}
                          <div className={`relative w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-md transition-colors ${isActive ? 'bg-indigo-500/20' : 'group-hover:bg-gray-600/50'}`}>
                            <i className={`fa-solid ${link.icon} text-sm`}></i>
                          </div>
                          {!collapsed && (
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span className="whitespace-nowrap">{link.label}</span>
                              <i className={`fa-solid fa-chevron-${isExpanded ? 'up' : 'down'} text-[10px] text-gray-500 ml-auto transition-transform duration-200`}></i>
                            </div>
                          )}
                        </button>

                        {/* Expanded sub-menu (normal mode) */}
                        {isExpanded && !collapsed && (
                          <div className="ml-4 mt-1 space-y-0.5 border-l border-gray-700/70 pl-2">
                            {link.children.map(child => {
                              const childActive = router.pathname === child.href
                              return (
                                <button
                                  key={child.href}
                                  onClick={() => navigate(child.href)}
                                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 text-left w-full ${
                                    childActive
                                      ? 'bg-indigo-500/15 text-indigo-300'
                                      : 'text-gray-400 hover:bg-gray-700/60 hover:text-white'
                                  }`}
                                >
                                  <i className={`fa-solid ${child.icon} text-xs w-4 text-center`}></i>
                                  <span className="whitespace-nowrap">{child.label}</span>
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  }

                  return (
                    <button
                      key={link.href}
                      onClick={() => navigate(link.href)}
                      title={collapsed ? link.label : undefined}
                      className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 text-left w-full ${
                        collapsed ? 'justify-center' : ''
                      } ${
                        isActive
                          ? 'bg-indigo-500/15 text-indigo-300'
                          : 'text-gray-400 hover:bg-gray-700/60 hover:text-white hover:translate-x-0.5'
                      }`}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-gradient-to-b from-indigo-400 to-violet-500" />
                      )}
                      <div className={`relative w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-md transition-colors ${isActive ? 'bg-indigo-500/20' : 'group-hover:bg-gray-600/50'}`}>
                        <i className={`fa-solid ${link.icon} text-sm`}></i>
                        {showBadge && (
                          <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-bold min-w-[16px] h-4 flex items-center justify-center rounded-full px-1 ring-2 ring-gray-800 animate-pulse-soft">
                            {unreadChat > 99 ? '99+' : unreadChat}
                          </span>
                        )}
                      </div>
                      {!collapsed && (
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="whitespace-nowrap">{link.label}</span>
                          {showBadge && (
                            <span className="ml-auto bg-red-500/90 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                              {unreadChat > 99 ? '99+' : unreadChat}
                            </span>
                          )}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Collapse toggle - desktop only */}
        <div className="hidden lg:block px-2 py-2 border-t border-gray-700/70">
          <button
            onClick={onToggleCollapse}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:bg-gray-700/60 hover:text-white transition-colors justify-center"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <i className={`fa-solid ${collapsed ? 'fa-angles-right' : 'fa-angles-left'} text-base w-5 text-center`}></i>
            {!collapsed && <span className="whitespace-nowrap">Collapse</span>}
          </button>
        </div>

        {/* User + Logout */}
        <div className="px-2 py-3 border-t border-gray-700/70 flex-shrink-0">
          <div className={`flex items-center gap-3 px-2 py-1.5 rounded-xl ${collapsed ? 'justify-center' : 'hover:bg-gray-700/40'} transition-colors`}>
              <Avatar name={user?.name} src={user?.avatar} avatarStyle={user?.avatar_style} avatarSeed={user?.avatar_seed} avatarOptions={user?.avatar_options} size="sm" />
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{user?.name}</p>
                <p className="text-xs text-gray-400 truncate">{user?.role === 'admin' ? 'Team Leader' : user?.role === 'it_support' ? 'IT Support' : 'Developer'}</p>
              </div>
            )}
            {!collapsed && (
              <button
                onClick={handleLogout}
                className="text-gray-400 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-500/10"
                title="Logout"
                aria-label="Logout"
              >
                <i className="fa-solid fa-right-from-bracket text-base"></i>
              </button>
            )}
          </div>
          {collapsed && (
            <button
              onClick={handleLogout}
              className="flex items-center justify-center w-full mt-1 py-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              title="Logout"
              aria-label="Logout"
            >
              <i className="fa-solid fa-right-from-bracket text-base"></i>
            </button>
          )}
        </div>
      </aside>

      {/* Flyout overlay for collapsed sidebar (submenus) */}
      {collapsed && hoveredParent && (() => {
        let parentLink = null
        for (const section of visibleSections) {
          parentLink = section.links.find(l => l.href === hoveredParent && l.children)
          if (parentLink) break
        }
        if (!parentLink) return null
        return (
          <div
            className="fixed z-[60] glass-panel !rounded-xl py-1.5 w-52 animate-scale-in origin-top-left"
            style={{ left: collapsed ? '4.5rem' : '16rem', top: `${flyoutPos.top}px` }}
            onMouseEnter={() => setHoveredParent(hoveredParent)}
            onMouseLeave={() => setHoveredParent(null)}
          >
            <div className="px-3 py-2 border-b border-gray-700/70">
              <p className="text-xs font-semibold text-white flex items-center gap-2">
                <i className={`fa-solid ${parentLink.icon} text-indigo-400`}></i>
                {parentLink.label}
              </p>
            </div>
            <div className="py-1">
              {parentLink.children.map(child => {
                const childActive = router.pathname === child.href
                return (
                  <button
                    key={child.href}
                    onClick={() => { navigate(child.href); setHoveredParent(null) }}
                    className={`flex items-center gap-2.5 px-3 py-2 mx-1.5 rounded-lg text-xs font-medium transition-colors text-left w-[calc(100%-0.75rem)] ${
                      childActive
                        ? 'bg-indigo-500/15 text-indigo-300'
                        : 'text-gray-400 hover:bg-gray-700/60 hover:text-white'
                    }`}
                  >
                    <i className={`fa-solid ${child.icon} text-[11px] w-4 text-center`}></i>
                    <span className="whitespace-nowrap">{child.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })()}
    </>
  )
}
