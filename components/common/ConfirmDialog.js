import { AlertTriangle } from 'lucide-react'

export default function ConfirmDialog({ isOpen, onClose, onConfirm, title, message, confirmText = 'Delete', confirmColor = 'bg-red-600 hover:bg-red-700', icon }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-gray-800 rounded-2xl border border-gray-700 shadow-2xl">
        <div className="p-6 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
            {icon || <AlertTriangle className="w-6 h-6 text-red-400" />}
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
          <p className="text-sm text-gray-400">{message}</p>
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-gray-400 hover:text-white bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={() => { onConfirm(); onClose(); }}
            className={`flex-1 px-4 py-2.5 text-white rounded-lg transition-colors text-sm font-medium ${confirmColor}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
