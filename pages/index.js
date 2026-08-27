import { useState, useEffect } from 'react'
import Head from 'next/head'

const FEATURES = [
  {
    icon: 'fa-table-columns',
    title: 'Kanban Board',
    desc: 'Drag-and-drop task management with customizable workflows.',
    color: 'from-blue-500 to-cyan-500',
  },
  {
    icon: 'fa-chart-gantt',
    title: 'Timeline & Gantt',
    desc: 'Visual project planning with day, week, and month views.',
    color: 'from-purple-500 to-pink-500',
  },
  {
    icon: 'fa-comments',
    title: 'Real-Time Chat',
    desc: 'Private & group messaging with file sharing and voice notes.',
    color: 'from-green-500 to-emerald-500',
  },
  {
    icon: 'fa-desktop',
    title: 'Remote Desktop',
    desc: 'Control Windows machines directly from your browser.',
    color: 'from-orange-500 to-red-500',
  },
  {
    icon: 'fa-terminal',
    title: 'Web Terminal',
    desc: 'Full SSH terminal access with xterm.js integration.',
    color: 'from-gray-500 to-slate-500',
  },
  {
    icon: 'fa-database',
    title: 'Database Manager',
    desc: 'Browse, query, and manage MySQL databases in-browser.',
    color: 'from-yellow-500 to-amber-500',
  },
  {
    icon: 'fa-server',
    title: 'Server Monitor',
    desc: 'Real-time CPU, RAM, disk, and network metrics.',
    color: 'from-red-500 to-rose-500',
  },
  {
    icon: 'fa-rocket',
    title: 'Deploy Pipeline',
    desc: 'Push-to-deploy with build logs and rollback support.',
    color: 'from-indigo-500 to-violet-500',
  },
  {
    icon: 'fa-calendar-days',
    title: 'Calendar',
    desc: 'Monthly view with task deadlines and team scheduling.',
    color: 'from-teal-500 to-cyan-500',
  },
  {
    icon: 'fa-chart-bar',
    title: 'Reports & Analytics',
    desc: 'Team performance, burndown charts, and activity heatmaps.',
    color: 'from-pink-500 to-fuchsia-500',
  },
  {
    icon: 'fa-shield-halved',
    title: 'Security',
    desc: 'JWT auth, CSRF protection, rate limiting, and audit logs.',
    color: 'from-emerald-500 to-green-500',
  },
  {
    icon: 'fa-palette',
    title: 'Custom Branding',
    desc: 'Multi-tenant with custom logos, themes, and feature toggles.',
    color: 'from-violet-500 to-purple-500',
  },
]

