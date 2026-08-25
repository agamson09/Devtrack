import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import CommandPalette from './CommandPalette'

const SHORTCUTS = [
  { keys: ['Ctrl', 'K'], label: 'Command Palette', action: 'search' },
  { keys: ['Ctrl', 'N'], label: 'New Task', action: 'newTask' },
  { keys: ['Ctrl', '/'], label: 'Toggle Sidebar', action: 'sidebar' },
  { keys: ['Esc'], label: 'Close Modal', action: 'close' },
  { keys: ['?'], label: 'Show Shortcuts', action: 'help' },
]

export default function KeyboardShortcuts({ onToggleSidebar, onOpenSearch }) {
  const router = useRouter()
  const [showHelp, setShowHelp] = useState(false)
  const [showPalette, setShowPalette] = useState(false)

  const handleKeyDown = useCallback((e) => {
    const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT' || e.target.isContentEditable

    if (e.key === '?' && !isInput) {
      e.preventDefault()
      setShowHelp(prev => !prev)
      return
    }

    if (e.key === 'Escape') {
      setShowHelp(false)
      const modal = document.querySelector('[data-modal-overlay]')
      if (modal) modal.click()
      return
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault()
      setShowPalette(true)
      return
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault()
      const addBtn = document.querySelector('[data-add-task-btn]')
      if (addBtn) addBtn.click()
      return
    }

    if ((e.ctrlKey || e.metaKey) && e.key === '/') {
      e.preventDefault()
      if (onToggleSidebar) onToggleSidebar()
      return
    }
  }, [onToggleSidebar])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  if (!showHelp && !showPalette) return null

  return (
    <>
      {showPalette && <CommandPalette onClose={() => setShowPalette(false)} />}

      {showHelp && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[80]" onClick={() => setShowHelp(false)}>
          <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-sm border border-gray-700 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white text-lg font-bold">Keyboard Shortcuts</h3>
              <button onClick={() => setShowHelp(false)} className="text-gray-400 hover:text-white">
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>
            <div className="space-y-3">
              {SHORTCUTS.map((s, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-gray-300 text-sm">{s.label}</span>
                  <div className="flex items-center gap-1">
                    {s.keys.map((k, ki) => (
                      <kbd key={ki} className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-gray-300 font-mono min-w-[24px] text-center">{k}</kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-gray-500 text-[10px] text-center mt-5">Press <kbd className="px-1 py-0.5 bg-gray-700 border border-gray-600 rounded text-[10px]">?</kbd> anywhere to toggle this</p>
          </div>
        </div>
      )}
    </>
  )
}
