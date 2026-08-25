import { useRef, useEffect, useCallback } from 'react'

export default function Viewer({ frame, connected, onMouseMove, onMouseDown, onMouseUp, onWheel, onKeyDown, onKeyUp }) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const isDraggingRef = useRef(false)
  const lastButtonRef = useRef('left')

  // Render frame to canvas
  useEffect(() => {
    if (!frame || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    const img = new Image()
    img.onload = () => {
      try {
        if (img.width > 0 && img.height > 0) {
          if (img.width !== canvas.width || img.height !== canvas.height) {
            canvas.width = img.width
            canvas.height = img.height
          }
          ctx.drawImage(img, 0, 0, img.width, img.height)
        }
      } catch {}
    }
    img.onerror = () => {}

    let src
    if (typeof frame === 'string') {
      src = 'data:image/jpeg;base64,' + frame
    } else {
      src = 'data:image/jpeg;base64,' + String(frame)
    }
    img.src = src
  }, [frame])

  const getRelativePos = useCallback((e) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return {
      x: Math.round((e.clientX - rect.left) * scaleX),
      y: Math.round((e.clientY - rect.top) * scaleY)
    }
  }, [])

  // Window-level mouse handlers for drag support
  // These are added on mousedown and removed on mouseup so drag works
  // even when cursor moves outside the canvas
  useEffect(() => {
    const handleWindowMouseMove = (e) => {
      if (!isDraggingRef.current) return
      e.preventDefault()
      const pos = getRelativePos(e)
      onMouseMove?.(pos)
    }

    const handleWindowMouseUp = (e) => {
      if (!isDraggingRef.current) return
      isDraggingRef.current = false
      e.preventDefault()
      const pos = getRelativePos(e)
      onMouseUp?.({ ...pos, button: lastButtonRef.current })
    }

    window.addEventListener('mousemove', handleWindowMouseMove)
    window.addEventListener('mouseup', handleWindowMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove)
      window.removeEventListener('mouseup', handleWindowMouseUp)
    }
  }, [getRelativePos, onMouseMove, onMouseUp])

  // Canvas mouse move (for non-drag hover)
  const handleMouseMove = useCallback((e) => {
    if (isDraggingRef.current) return // handled by window listener
    const pos = getRelativePos(e)
    onMouseMove?.(pos)
  }, [getRelativePos, onMouseMove])

  const handleMouseDown = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    const pos = getRelativePos(e)
    const button = e.button === 2 ? 'right' : e.button === 1 ? 'middle' : 'left'
    lastButtonRef.current = button
    isDraggingRef.current = true
    onMouseDown?.({ ...pos, button })
  }, [getRelativePos, onMouseDown])

  const handleMouseUp = useCallback((e) => {
    if (!isDraggingRef.current) return // handled by window listener
    isDraggingRef.current = false
    e.preventDefault()
    const pos = getRelativePos(e)
    onMouseUp?.({ ...pos, button: lastButtonRef.current })
  }, [getRelativePos, onMouseUp])

  const handleWheel = useCallback((e) => {
    e.preventDefault()
    const pos = getRelativePos(e)
    onWheel?.({ ...pos, scroll: e.deltaY > 0 ? -1 : 1 })
  }, [getRelativePos, onWheel])

  const handleContextMenu = useCallback((e) => e.preventDefault(), [])

  // Keyboard
  const MODIFIER_KEYS = ['ctrl', 'control', 'shift', 'alt', 'meta', 'capslock', 'numlock', 'scrolllock', 'printscreen']
  const pressedKeysRef = useRef(new Set())
  const lastKeySendRef = useRef(0)

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!connected) return
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName) || e.target.isContentEditable) return
      const key = e.key.toLowerCase()
      if (MODIFIER_KEYS.includes(key) || e.repeat || pressedKeysRef.current.has(key)) return
      pressedKeysRef.current.add(key)
      e.preventDefault()
      let combo = null
      if (e.ctrlKey || e.metaKey) combo = 'ctrl+' + key
      else if (e.altKey) combo = 'alt+' + key
      else if (e.shiftKey) combo = 'shift+' + key
      const now = Date.now()
      if (now - lastKeySendRef.current < 30) return
      lastKeySendRef.current = now
      onKeyDown?.({ key, combo })
    }
    const handleKeyUp = (e) => {
      if (!connected) return
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName) || e.target.isContentEditable) return
      pressedKeysRef.current.delete(e.key.toLowerCase())
      onKeyUp?.({ key: e.key.toLowerCase() })
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      pressedKeysRef.current.clear()
    }
  }, [connected, onKeyDown, onKeyUp])

  // Reset drag state if connection lost
  useEffect(() => {
    if (!connected) {
      isDraggingRef.current = false
    }
  }, [connected])

  return (
    <div
      ref={containerRef}
      className="relative bg-black rounded-lg overflow-hidden flex items-center justify-center"
      style={{ minHeight: 400, userSelect: 'none', WebkitUserSelect: 'none' }}
    >
      {!connected && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 z-10">
          <div className="text-center">
            <i className="fa-solid fa-desktop text-4xl text-gray-600 mb-3"></i>
            <p className="text-gray-400 text-sm">Select a device to connect</p>
          </div>
        </div>
      )}
      <canvas
        ref={canvasRef}
        className="cursor-crosshair"
        style={{
          display: frame ? 'block' : 'none',
          maxWidth: '100%',
          maxHeight: '100%',
          objectFit: 'contain',
          userSelect: 'none',
          WebkitUserDrag: 'none',
          MozUserDrag: 'none',
          pointerEvents: connected ? 'auto' : 'none',
        }}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        onContextMenu={handleContextMenu}
        draggable={false}
      />
    </div>
  )
}
