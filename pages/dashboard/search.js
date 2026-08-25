import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/layout/Layout';
import { StatusBadge, PriorityBadge } from '@/components/common/Badge';
import { Search, FolderOpen, ClipboardCheck, BookOpen } from 'lucide-react';

export default function SearchPage() {
  const router = useRouter();
  const { q } = router.query;
  const [results, setResults] = useState({ tasks: [], projects: [], notes: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (q) {
      doSearch(q);
    }
  }, [q]);

  async function doSearch(query) {
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults(data);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-6">
          <Search className="w-6 h-6 text-indigo-400" />
          <h1 className="text-2xl font-bold text-white">
            Search Results{q ? ` for "${q}"` : ''}
          </h1>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-gray-400 mt-3 text-sm">Searching...</p>
          </div>
        ) : (
          <>
            {results.projects.length === 0 && results.tasks.length === 0 && results.notes.length === 0 ? (
              <div className="text-center py-12">
                <Search className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">
                  {q ? `No results found for "${q}"` : 'Type something to search'}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {results.projects.length > 0 && (
                  <div>
                    <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3 flex items-center gap-2">
                      <FolderOpen className="w-4 h-4" />
                      Projects ({results.projects.length})
                    </h2>
                    <div className="space-y-2">
                      {results.projects.map((project) => (
                        <div
                          key={project.id}
                          onClick={() => router.push(`/dashboard/projects/${project.id}`)}
                          className="bg-gray-800 border border-gray-700 rounded-lg p-4 cursor-pointer hover:border-indigo-500 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <h3 className="text-white font-medium">{project.name}</h3>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              project.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' :
                              project.status === 'completed' ? 'bg-blue-500/20 text-blue-400' :
                              'bg-gray-600 text-gray-300'
                            }`}>
                              {project.status}
                            </span>
                          </div>
                          {project.description && (
                            <p className="text-gray-400 text-sm mt-1 line-clamp-2">{project.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {results.notes.length > 0 && (
                  <div>
                    <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3 flex items-center gap-2">
                      <BookOpen className="w-4 h-4" />
                      Wiki ({results.notes.length})
                    </h2>
                    <div className="space-y-2">
                      {results.notes.map((note) => (
                        <div
                          key={note.id}
                          onClick={() => router.push(`/dashboard/wiki?note=${note.id}`)}
                          className="bg-gray-800 border border-gray-700 rounded-lg p-4 cursor-pointer hover:border-indigo-500 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <h3 className="text-white font-medium flex items-center gap-2">
                              <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                              {note.title}
                            </h3>
                            {(note.tags || '') && (
                              <div className="flex gap-1">
                                {note.tags.split(',').filter(Boolean).slice(0, 3).map(t => (
                                  <span key={t} className="text-[10px] text-indigo-300/80 bg-indigo-500/10 px-1.5 py-0.5 rounded-full">#{t.trim()}</span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                            {note.project_name && (
                              <span className="flex items-center gap-1">
                                <FolderOpen className="w-3 h-3" />
                                {note.project_name}
                              </span>
                            )}
                            {note.updated_at && <span>diubah {new Date(note.updated_at).toLocaleDateString('id-ID')}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {results.tasks.length > 0 && (
                  <div>
                    <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3 flex items-center gap-2">
                      <ClipboardCheck className="w-4 h-4" />
                      Tasks ({results.tasks.length})
                    </h2>
                    <div className="space-y-2">
                      {results.tasks.map((task) => (
                        <div
                          key={task.id}
                          onClick={() => router.push(`/task/${task.id}`)}
                          className="bg-gray-800 border border-gray-700 rounded-lg p-4 cursor-pointer hover:border-indigo-500 transition-colors"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <h3 className="text-white font-medium">{task.title}</h3>
                            <div className="flex items-center gap-2">
                              <StatusBadge status={task.status} />
                              <PriorityBadge priority={task.priority} />
                            </div>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-400">
                            {task.project_name && (
                              <span className="flex items-center gap-1">
                                <FolderOpen className="w-3 h-3" />
                                {task.project_name}
                              </span>
                            )}
                            {task.assignee_name && (
                              <span>Assigned to: {task.assignee_name}</span>
                            )}
                            {task.module && (
                              <span className="bg-gray-700 px-1.5 py-0.5 rounded">{task.module}</span>
                            )}
                            {task.deadline && (
                              <span>Due: {(() => { const ds = (task.deadline || '').split('T')[0].split(' ')[0]; return ds ? new Date(ds + 'T00:00:00').toLocaleDateString() : '' })()}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
