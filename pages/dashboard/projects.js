import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/layout/Layout';
import { useAuth } from '@/components/AuthContext';
import Modal from '@/components/common/Modal';
import { StatusBadge } from '@/components/common/Badge';
import { Plus, Folder, Filter, GitBranch, ListChecks, Users } from 'lucide-react';

const FILTERS = ['all', 'active', 'completed', 'archived'];

export default function ProjectsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filter, setFilter] = useState('all');
  const [createForm, setCreateForm] = useState({ name: '', description: '', git_repo_url: '' });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, [filter]);

  async function fetchProjects() {
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') params.append('status', filter);
      const res = await fetch(`/api/projects?${params.toString()}`);
      const data = await res.json();
      setProjects(data.projects || []);
    } catch (err) {
      console.error('Failed to fetch projects:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateProject(e) {
    e.preventDefault();
    if (!createForm.name.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });
      if (res.ok) {
        const data = await res.json();
        setShowCreateModal(false);
        setCreateForm({ name: '', description: '', git_repo_url: '' });
        router.push(`/dashboard/projects/${data.project.id}`);
      }
    } catch (err) {
      console.error('Failed to create project:', err);
    } finally {
      setCreating(false);
    }
  }

  function getStatusColor(status) {
    switch (status) {
      case 'active': return 'bg-emerald-500/20 text-emerald-400';
      case 'completed': return 'bg-blue-500/20 text-blue-400';
      case 'archived': return 'bg-gray-500/20 text-gray-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  }

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center shrink-0">
              <Folder className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold gradient-text">Projects</h1>
              <p className="text-gray-400 mt-0.5 text-sm">
                {loading ? 'Memuat…' : `${projects.length} proyek${filter !== 'all' ? ` · ${filter}` : ''}`}
              </p>
            </div>
          </div>
          {user?.role === 'admin' && (
            <button onClick={() => setShowCreateModal(true)} className="btn-primary flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Create Project
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 mb-6">
          <Filter className="w-4 h-4 text-gray-500" />
          <div className="flex items-center gap-1.5 flex-wrap">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 active:scale-[0.97] ${
                  filter === f
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                    : 'bg-gray-800/60 text-gray-400 border border-transparent hover:text-white hover:bg-gray-800'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Loading skeletons */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="card">
                <div className="flex items-start justify-between mb-3">
                  <div className="skeleton h-5 w-2/3" />
                  <div className="skeleton h-6 w-16 rounded-full" />
                </div>
                <div className="skeleton h-4 w-full mb-2" />
                <div className="skeleton h-4 w-3/4 mb-4" />
                <div className="skeleton h-4 w-1/3" />
              </div>
            ))}
          </div>
        ) : projects.length === 0 ? (
          /* Empty state */
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-gray-800/60 border border-gray-700/70 flex items-center justify-center mx-auto mb-4">
              <Folder className="w-7 h-7 text-gray-500" />
            </div>
            <p className="text-gray-300 font-medium mb-1">Belum ada proyek</p>
            <p className="text-gray-500 text-sm mb-5">
              {filter !== 'all' ? 'Coba filter lain, atau' : 'Mulai dengan'} membuat proyek pertama Anda
            </p>
            {user?.role === 'admin' && (
              <button onClick={() => setShowCreateModal(true)} className="btn-primary inline-flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Create Project
              </button>
            )}
          </div>
        ) : (
          /* Project grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <div
                key={project.id}
                onClick={() => router.push(`/dashboard/projects/${project.id}`)}
                className="card card-hover cursor-pointer relative overflow-hidden group"
              >
                {/* Top accent line */}
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-indigo-500/0 via-indigo-500/60 to-indigo-500/0 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="flex items-start justify-between mb-3 gap-2">
                  <h3 className="text-lg font-semibold text-white truncate group-hover:text-indigo-100 transition-colors">
                    {project.name}
                  </h3>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium shrink-0 ${getStatusColor(project.status)}`}>
                    {project.status}
                  </span>
                </div>
                <p className="text-gray-400 text-sm mb-4 line-clamp-2 min-h-[2.5rem]">
                  {project.description || <span className="text-gray-600 italic">Tanpa deskripsi</span>}
                </p>
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <span className="inline-flex items-center gap-1.5">
                    <ListChecks className="w-3.5 h-3.5 text-gray-500" />
                    {project.task_count || 0} task
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-gray-500" />
                    {project.member_count || 0} anggota
                  </span>
                  {project.git_repo_url && (
                    <span className="inline-flex items-center gap-1.5 text-indigo-400/90 ml-auto">
                      <GitBranch className="w-3.5 h-3.5" />
                      Git
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create Project">
          <form onSubmit={handleCreateProject} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Project Name</label>
              <input
                type="text"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                className="input-field"
                placeholder="Enter project name"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
              <textarea
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                className="input-field h-24 resize-none"
                placeholder="Enter project description"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Git Repository URL</label>
              <input
                type="url"
                value={createForm.git_repo_url}
                onChange={(e) => setCreateForm({ ...createForm, git_repo_url: e.target.value })}
                className="input-field"
                placeholder="https://github.com/user/repo"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowCreateModal(false)} className="btn-secondary">
                Cancel
              </button>
              <button type="submit" disabled={creating} className="btn-primary">
                {creating ? 'Creating...' : 'Create Project'}
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </Layout>
  );
}
