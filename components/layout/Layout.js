import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '@/components/AuthContext'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import Loading from '@/components/common/Loading'
import KeyboardShortcuts from '@/components/common/KeyboardShortcuts'

export default function Layout({ children }) {
  const router = useRouter()
  const { user, loading } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('sidebar_collapsed')
    if (saved === 'true') setCollapsed(true)
  }, [])

  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', collapsed)
  }, [collapsed])

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  if (loading) {
    return <Loading fullPage message="Loading DevTrack..." />
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
      />

      <KeyboardShortcuts
        onToggleSidebar={() => setCollapsed(!collapsed)}
        onOpenSearch={() => router.push('/dashboard/search')}
      />

      <div className={`transition-all duration-300 ease-in-out ${collapsed ? 'lg:ml-[4.5rem]' : 'lg:ml-64'}`}>
        <Header
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onToggleCollapse={() => setCollapsed(!collapsed)}
          sidebarCollapsed={collapsed}
        />

        <main className="p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
