import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/layout/Layout';
import { useAuth } from '@/components/AuthContext';
import Loading from '@/components/common/Loading';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ClipboardCheck, Play, CheckCircle, AlertTriangle, Users, FolderOpen, Calendar, Activity, SlidersHorizontal, Eye, EyeOff, ChevronUp, ChevronDown, RotateCcw } from 'lucide-react';
import FileActivityWidget from '@/components/dashboard/FileActivityWidget';
import ModuleProgressWidget from '@/components/dashboard/ModuleProgressWidget';
import DeployStatusWidget from '@/components/dashboard/DeployStatusWidget';
import SecurityOverviewWidget from '@/components/dashboard/SecurityOverviewWidget';

const STATUS_COLORS = {
  todo: '#6366f1',
  in_progress: '#f59e0b',
  review: '#8b5cf6',
  done: '#10b981',
};

// Widget registry — drives the customize panel. Bands keep related widgets
// on the same grid row; ordering is applied within a band.
const BANDS = [
  { id: 'band-stats', label: 'Statistik', items: [{ id: 'stat-cards', label: 'Kartu Statistik' }] },
  {
    id: 'band-charts',
    label: 'Grafik & Beban Kerja',
    items: [
      { id: 'status-chart', label: 'Tasks by Status' },
      { id: 'member-workload', label: 'Member Workload' },
    ],
  },
  {
    id: 'band-overview',
    label: 'Ikhtisar & Aktivitas',
    items: [
      { id: 'projects-overview', label: 'Projects Overview' },
      { id: 'recent-activity', label: 'Recent Activity' },
    ],
  },
  {
    id: 'band-tasks',
    label: 'Deadline & Velocity',
    items: [
      { id: 'overdue-tasks', label: 'Overdue Tasks' },
      { id: 'weekly-velocity', label: 'Weekly Velocity' },
    ],
  },
  {
    id: 'band-sftp',
    label: 'Operasional Server',
    items: [
      { id: 'file-activity', label: 'File Activity' },
      { id: 'module-progress', label: 'Module Progress' },
      { id: 'deploy-status', label: 'Deploy Status' },
    ],
  },
  {
    id: 'band-security',
    label: 'Keamanan (khusus Admin)',
    adminOnly: true,
    items: [{ id: 'security-overview', label: 'Security Overview' }],
  },
];

const DEFAULT_LAYOUT = { hidden: [], orders: {} };

const GRID_COLS_2 = 'grid grid-cols-1 lg:grid-cols-2 gap-6';
const GRID_COLS_3 = 'grid grid-cols-1 lg:grid-cols-3 gap-6';

function StatCard({ icon: Icon, label, value, color, delay = 0 }) {
  return (
    <div
      className="group bg-gray-800/60 backdrop-blur-sm rounded-xl p-6 border border-gray-700/70 transition-all duration-300 ease-out-expo hover:border-gray-600 hover:shadow-card-hover hover:-translate-y-1 animate-fade-in-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-xl ${color} shadow-lg transition-transform duration-300 group-hover:scale-110`}>
          <Icon className="w-6 h-6 text-white drop-shadow" />
        </div>
        <div>
          <p className="text-sm text-gray-400">{label}</p>
          <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
        </div>
      </div>
    </div>
  );
}

function MemberWorkloadRow({ member }) {
  return (
    <tr className="border-b border-gray-700/60 transition-colors hover:bg-gray-700/30">
      <td className="py-3 px-4 text-white font-medium">{member.name}</td>
      <td className="py-3 px-4 text-center">
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 text-sm font-semibold">
          {member.todo}
        </span>
      </td>
      <td className="py-3 px-4 text-center">
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 text-sm font-semibold">
          {member.in_progress}
        </span>
      </td>
      <td className="py-3 px-4 text-center">
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-purple-500/20 text-purple-400 text-sm font-semibold">
          {member.review}
        </span>
      </td>
      <td className="py-3 px-4 text-center">
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 text-sm font-semibold">
          {member.done}
        </span>
      </td>
      <td className="py-3 px-4 text-center">
        <span className="text-white font-bold">{member.todo + member.in_progress + member.review + member.done}</span>
      </td>
    </tr>
  );
}

function ActivityItem({ activity }) {
  const timeAgo = getTimeAgo(activity.created_at);
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-700/60 last:border-b-0">
      <div className="relative flex flex-col items-center flex-shrink-0 pt-1.5">
        <span className="w-2 h-2 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 shadow-glow" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-300 leading-relaxed">
          <span className="text-white font-medium">{activity.user_name}</span>{' '}
          {activity.action}
          {activity.task_title && (
            <span className="text-indigo-400"> &quot;{activity.task_title}&quot;</span>
          )}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">{timeAgo}</p>
      </div>
    </div>
  );
}

function getTimeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now - date) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 5) return 'Working late';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  // Dashboard customization
  const [layout, setLayout] = useState(DEFAULT_LAYOUT);
  const [showCustomize, setShowCustomize] = useState(false);
  const [draft, setDraft] = useState(DEFAULT_LAYOUT); // edited inside the panel
  const [savingLayout, setSavingLayout] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const [statsRes, activityRes, layoutRes] = await Promise.all([
          fetch('/api/dashboard/stats'),
          fetch('/api/dashboard/activity'),
          fetch('/api/dashboard/layout').catch(() => null),
        ]);
        const statsData = await statsRes.json();
        const activityData = await activityRes.json();
        setStats(statsData);
        setActivities(activityData.activities || []);
        if (layoutRes && layoutRes.ok) {
          const ld = await layoutRes.json();
          if (ld.layout) setLayout(ld.layout);
        }
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Ordered + filtered items of a band according to the active layout
  function bandItems(band, lay = layout) {
    let items = [...band.items];
    const ord = lay.orders?.[band.id];
    if (ord) items.sort((a, b) => ord.indexOf(a.id) - ord.indexOf(b.id));
    return items.filter((it) => !(lay.hidden || []).includes(it.id));
  }

  async function saveLayout(newDraft) {
    setSavingLayout(true);
    try {
      const res = await fetch('/api/dashboard/layout', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hidden: newDraft.hidden, orders: newDraft.orders }),
      });
      if (res.ok) {
        const d = await res.json();
        setLayout(d.layout && (d.layout.hidden?.length || Object.keys(d.layout.orders || {}).length)
          ? d.layout
          : DEFAULT_LAYOUT);
        setShowCustomize(false);
      }
    } catch (err) {
      console.error('Failed to save layout:', err);
    } finally {
      setSavingLayout(false);
    }
  }

  function openCustomize() {
    setDraft(JSON.parse(JSON.stringify(layout)));
    setShowCustomize(true);
  }

  // Draft helpers for the customize panel
  function toggleItem(id) {
    setDraft((d) => ({
      ...d,
      hidden: d.hidden.includes(id) ? d.hidden.filter((x) => x !== id) : [...d.hidden, id],
    }));
  }

  function moveWithinBand(bandId, itemId, dir) {
    setDraft((d) => {
      const band = BANDS.find((b) => b.id === bandId);
      const current = [...band.items].map((it) => it.id);
      const ord = d.orders?.[bandId] ? [...new Set([...d.orders[bandId], ...current])] : current;
      const idx = ord.indexOf(itemId);
      const swapWith = idx + dir;
      if (swapWith < 0 || swapWith >= ord.length) return d;
      [ord[idx], ord[swapWith]] = [ord[swapWith], ord[idx]];
      return { ...d, orders: { ...d.orders, [bandId]: ord } };
    });
  }

  const chartData = stats
    ? [
        { name: 'Todo', value: stats.todo || 0, fill: STATUS_COLORS.todo },
        { name: 'In Progress', value: stats.inProgress || 0, fill: STATUS_COLORS.in_progress },
        { name: 'Review', value: stats.review || 0, fill: STATUS_COLORS.review },
        { name: 'Done', value: stats.done || 0, fill: STATUS_COLORS.done },
      ]
    : [];

  const visBands = BANDS.filter((b) => !b.adminOnly || user?.role === 'admin');
  const isCustomized =
    (layout.hidden || []).length > 0 || Object.keys(layout.orders || {}).length > 0;

  return (
    <Layout>
      <div className="p-4 sm:p-6 space-y-6">
        <div className="animate-fade-in-up flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold gradient-text">{getGreeting()}, {user?.name?.split(' ')[0]}</h1>
            <p className="text-gray-400 mt-1">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              {' '}· Here&apos;s what&apos;s happening across your workspace
            </p>
          </div>
          <button
            onClick={openCustomize}
            className={`btn-secondary flex items-center gap-2 text-sm ${isCustomized ? '!border-indigo-500/50 !text-indigo-300' : ''}`}
            title="Atur widget dashboard"
          >
            <SlidersHorizontal className="w-4 h-4" />
            Kustomisasi
            {isCustomized && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />}
          </button>
        </div>

        {/* Band: stat cards */}
        {bandItems(BANDS[0]).length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {bandItems(BANDS[0]).some((it) => it.id === 'stat-cards') && (
              <>
                <StatCard icon={ClipboardCheck} label="Total Tasks" value={stats?.totalTasks || 0} color="bg-gradient-to-br from-gray-500 to-gray-600" delay={0} />
                <StatCard icon={Play} label="In Progress" value={stats?.inProgress || 0} color="bg-gradient-to-br from-amber-400 to-amber-600" delay={60} />
                <StatCard icon={CheckCircle} label="Completed" value={stats?.done || 0} color="bg-gradient-to-br from-emerald-400 to-emerald-600" delay={120} />
                <StatCard icon={AlertTriangle} label="Overdue" value={stats?.overdue || 0} color="bg-gradient-to-br from-red-400 to-red-600" delay={180} />
              </>
            )}
          </div>
        )}

        {/* Band: charts */}
        {bandItems(BANDS[1]).length > 0 && (
          <div className={`${GRID_COLS_2} ${bandItems(BANDS[1]).length === 1 ? 'lg:!grid-cols-1' : ''}`}>
            {bandItems(BANDS[1]).some((it) => it.id === 'status-chart') && (
              <div className="card animate-fade-in-up">
                <h2 className="text-lg font-semibold text-white mb-4">Tasks by Status</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
                    <YAxis stroke="#9ca3af" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1f2937',
                        border: '1px solid #374151',
                        borderRadius: '8px',
                        color: '#fff',
                      }}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <rect key={index} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            {bandItems(BANDS[1]).some((it) => it.id === 'member-workload') && (
              <div className="card animate-fade-in-up">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="w-5 h-5 text-indigo-400" />
                  <h2 className="text-lg font-semibold text-white">Member Workload</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700 text-gray-400">
                        <th className="text-left py-2 px-4">Member</th>
                        <th className="text-center py-2 px-2">Todo</th>
                        <th className="text-center py-2 px-2">In Progress</th>
                        <th className="text-center py-2 px-2">Review</th>
                        <th className="text-center py-2 px-2">Done</th>
                        <th className="text-center py-2 px-2">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(stats?.memberStats || []).map((member) => (
                        <MemberWorkloadRow key={member.name} member={member} />
                      ))}
                      {(!stats?.memberStats || stats.memberStats.length === 0) && (
                        <tr>
                          <td colSpan={6} className="py-4 text-center text-gray-500">
                            No member data available
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Band: overview + activity */}
        {bandItems(BANDS[2]).length > 0 && (
          <div className={bandItems(BANDS[2]).length === 1 ? 'grid grid-cols-1 gap-6' : GRID_COLS_3}>
            {bandItems(BANDS[2]).some((it) => it.id === 'projects-overview') && (
              <div className={`bg-gray-800 rounded-xl p-6 border border-gray-700 ${bandItems(BANDS[2]).length === 1 ? '' : 'lg:col-span-2'}`}>
                <div className="flex items-center gap-2 mb-4">
                  <FolderOpen className="w-5 h-5 text-indigo-400" />
                  <h2 className="text-lg font-semibold text-white">
                    Projects Overview
                  </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-700/50 rounded-lg p-4">
                    <p className="text-sm text-gray-400">Total Projects</p>
                    <p className="text-3xl font-bold text-white">{stats?.totalProjects || 0}</p>
                  </div>
                  <div className="bg-gray-700/50 rounded-lg p-4">
                    <p className="text-sm text-gray-400">Active Tasks</p>
                    <p className="text-3xl font-bold text-white">
                      {(stats?.inProgress || 0) + (stats?.review || 0)}
                    </p>
                  </div>
                </div>
              </div>
            )}
            {bandItems(BANDS[2]).some((it) => it.id === 'recent-activity') && (
              <div className="card animate-fade-in-up">
                <h2 className="text-lg font-semibold text-white mb-4">Recent Activity</h2>
                <div className="max-h-80 overflow-y-auto">
                  {activities.length > 0 ? (
                    activities.map((activity) => (
                      <ActivityItem key={activity.id} activity={activity} />
                    ))
                  ) : (
                    <p className="text-gray-500 text-sm text-center py-4">No recent activity</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Band: overdue + velocity */}
        {bandItems(BANDS[3]).length > 0 && (
          <div className={`${GRID_COLS_2} ${bandItems(BANDS[3]).length === 1 ? 'lg:!grid-cols-1' : ''}`}>
            {bandItems(BANDS[3]).some((it) => it.id === 'overdue-tasks') && (
              <div className="card animate-fade-in-up">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                  <h2 className="text-lg font-semibold text-white">Overdue Tasks</h2>
                  {stats?.overdue > 0 && (
                    <span className="bg-red-500/20 text-red-400 text-xs font-bold px-2 py-0.5 rounded-full">
                      {stats.overdue}
                    </span>
                  )}
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {stats?.overdueTasks?.length > 0 ? (
                    stats.overdueTasks.map((task) => (
                      <div
                        key={task.id}
                        onClick={() => router.push(`/task/${task.id}`)}
                        className="flex items-center justify-between py-2.5 border-b border-gray-700/50 last:border-0 cursor-pointer hover:bg-gray-700/40 px-2 -mx-2 rounded-lg transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white font-medium truncate">{task.title}</p>
                          <p className="text-xs text-gray-400">
                            {task.project_name && <span>{task.project_name}</span>}
                            {task.assignee_name && <span> · {task.assignee_name}</span>}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-red-400 ml-3">
                          <Calendar className="w-3.5 h-3.5" />
                          {(() => { const ds = (task.deadline || '').split('T')[0].split(' ')[0]; return ds ? new Date(ds + 'T00:00:00').toLocaleDateString('id-ID') : '' })()}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6">
                      <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                      <p className="text-gray-500 text-sm">No overdue tasks</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            {bandItems(BANDS[3]).some((it) => it.id === 'weekly-velocity') && (
              <div className="card animate-fade-in-up">
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="w-5 h-5 text-indigo-400" />
                  <h2 className="text-lg font-semibold text-white">Weekly Velocity</h2>
                </div>
                {stats?.weeklyVelocity?.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={stats.weeklyVelocity}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="week" stroke="#9ca3af" fontSize={12} />
                      <YAxis stroke="#9ca3af" fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1f2937',
                          border: '1px solid #374151',
                          borderRadius: '8px',
                          color: '#fff',
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="completed"
                        stroke="#6366f1"
                        strokeWidth={2}
                        dot={{ fill: '#6366f1', strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-64">
                    <p className="text-gray-500 text-sm">No velocity data yet</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Band: operational widgets */}
        {bandItems(BANDS[4]).length > 0 && (
          <div className={bandItems(BANDS[4]).length === 1 ? 'grid grid-cols-1 gap-6' : GRID_COLS_3}>
            {bandItems(BANDS[4]).some((it) => it.id === 'file-activity') && <FileActivityWidget />}
            {bandItems(BANDS[4]).some((it) => it.id === 'module-progress') && <ModuleProgressWidget />}
            {bandItems(BANDS[4]).some((it) => it.id === 'deploy-status') && <DeployStatusWidget />}
          </div>
        )}

        {/* Band: security (admin only) */}
        {user?.role === 'admin' && bandItems(BANDS[5]).length > 0 && (
          <SecurityOverviewWidget user={user} />
        )}

        {/* Customize panel */}
        {showCustomize && (
          <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowCustomize(false)}>
            <div className="glass-panel w-full max-w-md max-h-[80vh] flex flex-col animate-scale-in" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700/70">
                <div>
                  <h3 className="text-white font-bold">Kustomisasi Dashboard</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Pilih widget yang tampil & urutannya</p>
                </div>
                <button onClick={() => setShowCustomize(false)} className="text-gray-400 hover:text-white transition-colors">
                  <i className="fa-solid fa-xmark text-lg"></i>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
                {visBands.map((band) => {
                  const ids = band.items.map((it) => it.id);
                  const ord = draft.orders?.[band.id]
                    ? [...new Set([...draft.orders[band.id], ...ids])]
                    : ids;
                  return (
                    <div key={band.id}>
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-500 mb-2">{band.label}</p>
                      <div className="space-y-1.5">
                        {ord.map((id, i) => {
                          const item = band.items.find((it) => it.id === id);
                          const shown = !(draft.hidden || []).includes(id);
                          return (
                            <div key={id} className={`flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors ${shown ? 'border-gray-700 bg-gray-800/50' : 'border-gray-800 bg-gray-900/40 opacity-55'}`}>
                              <button onClick={() => toggleItem(id)} className="text-gray-400 hover:text-white transition-colors shrink-0" title={shown ? 'Sembunyikan' : 'Tampilkan'}>
                                {shown ? <Eye className="w-4 h-4 text-indigo-400" /> : <EyeOff className="w-4 h-4" />}
                              </button>
                              <span className={`flex-1 text-sm truncate ${shown ? 'text-white' : 'text-gray-500'}`}>{item?.label || id}</span>
                              <button
                                onClick={() => moveWithinBand(band.id, id, -1)}
                                disabled={i === 0}
                                className="w-6 h-6 rounded flex items-center justify-center text-gray-500 hover:text-white hover:bg-gray-700 disabled:opacity-25 disabled:hover:bg-transparent transition-colors"
                              >
                                <ChevronUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => moveWithinBand(band.id, id, 1)}
                                disabled={i === ord.length - 1}
                                className="w-6 h-6 rounded flex items-center justify-center text-gray-500 hover:text-white hover:bg-gray-700 disabled:opacity-25 disabled:hover:bg-transparent transition-colors"
                              >
                                <ChevronDown className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between px-5 py-4 border-t border-gray-700/70">
                <button
                  onClick={() => saveLayout(DEFAULT_LAYOUT)}
                  disabled={savingLayout}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset bawaan
                </button>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowCustomize(false)} className="btn-secondary !py-1.5 text-sm">Batal</button>
                  <button onClick={() => saveLayout(draft)} disabled={savingLayout} className="btn-primary !py-1.5 text-sm">
                    {savingLayout ? 'Menyimpan…' : 'Simpan'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