const TECH = [
  { name: 'Next.js', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/nextjs/nextjs-original.svg' },
  { name: 'React', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/react/react-original.svg' },
  { name: 'Tailwind CSS', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/tailwindcss/tailwindcss-original.svg' },
  { name: 'MySQL', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/mysql/mysql-original.svg' },
  { name: 'Socket.IO', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/socketio/socketio-original.svg' },
  { name: 'Node.js', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/nodejs/nodejs-original.svg' },
  { name: 'C#', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/csharp/csharp-original.svg' },
  { name: 'Docker', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/docker/docker-original.svg' },
  { name: 'Git', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/git/git-original.svg' },
  { name: 'Nginx', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/nginx/nginx-original.svg' },
]

const STATS = [
  { value: '15+', label: 'Modules' },
  { value: '40+', label: 'API Endpoints' },
  { value: '20+', label: 'DB Tables' },
  { value: 'Real-time', label: 'Collaboration' },
]

const TIMELINE_ITEMS = [
  { phase: 'Phase 1', title: 'Core Platform', desc: 'Auth, Projects, Tasks, Kanban, Calendar', status: 'done' },
  { phase: 'Phase 2', title: 'Collaboration', desc: 'Chat, Notifications, Team Management', status: 'done' },
  { phase: 'Phase 3', title: 'DevOps Tools', desc: 'Terminal, Server Monitor, Deploy Pipeline', status: 'done' },
  { phase: 'Phase 4', title: 'IT Support', desc: 'Asset Tracking, Password Vault, IP Manager', status: 'done' },
  { phase: 'Phase 5', title: 'Multi-Tenant', desc: 'Tenant Isolation, Custom Branding, Invites', status: 'current' },
  { phase: 'Phase 6', title: 'Public Launch', desc: 'Docker, Landing Page, Documentation', status: 'upcoming' },
]

function AnimatedCounter({ target, suffix = '' }) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const num = parseInt(target)
    if (isNaN(num)) return
    let current = 0
    const step = Math.ceil(num / 30)
    const timer = setInterval(() => {
      current += step
      if (current >= num) {
        setCount(num)
        clearInterval(timer)
      } else {
        setCount(current)
      }
    }, 30)
    return () => clearInterval(timer)
  }, [target])

  return <span>{count}{suffix}</span>
}

export default function LandingPage() {
  const [scrollY, setScrollY] = useState(0)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [dbReady, setDbReady] = useState(null)

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    fetch('/api/system/db-status')
      .then((res) => res.json())
      .then((data) => setDbReady(Boolean(data.ready)))
      .catch(() => setDbReady(false))
  }, [])

  return (
    <>
      <Head>
        <title>DevTrack — Project Management & IT Support Platform</title>
        <meta name="description" content="Full-stack project management platform with Kanban, Gantt, real-time chat, remote desktop, server monitoring, and more." />
        <meta property="og:title" content="DevTrack — Project Management & IT Support" />
        <meta property="og:description" content="Full-stack project management platform with Kanban, Gantt, real-time chat, remote desktop, and server monitoring." />
        <meta property="og:type" content="website" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </Head>

      <div className="min-h-screen bg-gray-950 text-white" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
        {dbReady === false && (
          <div className="fixed top-0 left-0 right-0 z-[60] bg-amber-500/95 border-b border-amber-500/40 backdrop-blur">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-gray-950 font-medium">Database is not set up yet — DevTrack needs MySQL and an initial schema.</span>
              <a href="/setup" className="font-bold text-gray-950 underline hover:text-gray-700">Run Setup Wizard →</a>
            </div>
          </div>
        )}
        {/* Navigation */}
        <nav className={`fixed ${dbReady === false ? 'top-11' : 'top-0'} left-0 right-0 z-50 transition-all duration-300 ${scrollY > 50 ? 'bg-gray-950/90 backdrop-blur-xl border-b border-gray-800/50 shadow-2xl shadow-black/20' : 'bg-transparent'}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16 sm:h-20">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <span className="text-xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">DevTrack</span>
              </div>

              <div className="hidden md:flex items-center gap-8">
                <a href="#features" className="text-sm text-gray-400 hover:text-white transition-colors">Features</a>
                <a href="#tech" className="text-sm text-gray-400 hover:text-white transition-colors">Tech Stack</a>
                <a href="#roadmap" className="text-sm text-gray-400 hover:text-white transition-colors">Roadmap</a>
                <a href="https://github.com/agamson09/Devtrack" target="_blank" rel="noopener" className="text-sm text-gray-400 hover:text-white transition-colors">
                  <i className="fa-brands fa-github text-lg"></i>
                </a>
              </div>

              <div className="flex items-center gap-3">
                <a href="/login" className="hidden sm:block text-sm text-gray-300 hover:text-white transition-colors font-medium">
                  Sign In
                </a>
                <a href="/register" className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 hover:-translate-y-0.5">
                  Get Started
                </a>
                <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden text-gray-400 hover:text-white p-1">
                  <i className={`fa-solid ${mobileMenuOpen ? 'fa-xmark' : 'fa-bars'} text-lg`}></i>
                </button>
              </div>
            </div>
          </div>

          {/* Mobile menu */}
          {mobileMenuOpen && (
            <div className="md:hidden bg-gray-900/95 backdrop-blur-xl border-b border-gray-800">
              <div className="px-4 py-4 space-y-3">
                <a href="#features" onClick={() => setMobileMenuOpen(false)} className="block text-gray-300 hover:text-white py-2">Features</a>
                <a href="#tech" onClick={() => setMobileMenuOpen(false)} className="block text-gray-300 hover:text-white py-2">Tech Stack</a>
                <a href="#roadmap" onClick={() => setMobileMenuOpen(false)} className="block text-gray-300 hover:text-white py-2">Roadmap</a>
                <a href="/login" className="block text-gray-300 hover:text-white py-2">Sign In</a>
              </div>
            </div>
          )}
        </nav>

        {/* Hero Section */}
        <section className="relative pt-32 sm:pt-40 pb-20 sm:pb-32 overflow-hidden">
          {/* Background effects */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-3xl"></div>
          </div>

          {/* Grid pattern */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.03)_1px,transparent_1px)] bg-[size:64px_64px]"></div>

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-sm text-indigo-300 mb-8 backdrop-blur-sm">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
              Open Source & Self-Hosted
            </div>

            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-tight mb-6">
              <span className="bg-gradient-to-b from-white via-white to-gray-400 bg-clip-text text-transparent">
                Project Management
              </span>
              <br />
              <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                & IT Support Platform
              </span>
            </h1>

            <p className="max-w-2xl mx-auto text-lg sm:text-xl text-gray-400 mb-10 leading-relaxed">
              All-in-one platform for development teams. Kanban boards, Gantt charts, real-time chat, remote desktop, server monitoring, and database management — built with Next.js, React, and MySQL.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
              <a href="/register" className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-2xl transition-all duration-200 shadow-2xl shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-1 text-lg">
                Get Started Free
              </a>
              <a href="https://github.com/agamson09/Devtrack" target="_blank" rel="noopener" className="w-full sm:w-auto px-8 py-4 bg-gray-800/50 hover:bg-gray-800 border border-gray-700 hover:border-gray-600 text-white font-semibold rounded-2xl transition-all duration-200 backdrop-blur-sm text-lg flex items-center justify-center gap-3">
                <i className="fa-brands fa-github text-xl"></i>
                View on GitHub
              </a>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 max-w-3xl mx-auto">
              {STATS.map((stat, i) => (
                <div key={i} className="text-center">
                  <div className="text-2xl sm:text-3xl font-bold text-white mb-1">
                    {stat.value.includes('+') ? (
                      <><AnimatedCounter target={stat.value.replace('+', '')} suffix="+" /></>
                    ) : stat.value}
                  </div>
                  <div className="text-sm text-gray-500">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section id="features" className="py-20 sm:py-32 relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-xs text-indigo-300 mb-4 uppercase tracking-wider font-semibold">
                Features
              </div>
              <h2 className="text-3xl sm:text-5xl font-bold text-white mb-4">
                Everything you need
              </h2>
              <p className="text-gray-400 max-w-2xl mx-auto text-lg">
                A complete toolkit for managing projects, teams, infrastructure, and IT operations — all in one place.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {FEATURES.map((feature, i) => (
                <div
                  key={i}
                  className="group relative bg-gray-900/50 border border-gray-800 hover:border-gray-700 rounded-2xl p-6 transition-all duration-300 hover:bg-gray-800/50 hover:shadow-2xl hover:shadow-black/20 hover:-translate-y-1"
                >
                  <div className={`w-12 h-12 bg-gradient-to-br ${feature.color} rounded-xl flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    <i className={`fa-solid ${feature.icon} text-white text-lg`}></i>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Tech Stack */}
        <section id="tech" className="py-20 sm:py-32 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-gray-950 via-gray-900/50 to-gray-950"></div>
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-500/10 border border-purple-500/20 rounded-full text-xs text-purple-300 mb-4 uppercase tracking-wider font-semibold">
                Tech Stack
              </div>
              <h2 className="text-3xl sm:text-5xl font-bold text-white mb-4">
                Built with modern tech
              </h2>
              <p className="text-gray-400 max-w-2xl mx-auto text-lg">
                Industry-proven technologies, carefully chosen for performance and developer experience.
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-6 sm:gap-8 max-w-4xl mx-auto">
              {TECH.map((t, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center gap-3 p-5 bg-gray-900/50 border border-gray-800 rounded-2xl hover:border-gray-700 hover:bg-gray-800/50 transition-all duration-300 hover:-translate-y-1 min-w-[100px]"
                >
                  <img src={t.icon} alt={t.name} className="w-10 h-10" />
                  <span className="text-sm text-gray-300 font-medium">{t.name}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Architecture Diagram */}
        <section className="py-20 sm:py-32">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full text-xs text-green-300 mb-4 uppercase tracking-wider font-semibold">
                Architecture
              </div>
              <h2 className="text-3xl sm:text-5xl font-bold text-white mb-4">
                Full-stack architecture
              </h2>
              <p className="text-gray-400 max-w-2xl mx-auto text-lg">
                From frontend to backend to infrastructure — a complete, production-ready system.
              </p>
            </div>

            <div className="bg-gray-900/50 border border-gray-800 rounded-3xl p-6 sm:p-10 max-w-4xl mx-auto">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {/* Client */}
                <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6 text-center">
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/20">
                    <i className="fa-solid fa-globe text-white text-xl"></i>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">Client</h3>
                  <p className="text-gray-400 text-sm">React 19 + Next.js 16 + Tailwind CSS</p>
                </div>

                {/* Server */}
                <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6 text-center">
                  <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-green-500/20">
                    <i className="fa-solid fa-server text-white text-xl"></i>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">Server</h3>
                  <p className="text-gray-400 text-sm">Node.js + Socket.IO + MySQL</p>
                </div>

                {/* Agent */}
                <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6 text-center">
                  <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-purple-500/20">
                    <i className="fa-solid fa-desktop text-white text-xl"></i>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">Agent</h3>
                  <p className="text-gray-400 text-sm">C# Windows Desktop Capture</p>
                </div>
              </div>

              {/* Connection lines */}
              <div className="hidden sm:flex items-center justify-center gap-4 mt-6">
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-600 to-transparent"></div>
                <div className="flex items-center gap-2 text-gray-500 text-xs">
                  <i className="fa-solid fa-arrows-left-right"></i>
                  <span>HTTP + WebSocket</span>
                </div>
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-600 to-transparent"></div>
              </div>
            </div>
          </div>
        </section>

        {/* Roadmap */}
        <section id="roadmap" className="py-20 sm:py-32 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-gray-950 via-indigo-950/10 to-gray-950"></div>
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-orange-500/10 border border-orange-500/20 rounded-full text-xs text-orange-300 mb-4 uppercase tracking-wider font-semibold">
                Roadmap
              </div>
              <h2 className="text-3xl sm:text-5xl font-bold text-white mb-4">
                Development journey
              </h2>
              <p className="text-gray-400 max-w-2xl mx-auto text-lg">
                From concept to production — building features iteratively.
              </p>
            </div>

            <div className="max-w-3xl mx-auto">
              {TIMELINE_ITEMS.map((item, i) => (
                <div key={i} className="flex gap-6 mb-8 last:mb-0">
                  <div className="flex flex-col items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 border-2 ${
                      item.status === 'done' ? 'bg-green-500/20 border-green-500 text-green-400' :
                      item.status === 'current' ? 'bg-indigo-500/20 border-indigo-500 text-indigo-400 animate-pulse' :
                      'bg-gray-800 border-gray-700 text-gray-500'
                    }`}>
                      {item.status === 'done' ? (
                        <i className="fa-solid fa-check text-sm"></i>
                      ) : item.status === 'current' ? (
                        <i className="fa-solid fa-spinner text-sm"></i>
                      ) : (
                        <i className="fa-solid fa-circle text-xs"></i>
                      )}
                    </div>
                    {i < TIMELINE_ITEMS.length - 1 && (
                      <div className={`w-0.5 flex-1 my-2 ${item.status === 'done' ? 'bg-green-500/30' : 'bg-gray-800'}`}></div>
                    )}
                  </div>
                  <div className="pb-8">
                    <span className={`text-xs font-semibold uppercase tracking-wider ${
                      item.status === 'done' ? 'text-green-400' :
                      item.status === 'current' ? 'text-indigo-400' : 'text-gray-500'
                    }`}>{item.phase}</span>
                    <h3 className="text-lg font-bold text-white mt-1">{item.title}</h3>
                    <p className="text-gray-400 text-sm mt-1">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 sm:py-32">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="relative bg-gradient-to-br from-indigo-600/20 via-purple-600/20 to-pink-600/20 border border-indigo-500/20 rounded-3xl p-10 sm:p-16 text-center overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.1),transparent_70%)]"></div>
              <div className="relative">
                <h2 className="text-3xl sm:text-5xl font-bold text-white mb-4">
                  Ready to get started?
                </h2>
                <p className="text-gray-400 max-w-xl mx-auto text-lg mb-8">
                  Self-host DevTrack on your own infrastructure. Full control, full privacy, full power.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <a href="/register" className="w-full sm:w-auto px-8 py-4 bg-white text-gray-900 font-bold rounded-2xl transition-all duration-200 shadow-2xl shadow-white/10 hover:shadow-white/20 hover:-translate-y-1 text-lg">
                    Start Free →
                  </a>
                  <a href="https://github.com/agamson09/Devtrack" target="_blank" rel="noopener" className="w-full sm:w-auto px-8 py-4 bg-gray-800/50 hover:bg-gray-800 border border-gray-700 text-white font-semibold rounded-2xl transition-all duration-200 backdrop-blur-sm text-lg">
                    <i className="fa-brands fa-github mr-2"></i>
                    Star on GitHub
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-gray-800 py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <span className="font-bold text-white">DevTrack</span>
              </div>

              <div className="flex items-center gap-6">
                <a href="#features" className="text-sm text-gray-400 hover:text-white transition-colors">Features</a>
                <a href="#tech" className="text-sm text-gray-400 hover:text-white transition-colors">Tech</a>
                <a href="#roadmap" className="text-sm text-gray-400 hover:text-white transition-colors">Roadmap</a>
                <a href="https://github.com/agamson09/Devtrack" target="_blank" rel="noopener" className="text-gray-400 hover:text-white transition-colors">
                  <i className="fa-brands fa-github text-lg"></i>
                </a>
              </div>

              <p className="text-sm text-gray-500">
                Built with Next.js, React & MySQL
              </p>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}
