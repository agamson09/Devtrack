import { useRef, useEffect } from 'react'

export default function RemoteTerminal({ output, connected }) {
  const termRef = useRef(null)
  const xtermRef = useRef(null)
  const fitAddonRef = useRef(null)

  useEffect(() => {
    if (!termRef.current) return
    let disposed = false

    async function init() {
      const { Terminal } = await import('@xterm/xterm')
      const { FitAddon } = await import('@xterm/addon-fit')
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
        fontSize: 13,
        lineHeight: 1.2,
        cursorBlink: false,
        cursorStyle: 'bar',
        scrollback: 5000,
        disableStdin: true,
        allowProposedApi: true,
      })

      const fitAddon = new FitAddon()
      term.loadAddon(fitAddon)
      term.open(termRef.current)
      fitAddon.fit()

      xtermRef.current = term
      fitAddonRef.current = fitAddon

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
        if (xtermRef.current._resizeObserver) xtermRef.current._resizeObserver.disconnect()
        xtermRef.current.dispose()
        xtermRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (xtermRef.current && output) {
      xtermRef.current.write(output)
    }
  }, [output])

  return (
    <div className="bg-[#0f172a] rounded-lg border border-gray-700 overflow-hidden" style={{ height: '100%' }}>
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></span>
          <span className="text-[10px] text-gray-400 font-mono">
            {connected ? 'SSH Connected' : 'Disconnected'}
          </span>
        </div>
        <span className="text-[10px] text-gray-600">remote-deploy</span>
      </div>
      <div ref={termRef} className="w-full p-1" style={{ height: 'calc(100% - 28px)' }} />
    </div>
  )
}
