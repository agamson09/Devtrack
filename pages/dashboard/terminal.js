import { useState, useEffect, useRef, useCallback } from 'react'
import Layout from '@/components/layout/Layout'
import { useAuth } from '@/components/AuthContext'

export default function TerminalPage() {
  const { user } = useAuth()
  const termRef = useRef(null)
  const xtermRef = useRef(null)
  const fitAddonRef = useRef(null)
  const socketRef = useRef(null)
  const spawnedRef = useRef(false)
  const [connected, setConnected] = useState(false)
  const [spawned, setSpawned] = useState(false)
  const [shell, setShell] = useState('bash')

  useEffect(() => {
    if (!termRef.current || !user || user.role !== 'admin') return

    let disposed = false

    async function init() {
      const { Terminal } = await import('@xterm/xterm')
      const { FitAddon } = await import('@xterm/addon-fit')
      const { WebLinksAddon } = await import('@xterm/addon-web-links')
      await import('@xterm/xterm/css/xterm.css')

      if (disposed || !termRef.current) return

      const term = new Terminal({
        theme: {
          background: '#0f172a',
          foreground: '#e2e8f0',
          cursor: '#6366f1',
          cursorAccent: '#0f172a',
          selectionBackground: '#4f46e550',
          black: '#1e293b',
          red: '#ef4444',
          green: '#22c55e',
          yellow: '#f59e0b',
          blue: '#3b82f6',
          magenta: '#a855f7',
          cyan: '#06b6d4',
          white: '#e2e8f0',
          brightBlack: '#64748b',
          brightRed: '#f87171',
          brightGreen: '#4ade80',
          brightYellow: '#fbbf24',
          brightBlue: '#60a5fa',
          brightMagenta: '#c084fc',
          brightCyan: '#22d3ee',
          brightWhite: '#f8fafc',
        },
        fontFamily: '"Cascadia Code", "Fira Code", "JetBrains Mono", Menlo, monospace',
        fontSize: 14,
        lineHeight: 1.2,
        cursorBlink: true,
        cursorStyle: 'bar',
        scrollback: 10000,
        allowProposedApi: true,
      })

      const fitAddon = new FitAddon()
      const webLinksAddon = new WebLinksAddon()
      term.loadAddon(fitAddon)
      term.loadAddon(webLinksAddon)
      term.open(termRef.current)
      fitAddon.fit()

      xtermRef.current = term
      fitAddonRef.current = fitAddon

      const { io } = await import('socket.io-client')
      const socket = io({ transports: ['websocket'], auth: { token: localStorage.getItem('devtrack_socket_token') } })
      socketRef.current = socket

      socket.on('connect', () => setConnected(true))
      socket.on('disconnect', () => { setConnected(false); spawnedRef.current = false; setSpawned(false) })

      socket.on('terminal:spawned', () => {
        spawnedRef.current = true
        setSpawned(true)
        term.focus()
      })

      socket.on('terminal:data', (data) => { term.write(data) })

      socket.on('terminal:exit', () => {
        spawnedRef.current = false
        setSpawned(false)
        term.write('\r\n\x1b[33m[Process exited]\x1b[0m\r\n')
      })

      socket.on('terminal:error', (msg) => {
        term.write(`\r\n\x1b[31mError: ${msg}\x1b[0m\r\n`)
      })

      socket.on('connect_error', () => {
        setConnected(false)
        term.write('\r\n\x1b[31mConnection error. Check if you are logged in.\x1b[0m\r\n')
      })

      term.onData((data) => {
        if (spawnedRef.current && socket.connected) {
          socket.emit('terminal:input', data)
        }
      })

      term.onResize(({ cols, rows }) => {
        if (socket.connected) {
          socket.emit('terminal:resize', { cols, rows })
        }
      })

      const resizeObserver = new ResizeObserver(() => {
        try { fitAddon.fit() } catch {}
      })
      resizeObserver.observe(termRef.current)

      xtermRef.current._resizeObserver = resizeObserver
    }

    init()

    return () => {
      disposed = true
      if (xtermRef.current) {
        if (xtermRef.current._resizeObserver) {
          xtermRef.current._resizeObserver.disconnect()
        }
        xtermRef.current.dispose()
        xtermRef.current = null
      }
      if (socketRef.current) {
        socketRef.current.emit('terminal:kill')
        socketRef.current.disconnect()
        socketRef.current = null
      }
    }
  }, [user])

  const spawnTerminal = useCallback(() => {
    if (!socketRef.current || !socketRef.current.connected) return
    if (!spawned) {
      const cols = xtermRef.current?.cols || 120
      const rows = xtermRef.current?.rows || 30
      socketRef.current.emit('terminal:spawn', { shell, cols, rows })
    }
  }, [shell, spawned])

  const killTerminal = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.emit('terminal:kill')
      spawnedRef.current = false
      setSpawned(false)
    }
  }, [])

  if (!user || user.role !== 'admin') {
    return (
      <Layout>
        <div className="p-6 text-center">
          <i className="fa-solid fa-lock text-4xl text-gray-600 mb-4"></i>
          <p className="text-gray-400">Admin access required</p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="p-6 h-[calc(100vh-8rem)]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Web Terminal</h1>
            <p className="text-gray-400 text-sm mt-1">SSH into the server via browser</p>
          </div>
          <div className="flex items-center gap-3">
            <select value={shell} onChange={(e) => setShell(e.target.value)} disabled={spawned} className="bg-gray-700 text-white text-sm rounded-lg px-3 py-2 border border-gray-600 focus:border-indigo-500 focus:outline-none disabled:opacity-50">
              <option value="bash">Bash</option>
              <option value="sh">Sh</option>
            </select>
            <span className={`flex items-center gap-1.5 text-xs ${connected ? 'text-emerald-400' : 'text-red-400'}`}>
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-red-400'}`}></span>
              {connected ? (spawned ? 'Connected' : 'Ready') : 'Disconnected'}
            </span>
            {!spawned ? (
              <button onClick={spawnTerminal} disabled={!connected} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg text-white text-sm font-medium transition-colors">
                <i className="fa-solid fa-terminal mr-1"></i> Connect
              </button>
            ) : (
              <button onClick={killTerminal} className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-white text-sm font-medium transition-colors">
                <i className="fa-solid fa-stop mr-1"></i> Disconnect
              </button>
            )}
          </div>
        </div>

        <div className="bg-[#0f172a] rounded-xl border border-gray-700 overflow-hidden h-[calc(100%-4rem)]">
          <div ref={termRef} className="w-full h-full p-2" />
        </div>
      </div>
    </Layout>
  )
}
