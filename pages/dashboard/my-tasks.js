import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/layout/Layout';
import { useAuth } from '@/components/AuthContext';
import { StatusBadge, PriorityBadge } from '@/components/common/Badge';
import { ClipboardList, FolderOpen, Calendar, Clock, Download } from 'lucide-react';

export default function MyTasksPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    fetchTasks();
  }, [statusFilter]);

  async function fetchTasks() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      const res = await fetch(`/api/tasks/my?${params.toString()}`);
      const data = await res.json();
      setTasks(data.tasks || []);
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    } finally {
      setLoading(false);
    }
  }

  const statusCounts = tasks.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <Layout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center shrink-0">
              <ClipboardList className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold gradient-text">My Tasks</h1>
              <p className="text-gray-400 mt-0.5 text-sm">{tasks.length} tugas ditugaskan ke Anda</p>
            </div>
          </div>
          <button
            onClick={() => window.open('/api/export/tasks?mine=1', '_blank')}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>

        {/* Status summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { key: '', label: 'All', dot: 'bg-indigo-400', count: tasks.length },
            { key: 'in_progress', label: 'In Progress', dot: 'bg-amber-400', count: statusCounts.in_progress || 0 },
            { key: 'review', label: 'Review', dot: 'bg-purple-400', count: statusCounts.review || 0 },
            { key: 'todo', label: 'To Do', dot: 'bg-gray-400', count: statusCounts.todo || 0 },
          ].map((s) => (
            <button
              key={s.key}
              onClick={() => setStatusFilter(s.key)}
              className={`card p-3 text-left !py-3 transition-all duration-200 active:scale-[0.98] ${
                statusFilter === s.key
                  ? '!bg-indigo-500/15 border-indigo-500/50'
                  : 'hover:border-gray-600 hover:bg-gray-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-300 flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                  {s.label}
                </span>
                <span className={`text-lg font-bold ${statusFilter === s.key ? 'text-indigo-300' : 'text-white'}`}>
                  {s.count}
                </span>
              </div>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="card space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="skeleton h-4 flex-1" />
                <div className="skeleton h-4 w-24" />
                <div className="skeleton h-5 w-16 rounded-full" />
                <div className="skeleton h-4 w-20 hidden md:block" />
              </div>
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-gray-800/60 border border-gray-700/70 flex items-center justify-center mx-auto mb-4">
              <ClipboardList className="w-7 h-7 text-gray-500" />
            </div>
            <p className="text-gray-300 font-medium mb-1">Tidak ada task</p>
            <p className="text-gray-500 text-sm">
              {statusFilter ? `Tidak ada task berstatus "${statusFilter.replace('_', ' ')}"` : 'Belum ada task yang ditugaskan ke Anda'}
            </p>
          </div>
        ) : (
          <div className="card !p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700/70 bg-gray-800/40">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Task</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Project</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Status</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Priority</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Deadline</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Module</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => (
                    <tr
                      key={task.id}
                      onClick={() => router.push(`/task/${task.id}`)}
                      className="border-b border-gray-700/50 hover:bg-gray-700/50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium text-sm">{task.title}</span>
                          {task.labels && task.labels.length > 0 && (
                            <div className="flex gap-1">
                              {task.labels.map(l => (
                                <span key={l.id} className="px-1.5 py-0.5 rounded text-[10px] font-medium text-white" style={{ backgroundColor: l.color }}>{l.name}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5 text-sm text-gray-400">
                          <FolderOpen className="w-3.5 h-3.5" />
                          {task.project_name || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={task.status} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <PriorityBadge priority={task.priority} />
                      </td>
                      <td className="px-4 py-3">
                        {task.deadline ? (
                          <span className={`flex items-center gap-1.5 text-sm ${(() => { const ds = (task.deadline || '').split('T')[0].split(' ')[0]; const d = ds ? new Date(ds + 'T00:00:00') : null; return d && d < new Date() && task.status !== 'done' ? 'text-red-400' : 'text-gray-400' })()}`}>
                            <Calendar className="w-3.5 h-3.5" />
                            {(() => { const ds = (task.deadline || '').split('T')[0].split(' ')[0]; return ds ? new Date(ds + 'T00:00:00').toLocaleDateString('id-ID') : '' })()}
                          </span>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {task.module ? (
                          <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded">{task.module}</span>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
