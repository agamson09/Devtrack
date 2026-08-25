import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/layout/Layout';
import { useAuth } from '@/components/AuthContext';
import { useToast } from '@/components/ToastContext';
import Modal from '@/components/common/Modal';
import Loading from '@/components/common/Loading';
import { PriorityBadge } from '@/components/common/Badge';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Plus, ArrowLeft, GitBranch, MoreVertical, Download, User, X } from 'lucide-react';
import { csrfFetch } from '@/lib/csrfFetch';

const COLUMNS = [
  { id: 'todo', title: 'Todo', color: 'bg-gray-500' },
  { id: 'in_progress', title: 'In Progress', color: 'bg-amber-500' },
  { id: 'review', title: 'Review', color: 'bg-purple-500' },
  { id: 'done', title: 'Done', color: 'bg-emerald-500' },
];

const EMPTY_TASK = { title: '', description: '', priority: 'medium', assigned_to: '', module: '', start_date: '', deadline: '' };

function isOverdue(task) {
  if (!task.deadline || task.status === 'done') return false;
  try {
    const ds = String(task.deadline).split('T')[0].split(' ')[0];
    return ds ? new Date(ds + 'T23:59:59') < new Date() : false;
  } catch {
    return false;
  }
}

function formatDate(d) {
  try {
    const ds = String(d).split('T')[0].split(' ')[0];
    return ds ? new Date(ds + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  } catch {
    return d;
  }
}

function TaskCard({ task, onClick }) {
  const progress = task.progress || 0;
  const overdue = isOverdue(task);
  return (
    <div
      onClick={() => onClick(task)}
      className="bg-gray-700 rounded-lg p-3 border border-gray-600 hover:border-indigo-500 cursor-pointer transition-all active:cursor-grabbing"
    >
      {task.labels && task.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {task.labels.map(l => (
            <span key={l.id} className="px-1.5 py-0.5 rounded text-[10px] font-medium text-white" style={{ backgroundColor: l.color }}>{l.name}</span>
          ))}
        </div>
      )}
      <h4 className="text-white text-sm font-medium mb-2">{task.title}</h4>
      {task.module && (
        <span className="inline-block text-[10px] bg-gray-600 text-gray-300 px-1.5 py-0.5 rounded mb-2">{task.module}</span>
      )}
      {progress > 0 && (
        <div className="mb-2">
          <div className="w-full h-1.5 bg-gray-600 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${progress >= 100 ? 'bg-emerald-500' : progress >= 50 ? 'bg-indigo-500' : 'bg-amber-500'}`} style={{ width: progress + '%' }} />
          </div>
          <span className="text-[10px] text-gray-500 mt-0.5">{progress}%</span>
        </div>
      )}
      <div className="flex items-center justify-between">
        <PriorityBadge priority={task.priority} />
        {task.assignee_name && (
          <span className="text-xs text-gray-400 truncate max-w-[50%]">{task.assignee_name}</span>
        )}
      </div>
      {task.deadline ? (
        <div className={`mt-2 text-xs flex items-center gap-1 ${overdue ? 'text-red-400 font-medium' : 'text-gray-500'}`}>
          Due: {formatDate(task.deadline)}
          {overdue && <span className="bg-red-500/20 px-1.5 py-0.5 rounded text-[9px] uppercase">Overdue</span>}
        </div>
      ) : null}
    </div>
  );
}

