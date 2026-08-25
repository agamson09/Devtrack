import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Undo2, Redo2, Pen, Highlighter, ArrowUpRight, Square, Circle, Type, Crop, Trash2, Check, Minus } from 'lucide-react'

const COLORS = [
  { name: 'Red', value: '#ef4444' },
  { name: 'Yellow', value: '#eab308' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'White', value: '#ffffff' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Black', value: '#000000' },
]

const STROKE_WIDTHS = [
  { name: 'Thin', value: 2 },
  { name: 'Medium', value: 4 },
  { name: 'Thick', value: 8 },
]

export default function SnippingEditor({ open, onClose, onSave, imageSrc }) {
  const baseCanvasRef = useRef(null)
  const overlayCanvasRef = useRef(null)
  const containerRef = useRef(null)

  const [tool, setTool] = useState('pen')
  const [color, setColor] = useState('#ef4444')
  const [strokeWidth, setStrokeWidth] = useState(4)
  const [drawing, setDrawing] = useState(false)
  const [startPos, setStartPos] = useState(null)
  const [undoStack, setUndoStack] = useState([])
  const [redoStack, setRedoStack] = useState([])
  const [textInput, setTextInput] = useState(null)
  const [textValue, setTextValue] = useState('')

  const maxUndo = 30

  const getOverlayCtx = useCallback(() => overlayCanvasRef.current?.getContext('2d'), [])

  const saveSnapshot = useCallback(() => {
    const canvas = overlayCanvasRef.current
    if (!canvas) return
    const data = canvas.toDataURL()
    setUndoStack(prev => [...prev.slice(-maxUndo + 1), data])
    setRedoStack([])
  }, [])

  const undo = useCallback(() => {
    setUndoStack(prev => {
      if (prev.length === 0) return prev
      const canvas = overlayCanvasRef.current
      const ctx = canvas?.getContext('2d')
      if (!ctx) return prev
      const current = canvas.toDataURL()
      setRedoStack(r => [...r, current])
      const last = prev[prev.length - 1]
      const img = new Image()
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0)
      }
      img.src = last
      return prev.slice(0, -1)
    })
  }, [])

  const redo = useCallback(() => {
    setRedoStack(prev => {
      if (prev.length === 0) return prev
      const canvas = overlayCanvasRef.current
      const ctx = canvas?.getContext('2d')
      if (!ctx) return prev
      const current = canvas.toDataURL()
      setUndoStack(u => [...u, current])
      const last = prev[prev.length - 1]
      const img = new Image()
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0)
      }
      img.src = last
      return prev.slice(0, -1)
    })
  }, [])

  const clearOverlay = useCallback(() => {
    const canvas = overlayCanvasRef.current
    if (!canvas) return
    saveSnapshot()
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }, [saveSnapshot])

  const getPos = useCallback((e) => {
    const canvas = overlayCanvasRef.current
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    }
  }, [])

  const drawArrow = useCallback((ctx, fromX, fromY, toX, toY, col, sw) => {
    const headLen = 16
    const angle = Math.atan2(toY - fromY, toX - fromX)
    ctx.strokeStyle = col
    ctx.fillStyle = col
    ctx.lineWidth = sw
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(fromX, fromY)
    ctx.lineTo(toX, toY)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(toX, toY)
    ctx.lineTo(toX - headLen * Math.cos(angle - Math.PI / 6), toY - headLen * Math.sin(angle - Math.PI / 6))
    ctx.lineTo(toX - headLen * Math.cos(angle + Math.PI / 6), toY - headLen * Math.sin(angle + Math.PI / 6))
    ctx.closePath()
    ctx.fill()
  }, [])

  const handleMouseDown = useCallback((e) => {
    e.preventDefault()
    const pos = getPos(e)

    if (tool === 'text') {
      setTextInput(pos)
      setTextValue('')
      return
    }

    saveSnapshot()
    setDrawing(true)
    setStartPos(pos)

    if (tool === 'pen' || tool === 'highlighter') {
      const ctx = getOverlayCtx()
      ctx.beginPath()
      ctx.moveTo(pos.x, pos.y)
      ctx.strokeStyle = color
      ctx.lineWidth = tool === 'highlighter' ? strokeWidth * 3 : strokeWidth
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      if (tool === 'highlighter') ctx.globalAlpha = 0.3
      else ctx.globalAlpha = 1
    }
  }, [tool, color, strokeWidth, getPos, getOverlayCtx, saveSnapshot])

  const handleMouseMove = useCallback((e) => {
    if (!drawing) return
    e.preventDefault()
    const pos = getPos(e)
    const ctx = getOverlayCtx()

    if (tool === 'pen' || tool === 'highlighter') {
      ctx.lineTo(pos.x, pos.y)
      ctx.stroke()
    } else if (tool === 'arrow' || tool === 'rectangle' || tool === 'circle') {
      const snapshot = undoStack[undoStack.length - 1]
      if (snapshot) {
        const img = new Image()
        img.onload = () => {
          ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height)
          ctx.drawImage(img, 0, 0)
          ctx.strokeStyle = color
          ctx.lineWidth = strokeWidth
          ctx.lineCap = 'round'
          ctx.lineJoin = 'round'
          ctx.globalAlpha = 1

          if (tool === 'arrow') {
            drawArrow(ctx, startPos.x, startPos.y, pos.x, pos.y, color, strokeWidth)
          } else if (tool === 'rectangle') {
            ctx.strokeRect(startPos.x, startPos.y, pos.x - startPos.x, pos.y - startPos.y)
          } else if (tool === 'circle') {
            const rx = Math.abs(pos.x - startPos.x) / 2
            const ry = Math.abs(pos.y - startPos.y) / 2
            const cx = startPos.x + (pos.x - startPos.x) / 2
            const cy = startPos.y + (pos.y - startPos.y) / 2
            ctx.beginPath()
            ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
            ctx.stroke()
          }
        }
        img.src = snapshot
      }
    }
  }, [drawing, tool, color, strokeWidth, startPos, getPos, getOverlayCtx, undoStack, drawArrow])

  const handleMouseUp = useCallback((e) => {
    if (!drawing) return
    setDrawing(false)
    const ctx = getOverlayCtx()
    if (tool === 'pen' || tool === 'highlighter') {
      ctx.globalAlpha = 1
    }
  }, [drawing, tool, getOverlayCtx])

  const handleCrop = useCallback(() => {
    const overlay = overlayCanvasRef.current
    const base = baseCanvasRef.current
    if (!overlay || !base) return

    const ctx = overlay.getContext('2d')
    const imageData = ctx.getImageData(0, 0, overlay.width, overlay.height)
    let minX = overlay.width, minY = overlay.height, maxX = 0, maxY = 0
    let found = false
    for (let y = 0; y < overlay.height; y++) {
      for (let x = 0; x < overlay.width; x++) {
        const i = (y * overlay.width + x) * 4
        if (imageData.data[i + 3] > 0) {
          found = true
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }
    }
    if (!found) return

    const pad = 10
    minX = Math.max(0, minX - pad)
    minY = Math.max(0, minY - pad)
    maxX = Math.min(overlay.width, maxX + pad)
    maxY = Math.min(overlay.height, maxY + pad)
    const cw = maxX - minX
    const ch = maxY - minY

    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = cw
    tempCanvas.height = ch
    const tempCtx = tempCanvas.getContext('2d')
    tempCtx.drawImage(base, minX, minY, cw, ch, 0, 0, cw, ch)
    tempCtx.drawImage(overlay, minX, minY, cw, ch, 0, 0, cw, ch)

    const baseCtx = base.getContext('2d')
    base.width = cw
    base.height = ch
    baseCtx.drawImage(tempCanvas, 0, 0)

    overlay.width = cw
    overlay.height = ch
    const overlayCtx = overlay.getContext('2d')
    overlayCtx.clearRect(0, 0, cw, ch)

    setUndoStack([])
    setRedoStack([])
  }, [])

  const commitText = useCallback(() => {
    if (!textInput || !textValue.trim()) {
      setTextInput(null)
      return
    }
    const ctx = getOverlayCtx()
    ctx.font = `${strokeWidth * 5}px sans-serif`
    ctx.fillStyle = color
    ctx.globalAlpha = 1
    ctx.fillText(textValue, textInput.x, textInput.y)
    setTextInput(null)
    setTextValue('')
  }, [textInput, textValue, color, strokeWidth, getOverlayCtx])

  const handleSave = useCallback(() => {
    const base = baseCanvasRef.current
    const overlay = overlayCanvasRef.current
    if (!base || !overlay) return

    const merged = document.createElement('canvas')
    merged.width = base.width
    merged.height = base.height
    const ctx = merged.getContext('2d')
    ctx.drawImage(base, 0, 0)
    ctx.drawImage(overlay, 0, 0)

    merged.toBlob((blob) => {
      if (!blob) return
      const file = new File([blob], `snip-${Date.now()}.png`, { type: 'image/png' })
      onSave(file)
    }, 'image/png')
  }, [onSave])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) { e.preventDefault(); redo() }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo() }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, undo, redo])

  useEffect(() => {
    if (!open || !imageSrc) return
    const base = baseCanvasRef.current
    const overlay = overlayCanvasRef.current
    if (!base || !overlay) return
    const img = new Image()
    img.onload = () => {
      base.width = img.width
      base.height = img.height
      overlay.width = img.width
      overlay.height = img.height
      const ctx = base.getContext('2d')
      ctx.drawImage(img, 0, 0)
      setUndoStack([])
      setRedoStack([])
    }
    img.src = imageSrc
  }, [open, imageSrc])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-5xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Snipping Tool</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-4 py-2 border-b border-gray-700 flex items-center gap-1 flex-wrap">
          {[
            { id: 'pen', icon: Pen, label: 'Pen' },
            { id: 'highlighter', icon: Highlighter, label: 'Highlight' },
            { id: 'arrow', icon: ArrowUpRight, label: 'Arrow' },
            { id: 'rectangle', icon: Square, label: 'Rectangle' },
            { id: 'circle', icon: Circle, label: 'Circle' },
            { id: 'text', icon: Type, label: 'Text' },
          ].map(t => (
            <button key={t.id} onClick={() => setTool(t.id)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${tool === t.id ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
              title={t.label}>
              <t.icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}

          <div className="w-px h-6 bg-gray-600 mx-1" />

          {COLORS.map(c => (
            <button key={c.value} onClick={() => setColor(c.value)}
              className={`w-6 h-6 rounded-full border-2 transition-transform ${color === c.value ? 'border-white scale-110' : 'border-gray-600 hover:scale-105'}`}
              style={{ backgroundColor: c.value }} title={c.name} />
          ))}

          <div className="w-px h-6 bg-gray-600 mx-1" />

          {STROKE_WIDTHS.map(s => (
            <button key={s.value} onClick={() => setStrokeWidth(s.value)}
              className={`flex items-center justify-center w-7 h-7 rounded-lg transition-colors ${strokeWidth === s.value ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
              title={s.name}>
              <div className="rounded-full bg-current" style={{ width: s.value + 2, height: s.value + 2 }} />
            </button>
          ))}

          <div className="w-px h-6 bg-gray-600 mx-1" />

          <button onClick={undo} className="p-1.5 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors" title="Undo (Ctrl+Z)">
            <Undo2 className="w-4 h-4" />
          </button>
          <button onClick={redo} className="p-1.5 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors" title="Redo (Ctrl+Shift+Z)">
            <Redo2 className="w-4 h-4" />
          </button>
          <button onClick={handleCrop} className="p-1.5 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors" title="Crop to drawing">
            <Crop className="w-4 h-4" />
          </button>
          <button onClick={clearOverlay} className="p-1.5 rounded-lg bg-gray-700 text-gray-300 hover:bg-red-600/30 hover:text-red-400 transition-colors" title="Clear all drawings">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        <div ref={containerRef} className="flex-1 overflow-auto relative flex items-center justify-center p-4 bg-gray-950">
          <div className="relative inline-block">
            <canvas ref={baseCanvasRef} className="block max-w-full max-h-[60vh]" style={{ imageRendering: 'auto' }} />
            <canvas ref={overlayCanvasRef}
              className="absolute top-0 left-0 w-full h-full cursor-crosshair"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleMouseDown}
              onTouchMove={handleMouseMove}
              onTouchEnd={handleMouseUp}
            />
            {textInput && (
              <div className="absolute z-10" style={{ left: `${(textInput.x / overlayCanvasRef.current?.width || 1) * 100}%`, top: `${(textInput.y / overlayCanvasRef.current?.height || 1) * 100}%` }}>
                <input autoFocus value={textValue} onChange={e => setTextValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') commitText(); if (e.key === 'Escape') setTextInput(null) }}
                  onBlur={commitText}
                  className="bg-black/70 border border-white/30 rounded px-2 py-1 text-white text-sm outline-none min-w-[120px]"
                  placeholder="Type text..." />
              </div>
            )}
          </div>
        </div>

        <div className="px-4 py-3 border-t border-gray-700 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">Cancel</button>
          <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm transition-colors">
            <Check className="w-4 h-4" /> Save & Attach
          </button>
        </div>
      </div>
    </div>
  )
}
