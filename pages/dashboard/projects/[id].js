import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/layout/Layout';
import { useAuth } from '@/components/AuthContext';
import Modal from '@/components/common/Modal';
import Loading from '@/components/common/Loading';
import { PriorityBadge, StatusBadge } from '@/components/common/Badge';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Plus, ArrowLeft, Settings, GitBranch, MoreVertical, User, X } from 'lucide-react';
import { csrfFetch } from '@/lib/csrfFetch';

const COLUMNS = [
  { id: 'todo', title: 'Todo', color: 'bg-gray-500' },
  { id: 'in_progress', title: 'In Progress', color: 'bg-amber-500' },
  { id: 'review', title: 'Review', color: 'bg-purple-500' },
  { id: 'done', title: 'Done', color: 'bg-emerald-500' },
];

function TaskCard({ task, onClick }) {
  const progress = task.progress || 0;
  return (
    <div
      onClick={() => onClick(task)}
      className="bg-gray-700 rounded-lg p-3 border border-gray-600 hover:border-indigo-500 cursor-pointer transition-all"
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
          <span className="text-xs text-gray-400">{task.assignee_name}</span>
        )}
      </div>
      {task.deadline ? (
        <div className="mt-2 text-xs text-gray-500">
          Due: {(() => { try { return new Date(task.deadline.split('T')[0] + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) } catch { return task.deadline } })()}
        </div>
      ) : null}
    </div>
  );
}

export default function ProjectDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useAuth();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddTask, setShowAddTask] = useState(false);
  const [addColumn, setAddColumn] = useState('todo');
  const [showSettings, setShowSettings] = useState(false);
  const [editProject, setEditProject] = useState({ name: '', description: '', git_repo_url: '' });
  const [newTask, setNewTask] = useState({ title: '', description: '', priority: 'medium', assigned_to: '' });
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');

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

  async function handleDragEnd(result) {
    if (!result.destination) return;
    const { draggableId, destination } = result;
    const newStatus = destination.droppableId;

    const task = tasks.find((t) => String(t.id) === draggableId);
    if (!task || task.status === newStatus) return;

    setTasks((prev) =>
      prev.map((t) =>
        String(t.id) === draggableId ? { ...t, status: newStatus } : t
      )
    );

    try {
      await csrfFetch(`/api/tasks/${draggableId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch (err) {
      console.error('Failed to update task status:', err);
      fetchTasks();
    }
  }

  async function handleAddTask(e) {
    e.preventDefault();
    if (!newTask.title.trim()) return;
    try {
      const res =      await csrfFetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newTask,
          project_id: id,
          status: addColumn,
        }),
      });
      if (res.ok) {
        const createdTask = await res.json();
        if (selectedTemplate) {
          const tpl = templates.find(t => String(t.id) === selectedTemplate);
          if (tpl && tpl.checklist_items) {
            try {
              const items = typeof tpl.checklist_items === 'string' ? JSON.parse(tpl.checklist_items) : tpl.checklist_items;
              for (const item of items) {
                await fetch('/api/tasks/' + createdTask.task.id + '/checklist', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ title: item.title }),
                });
              }
            } catch (e) {}
          }
        }
        setShowAddTask(false);
        setNewTask({ title: '', description: '', priority: 'medium', assigned_to: '' });
        setSelectedTemplate('');
        fetchTasks();
      }
    } catch (err) {
      console.error('Failed to create task:', err);
    }
  }

  async function handleUpdateProject(e) {
    e.preventDefault();
    try {
      const res =      await csrfFetch(`/api/projects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editProject),
      });
      if (res.ok) {
        setShowSettings(false);
        fetchProject();
      }
    } catch (err) {
      console.error('Failed to update project:', err);
    }
  }

  async function handleDeleteProject() {
    if (!confirm('Are you sure you want to delete this project?')) return;
    try {
      const res = await csrfFetch(`/api/projects/${id}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/dashboard/projects');
      }
    } catch (err) {
      console.error('Failed to delete project:', err);
    }
  }

  function getTasksByStatus(status) {
    return tasks.filter((t) => {
      if (t.status !== status) return false;
      if (filterAssignee && String(t.assigned_to) !== filterAssignee) return false;
      return true;
    });
  }

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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 md:mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/dashboard/projects')}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-400" />
            </button>
            <div className="min-w-0">
              <h1 className="text-lg md:text-2xl font-bold text-white truncate">{project.name}</h1>
              {project.description && (
                <p className="text-gray-400 mt-1 text-sm hidden sm:block">{project.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
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
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <MoreVertical className="w-5 h-5 text-gray-400" />
              </button>
              {showSettings && (
                <div className="absolute right-0 top-10 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10 w-48">
                  <button
                    onClick={() => { setShowSettings(false); }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
                  >
                    Edit Project
                  </button>
                  {user?.role === 'admin' && (
                    <button
                      onClick={handleDeleteProject}
                      className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-700"
                    >
                      Delete Project
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

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
            {filterAssignee && (
              <button onClick={() => setFilterAssignee('')} className="p-1 text-gray-400 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-3 md:gap-4 flex-1 overflow-x-auto pb-4 scrollbar-hide">
            {COLUMNS.map((column) => {
              const columnTasks = getTasksByStatus(column.id);
              return (
                <div key={column.id} className="flex-shrink-0 w-72 md:w-80">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${column.color}`} />
                      <h3 className="text-sm font-semibold text-gray-300 uppercase">
                        {column.title}
                      </h3>
                      <span className="text-xs text-gray-500 bg-gray-700 px-2 py-0.5 rounded-full">
                        {columnTasks.length}
                      </span>
                    </div>
                    <button
                      onClick={() => { setAddColumn(column.id); setShowAddTask(true); }}
                      className="p-1 hover:bg-gray-700 rounded transition-colors"
                    >
                      <Plus className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                  <Droppable droppableId={column.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`min-h-[200px] rounded-lg p-2 transition-colors ${
                          snapshot.isDraggingOver
                            ? 'bg-indigo-500/10 border-2 border-dashed border-indigo-500'
                            : 'bg-gray-900/50'
                        }`}
                      >
                        <div className="space-y-2">
                          {columnTasks.map((task, index) => (
                            <Draggable
                              key={String(task.id)}
                              draggableId={String(task.id)}
                              index={index}
                            >
                              {(provided) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
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
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>

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
                          title: t.name || '',
                          description: t.description || '',
                          priority: t.priority || 'medium',
                          assigned_to: '',
                        });
                      }
                    }
                  }}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Enter task title"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
              <textarea
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 h-20 resize-none"
                placeholder="Enter description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Priority</label>
                <select
                  value={newTask.priority}
                  onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Assign To</label>
                <select
                  value={newTask.assigned_to}
                  onChange={(e) => setNewTask({ ...newTask, assigned_to: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Unassigned</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowAddTask(false)}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
              >
                Create Task
              </button>
            </div>
          </form>
        </Modal>

        <Modal isOpen={showSettings} onClose={() => setShowSettings(false)} title="Edit Project">
          <form onSubmit={handleUpdateProject} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Project Name</label>
              <input
                type="text"
                value={editProject.name}
                onChange={(e) => setEditProject({ ...editProject, name: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
              <textarea
                value={editProject.description}
                onChange={(e) => setEditProject({ ...editProject, description: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 h-24 resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Git Repository URL</label>
              <input
                type="url"
                value={editProject.git_repo_url}
                onChange={(e) => setEditProject({ ...editProject, git_repo_url: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
              >
                Save Changes
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </Layout>
  );
}