export default function ProjectDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useAuth();
  const { showToast } = useToast();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddTask, setShowAddTask] = useState(false);
  const [addColumn, setAddColumn] = useState('todo');
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editProject, setEditProject] = useState({ name: '', description: '', git_repo_url: '' });
  const [newTask, setNewTask] = useState(EMPTY_TASK);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [savingOrder, setSavingOrder] = useState(false);
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  useEffect(() => {
    if (id) {
      fetchProject();
      fetchTasks();
      fetchUsers();
      fetchTemplates();
    }
  }, [id]);

  async function fetchProject() {
    try {
      const res = await fetch(`/api/projects/${id}`);
      const data = await res.json();
      setProject(data.project);
      setEditProject({
        name: data.project.name,
        description: data.project.description || '',
        git_repo_url: data.project.git_repo_url || '',
      });
    } catch (err) {
      console.error('Failed to fetch project:', err);
    }
  }

  async function fetchTasks() {
    try {
      const res = await fetch(`/api/tasks?project_id=${id}`);
      const data = await res.json();
      setTasks(data.tasks || []);
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchTemplates() {
    try {
      const res = await fetch('/api/task-templates');
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch (err) {}
  }

  async function fetchUsers() {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  }

  /**
   * Persist a drag: compute new order for every affected column against the
   * FULL (unfiltered) task lists, update state optimistically, then send one
   * PUT per card whose status or sort_order actually changed.
   * On any failure the board is refetched so UI never lies.
   */
  async function handleDragEnd(result) {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    const samePlace = destination.droppableId === source.droppableId && destination.index === source.index;
    if (samePlace) return;
    if (savingOrder) return;

    const movedId = String(draggableId);

    // Build full ordered column arrays from current state
    const byCol = {};
    for (const col of COLUMNS) {
      byCol[col.id] = tasksRef.current
        .filter(t => t.status === col.id)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || new Date(b.created_at) - new Date(a.created_at));
    }
    // Remove from source, insert into destination at the dropped index
    const moved = byCol[source.droppableId].splice(byCol[source.droppableId].findIndex(t => String(t.id) === movedId), 1)[0];
    if (!moved) return;
    byCol[destination.droppableId].splice(destination.index, 0, { ...moved, status: destination.droppableId });

    // Recompute sort_order for affected columns and diff against old values
    const updates = [];
    const orderById = {};
    for (const col of COLUMNS) {
      const changedColumn = col.id === source.droppableId || col.id === destination.droppableId;
      byCol[col.id].forEach((t, idx) => {
        const nextOrder = idx * 10;
        orderById[t.id] = { status: col.id, sort_order: nextOrder };
        if (changedColumn) {
          const oldStatus = t.status;
          const oldOrder = t.sort_order ?? 0;
          if (String(t.id) === movedId || oldStatus !== col.id || oldOrder !== nextOrder) {
            updates.push({ id: String(t.id), status: oldStatus === col.id ? undefined : col.id, sort_order: nextOrder });
          }
        }
      });
    }

    // Optimistic state update
    setTasks(prev => prev.map(t => orderById[t.id] ? { ...t, status: orderById[t.id].status, sort_order: orderById[t.id].sort_order } : t));

    setSavingOrder(true);
    try {
      for (const u of updates) {
        const body = u.status !== undefined ? { status: u.status, sort_order: u.sort_order } : { sort_order: u.sort_order };
        const res = await csrfFetch(`/api/tasks/${u.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`update failed (${res.status})`);
      }
    } catch (err) {
      console.error('Failed to persist board order:', err);
      showToast('error', 'Gagal memindahkan task — papan dikembalikan. (Member hanya bisa memindahkan task miliknya)');
      fetchTasks();
    } finally {
      setSavingOrder(false);
    }
  }

  async function handleAddTask(e) {
    e.preventDefault();
    if (!newTask.title.trim()) return;
    try {
      const res = await csrfFetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newTask,
          assigned_to: newTask.assigned_to || undefined,
          project_id: Number(id),
          status: addColumn,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.details?.join(', ') || data.error || 'Gagal membuat task');
      }
      const created = await res.json();
      if (selectedTemplate) {
        const tpl = templates.find(t => String(t.id) === selectedTemplate);
        if (tpl && tpl.checklist_items) {
          try {
            const items = typeof tpl.checklist_items === 'string' ? JSON.parse(tpl.checklist_items) : tpl.checklist_items;
            for (const item of items) {
              await csrfFetch(`/api/tasks/${created.task.id}/checklist`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: item.title }),
              });
            }
          } catch (e) {}
        }
      }
      setShowAddTask(false);
      setNewTask(EMPTY_TASK);
      setSelectedTemplate('');
      showToast('success', 'Task dibuat');
      fetchTasks();
    } catch (err) {
      console.error('Failed to create task:', err);
      showToast('error', err.message || 'Gagal membuat task');
    }
  }

  async function handleUpdateProject(e) {
    e.preventDefault();
    try {
      const res = await csrfFetch(`/api/projects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editProject),
      });
      if (!res.ok) throw new Error('update failed');
      setShowEditModal(false);
      showToast('success', 'Proyek diperbarui');
      fetchProject();
    } catch (err) {
      console.error('Failed to update project:', err);
      showToast('error', 'Gagal memperbarui proyek');
    }
  }

  async function handleDeleteProject() {
    if (!confirm('Are you sure you want to delete this project?')) return;
    try {
      const res = await csrfFetch(`/api/projects/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete failed');
      router.push('/dashboard/projects');
    } catch (err) {
      console.error('Failed to delete project:', err);
      showToast('error', 'Gagal menghapus proyek');
    }
  }

  // Filtered view used only for rendering; ordering math uses the full lists.
  function getTasksByStatus(status) {
    const col = tasks
      .filter(t => t.status === status)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || new Date(b.created_at) - new Date(a.created_at));
    if (!filterAssignee) return col;
    return col.filter(t => String(t.assigned_to) === filterAssignee);
  }

  const filterActive = Boolean(filterAssignee);

  if (loading) {
    return (
      <Layout>
        <Loading />
      </Layout>
    );
  }

  if (!project) {
    return (
      <Layout>
        <div className="p-6 text-center text-gray-400">Project not found</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 md:p-6 h-full flex flex-col">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => router.push('/dashboard/projects')}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              aria-label="Back to projects"
            >
              <ArrowLeft className="w-5 h-5 text-gray-400" />
            </button>
            <div className="min-w-0">
              <h1 className="text-lg md:text-2xl font-bold text-white truncate gradient-text">{project.name}</h1>
              {project.description && (
                <p className="text-gray-400 mt-0.5 text-sm hidden sm:block truncate">{project.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => window.open(`/api/export/tasks?project_id=${id}`, '_blank')}
              className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300 text-sm transition-colors"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export</span>
            </button>
            {project.git_repo_url && (
              <a
                href={project.git_repo_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300 text-sm transition-colors"
              >
                <GitBranch className="w-4 h-4" />
                <span className="hidden sm:inline">Repository</span>
              </a>
            )}
            <div className="relative">
              <button
                onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                aria-label="Project menu"
              >
                <MoreVertical className="w-5 h-5 text-gray-400" />
              </button>
              {showSettingsMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowSettingsMenu(false)} />
                  <div className="absolute right-0 top-11 bg-gray-800 border border-gray-700 rounded-xl shadow-panel z-20 w-48 py-1 animate-scale-in origin-top-right">
                    <button
                      onClick={() => { setShowSettingsMenu(false); setShowEditModal(true); }}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                    >
                      Edit Project
                    </button>
                    {user?.role === 'admin' && (
                      <button
                        onClick={handleDeleteProject}
                        className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        Delete Project
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-5 border-b border-gray-700/70">
          <span className="px-4 py-2.5 text-sm font-medium text-indigo-300 border-b-2 border-indigo-500 -mb-px inline-flex items-center gap-1.5">
            <i className="fa-solid fa-columns"></i>Kanban
          </span>
          <button
            onClick={() => router.push(`/dashboard/projects/${id}/timeline`)}
            className="px-4 py-2.5 text-sm font-medium text-gray-400 hover:text-gray-200 border-b-2 border-transparent -mb-px transition-colors inline-flex items-center gap-1.5"
          >
            <i className="fa-solid fa-chart-line"></i>Timeline
          </button>
        </div>

        {/* Assignee filter */}
        {user?.role === 'admin' && users.length > 0 && (
          <div className="flex items-center gap-2 mb-3">
            <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <select
              value={filterAssignee}
              onChange={(e) => setFilterAssignee(e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-xs"
            >
              <option value="">All Assignees</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
            {filterActive && (
              <button onClick={() => setFilterAssignee('')} className="p-1 text-gray-400 hover:text-white transition-colors" aria-label="Clear filter">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {filterActive && (
          <p className="text-xs text-amber-400/80 mb-2 flex items-center gap-1.5">
            <i className="fa-solid fa-circle-info"></i>
            Filter aktif — kartu dikunci. Hapus filter untuk menata ulang papan.
          </p>
        )}

        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-3 md:gap-4 flex-1 overflow-x-auto pb-4 scrollbar-hide">
            {COLUMNS.map((column) => {
              const columnTasks = getTasksByStatus(column.id);
              const doneCount = column.id === 'done' ? columnTasks.length : null;
              return (
                <div key={column.id} className="flex-shrink-0 w-[17rem] md:w-80 flex flex-col">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${column.color}`} />
                      <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
                        {column.title}
                      </h3>
                      <span className="text-xs text-gray-500 bg-gray-700/80 px-2 py-0.5 rounded-full tabular-nums">
                        {doneCount !== null ? `${doneCount} selesai` : columnTasks.length}
                      </span>
                    </div>
                    <button
                      onClick={() => { setAddColumn(column.id); setShowAddTask(true); }}
                      className="p-1.5 hover:bg-gray-700 rounded-md transition-colors"
                      aria-label={`Add task to ${column.title}`}
                    >
                      <Plus className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                  <Droppable droppableId={column.id} isDropDisabled={filterActive}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`min-h-[200px] rounded-xl p-2 transition-all duration-200 border ${
                          snapshot.isDraggingOver
                            ? 'bg-indigo-500/10 border-2 border-dashed border-indigo-500'
                            : 'border-transparent'
                        }`}
                        style={!snapshot.isDraggingOver ? { backgroundColor: 'rgba(17,24,39,0.5)' } : undefined}
                      >
                        <div className="space-y-2">
                          {columnTasks.map((task, index) => (
                            <Draggable
                              key={String(task.id)}
                              draggableId={String(task.id)}
                              index={index}
                              isDragDisabled={filterActive}
                            >
                              {(provided, snapshotDragging) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  style={{
                                    ...provided.draggableProps.style,
                                    opacity: snapshotDragging.isDragging ? 0.85 : undefined,
                                    transform: snapshotDragging.isDragging
                                      ? `${provided.draggableProps.style?.transform} rotate(2deg)`
                                      : provided.draggableProps.style?.transform,
                                  }}
                                >
                                  <TaskCard
                                    task={task}
                                    onClick={(t) => router.push(`/task/${t.id}`)}
                                  />
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                        {columnTasks.length === 0 && !snapshot.isDraggingOver && (
                          <div className="flex flex-col items-center justify-center py-8 text-gray-600 pointer-events-none">
                            <Plus className="w-6 h-6 mb-1" />
                            <span className="text-xs">Drop or add task here</span>
                          </div>
                        )}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>

        {/* Add Task modal */}
        <Modal isOpen={showAddTask} onClose={() => setShowAddTask(false)} title={`Add Task to ${COLUMNS.find(c => c.id === addColumn)?.title}`}>
          <form onSubmit={handleAddTask} className="space-y-4">
            {templates.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Use Template (optional)</label>
                <select
                  value={selectedTemplate}
                  onChange={(e) => {
                    const tId = e.target.value;
                    setSelectedTemplate(tId);
                    if (tId) {
                      const t = templates.find(tp => String(tp.id) === tId);
                      if (t) {
                        setNewTask({
                          ...EMPTY_TASK,
                          title: t.name || '',
                          description: t.description || '',
                          priority: ['low', 'medium', 'high', 'urgent'].includes(t.priority) ? t.priority : 'medium',
                        });
                      }
                    }
                  }}
                  className="input-field"
                >
                  <option value="">No template</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Title</label>
              <input
                type="text"
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                className="input-field"
                placeholder="Enter task title"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
              <textarea
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                className="input-field h-20 resize-none"
                placeholder="Enter description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Priority</label>
                <select
                  value={newTask.priority}
                  onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                  className="input-field"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Module (optional)</label>
                <input
                  type="text"
                  value={newTask.module}
                  onChange={(e) => setNewTask({ ...newTask, module: e.target.value })}
                  className="input-field"
                  placeholder="e.g. Auth"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Assign To</label>
              <select
                value={newTask.assigned_to}
                onChange={(e) => setNewTask({ ...newTask, assigned_to: e.target.value })}
                className="input-field"
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Start Date</label>
                <input
                  type="date"
                  value={newTask.start_date}
                  onChange={(e) => setNewTask({ ...newTask, start_date: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Due Date</label>
                <input
                  type="date"
                  value={newTask.deadline}
                  onChange={(e) => setNewTask({ ...newTask, deadline: e.target.value })}
                  className="input-field"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowAddTask(false)} className="btn-secondary">
                Cancel
              </button>
              <button type="submit" className="btn-primary">Create Task</button>
            </div>
          </form>
        </Modal>

        {/* Edit Project modal */}
        <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Project">
          <form onSubmit={handleUpdateProject} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Project Name</label>
              <input
                type="text"
                value={editProject.name}
                onChange={(e) => setEditProject({ ...editProject, name: e.target.value })}
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
              <textarea
                value={editProject.description}
                onChange={(e) => setEditProject({ ...editProject, description: e.target.value })}
                className="input-field h-24 resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Git Repository URL</label>
              <input
                type="url"
                value={editProject.git_repo_url}
                onChange={(e) => setEditProject({ ...editProject, git_repo_url: e.target.value })}
                className="input-field"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowEditModal(false)} className="btn-secondary">
                Cancel
              </button>
              <button type="submit" className="btn-primary">Save Changes</button>
            </div>
          </form>
        </Modal>
      </div>
    </Layout>
  );
}
