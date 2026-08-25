import { useState, useEffect } from 'react'

export default function DiffViewer({ file, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [viewMode, setViewMode] = useState('split')

  useEffect(() => {
    if (!file) return
    setLoading(true)
    setError(null)
    fetch(`/api/deploy/file-diff?file=${encodeURIComponent(file)}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error)
        else setData(d)
      })
      .catch(e => setError('Failed to load diff'))
      .finally(() => setLoading(false))
  }, [file])

  if (!file) return null

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-6xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <div className="flex items-center gap-3 min-w-0">
            <i className="fa-solid fa-code text-indigo-400"></i>
            <h3 className="text-sm font-mono text-white truncate">{file}</h3>
            {data && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-green-400">+{data.diff?.stats?.additions || 0}</span>
                <span className="text-red-400">-{data.diff?.stats?.deletions || 0}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-gray-800 rounded-lg p-0.5">
              <button onClick={() => setViewMode('split')} className={`px-3 py-1 rounded text-xs font-medium transition-colors ${viewMode === 'split' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                Split
              </button>
              <button onClick={() => setViewMode('unified')} className={`px-3 py-1 rounded text-xs font-medium transition-colors ${viewMode === 'unified' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                Unified
              </button>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white ml-2">
              <i className="fa-solid fa-xmark text-lg"></i>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto font-mono text-xs">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-red-400">{error}</p>
            </div>
          ) : data ? (
            viewMode === 'unified' ? (
              <UnifiedView diff={data.diff} />
            ) : (
              <SplitView data={data} />
            )
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-gray-700 text-xs text-gray-500">
          <div className="flex gap-4">
            <span>DEV: {data?.dev?.modified ? new Date(data.dev.modified).toLocaleString() : 'N/A'}</span>
            <span>PROD: {data?.prod?.modified ? new Date(data.prod.modified).toLocaleString() : 'N/A'}</span>
          </div>
          <span>{data?.prod?.exists ? `${data.prod.size} bytes` : 'File not in prod'}</span>
        </div>
      </div>
    </div>
  )
}

function SplitView({ data }) {
  const devLines = (data.dev.content || '').split('\n')
  const prodLines = (data.prod.content || '').split('\n')
  const hunks = data.diff?.hunks || []

  if (hunks.length === 0 && devLines.length === prodLines.length) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Files are identical</p>
      </div>
    )
  }

  const allLines = []
  let devLine = 1
  let prodLine = 1

  if (hunks.length > 0) {
    for (const hunk of hunks) {
      for (const line of hunk.lines) {
        if (line.startsWith('+')) {
          allLines.push({ type: 'add', content: line.slice(1), devLine: null, prodLine: prodLine++ })
        } else if (line.startsWith('-')) {
          allLines.push({ type: 'del', content: line.slice(1), devLine: devLine++, prodLine: null })
        } else if (line.startsWith(' ')) {
          allLines.push({ type: 'same', content: line.slice(1), devLine: devLine++, prodLine: prodLine++ })
        } else if (line.startsWith('\\')) {
          allLines.push({ type: 'info', content: line, devLine: null, prodLine: null })
        }
      }
    }
  }

  return (
    <div className="p-0">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-800 sticky top-0">
            <th className="w-12 px-2 py-1 text-right text-gray-500 font-normal border-r border-gray-700">Line</th>
            <th className="w-12 px-2 py-1 text-right text-gray-500 font-normal border-r border-gray-700">Line</th>
            <th className="px-3 py-1 text-left text-gray-400 font-normal">Code</th>
          </tr>
        </thead>
        <tbody>
          {allLines.length > 0 ? allLines.map((line, i) => (
            <tr key={i} className={`${line.type === 'add' ? 'bg-green-900/30' : line.type === 'del' ? 'bg-red-900/30' : ''} hover:bg-gray-800/50`}>
              <td className="px-2 py-0.5 text-right text-gray-600 border-r border-gray-800 select-none">{line.prodLine || ''}</td>
              <td className="px-2 py-0.5 text-right text-gray-600 border-r border-gray-800 select-none">{line.devLine || ''}</td>
              <td className="px-3 py-0.5 whitespace-pre overflow-x-auto">
                <span className={`${line.type === 'add' ? 'text-green-400' : line.type === 'del' ? 'text-red-400' : line.type === 'info' ? 'text-gray-500 italic' : 'text-gray-300'}`}>
                  {line.type === 'add' ? '+ ' : line.type === 'del' ? '- ' : '  '}
                </span>
                <span className={`${line.type === 'add' ? 'text-green-300' : line.type === 'del' ? 'text-red-300' : 'text-gray-300'}`}>
                  {line.content}
                </span>
              </td>
            </tr>
          )) : (
            <tr>
              <td colSpan="3" className="px-4 py-8 text-center text-gray-500">
                {data.dev.content === data.prod.content ? 'Files are identical' : 'Unable to compute diff'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function UnifiedView({ diff }) {
  const hunks = diff?.hunks || []

  if (hunks.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Files are identical</p>
      </div>
    )
  }

  return (
    <div className="p-0">
      {hunks.map((hunk, hi) => (
        <div key={hi}>
          <div className="bg-gray-800/80 px-4 py-1 text-gray-400 text-xs border-b border-gray-700">
            @@ -{hunk.oldStart},{hunk.oldCount} +{hunk.newStart},{hunk.newCount} @@
          </div>
          {hunk.lines.map((line, li) => (
            <div key={`${hi}-${li}`} className={`px-4 py-0.5 whitespace-pre overflow-x-auto ${
              line.startsWith('+') && !line.startsWith('+++') ? 'bg-green-900/30' :
              line.startsWith('-') && !line.startsWith('---') ? 'bg-red-900/30' : ''
            }`}>
              <span className={`${
                line.startsWith('+') && !line.startsWith('+++') ? 'text-green-400' :
                line.startsWith('-') && !line.startsWith('---') ? 'text-red-400' :
                line.startsWith('@@') ? 'text-indigo-400' : 'text-gray-500'
              } select-none`}>
                {line.startsWith('+') ? '+ ' : line.startsWith('-') ? '- ' : line.startsWith('@@') ? '' : '  '}
              </span>
              <span className={`${
                line.startsWith('+') && !line.startsWith('+++') ? 'text-green-300' :
                line.startsWith('-') && !line.startsWith('---') ? 'text-red-300' :
                'text-gray-300'
              }`}>
                {line.startsWith('+') ? line.slice(1) : line.startsWith('-') ? line.slice(1) : line.startsWith('@@') ? line : line}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
