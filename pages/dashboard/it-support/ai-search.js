import { useState, useEffect } from 'react'
import Layout from '@/components/layout/Layout'
import { useAuth } from '@/components/AuthContext'
import { useRouter } from 'next/router'

export default function AiSearchPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searchHistory, setSearchHistory] = useState([])

  const canManage = user?.role === 'admin' || user?.role === 'it_support'

  useEffect(() => { if (user && !canManage) router.push('/dashboard') }, [user])

  async function handleSearch(e) {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setError('')
    setResults([])

    try {
      const res = await fetch('/api/it-support/ai-search', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim() })
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
      }
      setResults(data.recommendations || [])
      setSearchHistory(prev => [{ query: query.trim(), time: new Date() }, ...prev.slice(0, 9)])
    } catch (err) {
      setError('Failed to search. Please try again.')
    }
    setLoading(false)
  }

  function categoryIcon(c) {
    const icons = {
      laptop: 'fa-laptop', desktop: 'fa-desktop', monitor: 'fa-desktop',
      peripheral: 'fa-keyboard', network: 'fa-network-wired', server: 'fa-server',
      printer: 'fa-print', storage: 'fa-hard-drive', security: 'fa-shield-halved',
      other: 'fa-box'
    }
    return icons[c?.toLowerCase()] || 'fa-box'
  }

  const exampleQueries = [
    'Laptop untuk developer dengan budget 15 juta',
    'Monitor 27 inch untuk desain grafis',
    'Router WiFi untuk kantor 50 orang',
    'Mouse dan keyboard wireless ergonomic',
    'Server untuk hosting aplikasi web',
    'UPS untuk server room',
    'Printer laser multifungsi untuk kantor',
    'CCTV untuk monitoring kantor',
  ]

  if (!canManage) return null

  return (
    <Layout title="AI Product Search">
      <div className="space-y-6">
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-indigo-600/20 rounded-lg flex items-center justify-center">
              <i className="fa-solid fa-robot text-indigo-400"></i>
            </div>
            <div>
              <h3 className="text-white font-semibold">AI-Powered IT Product Search</h3>
              <p className="text-gray-400 text-sm">Describe what you need and get product recommendations with estimated prices</p>
            </div>
          </div>

          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="relative flex-1">
              <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Describe what IT equipment you need..."
                className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-10 pr-4 py-3 text-white focus:border-indigo-500 focus:outline-none"
                disabled={loading}
              />
            </div>
            <button type="submit" disabled={loading || !query.trim()} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2">
              {loading ? (
                <><div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div> Searching...</>
              ) : (
                <><i className="fa-solid fa-wand-magic-sparkles"></i> Search</>
              )}
            </button>
          </form>

          {!results.length && !loading && !error && (
            <div className="mt-4">
              <p className="text-gray-400 text-xs mb-2">Try asking about:</p>
              <div className="flex flex-wrap gap-2">
                {exampleQueries.map((q, i) => (
                  <button key={i} onClick={() => setQuery(q)} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded-full transition-colors">
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
            <i className="fa-solid fa-circle-exclamation text-red-400"></i>
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="animate-spin w-12 h-12 border-3 border-indigo-500 border-t-transparent rounded-full mb-4"></div>
            <p className="text-gray-400">AI is analyzing your request...</p>
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold">
                <i className="fa-solid fa-lightbulb text-yellow-400 mr-2"></i>
                {results.length} Recommendations
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {results.map((item, i) => (
                <div key={i} className="bg-gray-800 rounded-xl p-5 border border-gray-700 hover:border-indigo-500/50 transition-colors">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 bg-indigo-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <i className={`fa-solid ${categoryIcon(item.category)} text-indigo-400`}></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-white font-medium text-sm">{item.name}</h4>
                      <p className="text-gray-400 text-xs">{item.brand} {item.model}</p>
                    </div>
                  </div>

                  {item.estimated_price && (
                    <div className="mb-3">
                      <span className="text-lg font-bold text-green-400">{item.estimated_price}</span>
                    </div>
                  )}

                  {item.specs && (
                    <p className="text-gray-300 text-xs mb-3 leading-relaxed">{item.specs}</p>
                  )}

                  {item.reason && (
                    <div className="bg-gray-700/50 rounded-lg p-3 mb-3">
                      <p className="text-gray-400 text-xs"><i className="fa-solid fa-circle-info mr-1"></i> {item.reason}</p>
                    </div>
                  )}

                  {item.store && (
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <i className="fa-solid fa-store"></i>
                      <span>Available at: {item.store}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && !error && results.length === 0 && query && (
          <div className="text-center py-12 text-gray-500">
            <i className="fa-solid fa-face-sad-tear text-4xl mb-3 block"></i>
            <p>No recommendations found. Try rephrasing your query.</p>
          </div>
        )}

        {searchHistory.length > 0 && (
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <h4 className="text-sm font-medium text-white mb-2"><i className="fa-solid fa-clock-rotate-left mr-1"></i> Recent Searches</h4>
            <div className="space-y-1">
              {searchHistory.map((h, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-gray-400">
                  <span className="text-gray-500">{new Date(h.time).toLocaleTimeString()}</span>
                  <button onClick={() => setQuery(h.query)} className="hover:text-indigo-400 transition-colors truncate">{h.query}</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
