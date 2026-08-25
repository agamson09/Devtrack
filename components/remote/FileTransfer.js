import { useState, useRef } from 'react'

export default function FileTransfer({ deviceId, connected }) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [filename, setFilename] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef(null)

  const handleFile = async (file) => {
    if (!file || !connected) return
    setUploading(true)
    setFilename(file.name)
    setProgress(0)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/remote/transfer', {
        method: 'POST',
        body: formData
      })
      const data = await res.json()

      if (data.success) {
        const socket = window.__remoteSocket
        if (socket) {
          socket.emit('remote:file-upload', {
            deviceId,
            filename: data.filename,
            data: data.data
          })
        }
        setProgress(100)
        setTimeout(() => {
          setUploading(false)
          setProgress(0)
          setFilename('')
        }, 2000)
      }
    } catch (err) {
      console.error('File transfer error:', err)
      setUploading(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    handleFile(file)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => {
    setDragOver(false)
  }

  if (!connected) return null

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
        dragOver ? 'border-indigo-500 bg-indigo-500/10' : 'border-gray-600'
      }`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(e) => handleFile(e.target.files[0])}
      />

      {uploading ? (
        <div>
          <i className="fa-solid fa-cloud-upload-alt text-2xl text-indigo-400 mb-2"></i>
          <p className="text-white text-sm">{filename}</p>
          <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
            <div
              className="bg-indigo-500 h-2 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <p className="text-gray-400 text-xs mt-1">{progress}%</p>
        </div>
      ) : (
        <div onClick={() => fileInputRef.current?.click()} className="cursor-pointer">
          <i className="fa-solid fa-cloud-upload-alt text-2xl text-gray-500 mb-2"></i>
          <p className="text-gray-400 text-sm">Drop file here or click to upload</p>
          <p className="text-gray-500 text-xs mt-1">Max 100MB</p>
        </div>
      )}
    </div>
  )
}
