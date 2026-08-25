import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Layout from '@/components/layout/Layout'
import { useAuth } from '@/components/AuthContext'
import Loading from '@/components/common/Loading'

const STATUS_BADGES = {
  pending: 'bg-yellow-500/20 text-yellow-400',
  approved: 'bg-green-500/20 text-green-400',
  rejected: 'bg-red-500/20 text-red-400',
  completed: 'bg-blue-500/20 text-blue-400',
}

function StatusBadge({ status }) {
  const cls = STATUS_BADGES[status] || 'bg-gray-500/20 text-gray-400'
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {status}
    </span>
  )
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function ITSupportDashboard() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!user || (user.role !== 'admin' && user.role !== 'it_support')) {
      router.push('/dashboard')
      return
    }

    async function fetchDashboard() {
      try {
        const res = await fetch('/api/it-support/dashboard')
        if (res.ok) {
          const data = await res.json()
          setStats(data)
        }
      } catch (err) {
        console.error('Failed to fetch IT support dashboard:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchDashboard()
  }, [user, authLoading, router])

  if (authLoading || loading || !user) {
    return (
      <Layout>
        <Loading />
      </Layout>
    )
  }

  if (user.role !== 'admin' && user.role !== 'it_support') {
    return null
  }

  const statCards = [
    {
      icon: 'fa-solid fa-cart-shopping',
      label: 'Purchase Requests',
      value: stats?.purchases?.total || 0,
      color: 'bg-blue-500',
      sub: stats?.purchases?.pending ? `${stats.purchases.pending} pending` : null,
    },
    {
      icon: 'fa-solid fa-boxes-stacked',
      label: 'Inventory Items',
      value: stats?.inventory?.total || 0,
      color: 'bg-emerald-500',
      sub: stats?.inventory?.available ? `${stats.inventory.available} available` : null,
    },
    {
      icon: 'fa-solid fa-key',
      label: 'Passwords',
      value: stats?.passwords?.total || 0,
      color: 'bg-purple-500',
      sub: null,
    },
    {
      icon: 'fa-solid fa-network-wired',
      label: 'IP Addresses',
      value: stats?.ips?.total || 0,
      color: 'bg-amber-500',
      sub: stats?.ips?.available ? `${stats.ips.available} available` : null,
    },
    {
      icon: 'fa-solid fa-envelope',
      label: 'Email Employee',
      value: stats?.emails?.total || 0,
      color: 'bg-cyan-500',
      sub: stats?.emails?.active ? `${stats.emails.active} active` : null,
    },
  ]

  return (
    <Layout title="IT Support Dashboard">
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">IT Support Dashboard</h1>
          <p className="text-gray-400 mt-1">Overview of IT support resources</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {statCards.map((card) => (
            <div key={card.label} className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-lg ${card.color}`}>
                  <i className={`${card.icon} text-white text-lg w-6 text-center`} />
                </div>
                <div>
                  <p className="text-sm text-gray-400">{card.label}</p>
                  <p className="text-2xl font-bold text-white">{card.value}</p>
                </div>
              </div>
              {card.sub && (
                <p className="text-xs text-gray-500 mt-3 ml-1">{card.sub}</p>
              )}
            </div>
          ))}
        </div>

        <div className="bg-gray-800 rounded-xl border border-gray-700">
          <div className="px-6 py-4 border-b border-gray-700">
            <div className="flex items-center gap-2">
              <i className="fa-solid fa-clock-rotate-left text-indigo-400" />
              <h2 className="text-lg font-semibold text-white">Recent Purchase Requests</h2>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700 text-gray-400">
                  <th className="text-left py-3 px-6">Item</th>
                  <th className="text-left py-3 px-6">Status</th>
                  <th className="text-left py-3 px-6">Requested By</th>
                  <th className="text-left py-3 px-6">Date</th>
                </tr>
              </thead>
              <tbody>
                {stats?.recentPurchases && stats.recentPurchases.length > 0 ? (
                  stats.recentPurchases.map((purchase) => (
                    <tr key={purchase.id} className="border-b border-gray-700 last:border-b-0 hover:bg-gray-700/50">
                      <td className="py-3 px-6 text-white font-medium">{purchase.item_name}</td>
                      <td className="py-3 px-6">
                        <StatusBadge status={purchase.status} />
                      </td>
                      <td className="py-3 px-6 text-gray-300">{purchase.requested_by_name}</td>
                      <td className="py-3 px-6 text-gray-400">{formatDate(purchase.created_at)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-gray-500">
                      No recent purchase requests
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  )
}
