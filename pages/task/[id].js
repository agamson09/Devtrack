import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/layout/Layout';
import { useAuth } from '@/components/AuthContext';
import Loading from '@/components/common/Loading';
import Avatar from '@/components/common/Avatar';
import SnippingEditor from '@/components/SnippingEditor';
import { PdfExportButton } from '@/components/common/PdfExport';
import { ArrowLeft, GitCommit, MessageSquare, History, Plus, Clock, X, Play, Square, Image as ImageIcon, Send, Scissors, Scan, Trash2, Calendar, Link2, Eye, EyeOff, AlertCircle, ChevronDown, User, CheckCircle2, Circle, Paperclip, FileText, Download, ClipboardCheck, Code } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ConfirmDialog from '@/components/common/ConfirmDialog';

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let w = img.width
        let h = img.height
        const maxW = 1200
        if (w > maxW) {
          h = Math.round((h * maxW) / w)
          w = maxW
        }
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, w, h)
        canvas.toBlob(
          (blob) => {
            if (!blob) { reject(new Error('Canvas toBlob failed')); return }
            const compressed = new File([blob], file.name || `paste-${Date.now()}.png`, { type: 'image/jpeg' })
            resolve(compressed)
          },
          'image/jpeg',
          0.7
        )
      }
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = e.target.result
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

function CommitRow({ commit }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-700 last:border-b-0">
      <GitCommit className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <code className="text-xs bg-gray-700 px-2 py-0.5 rounded text-emerald-400 font-mono">
            {commit.commit_hash?.substring(0, 7)}
          </code>
          <span className="text-sm text-white">{commit.commit_message || commit.message}</span>
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
          <span>{commit.author}</span>
          <span>{new Date(commit.created_at).toLocaleDateString('id-ID')}</span>
          {(commit.added_lines !== undefined || commit.additions !== undefined) && (
            <span className="text-emerald-400">+{commit.added_lines || commit.additions}</span>
          )}
          {(commit.deleted_lines !== undefined || commit.deletions !== undefined) && (
            <span className="text-red-400">-{commit.deleted_lines || commit.deletions}</span>
          )}
        </div>
      </div>
    </div>
  )
}

function HistoryItem({ entry }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="w-2 h-2 rounded-full bg-indigo-500 mt-2 flex-shrink-0" />
      <div>
        <p className="text-sm text-gray-300">
          <span className="text-white font-medium">{entry.user_name}</span>{' '}
          changed <span className="text-indigo-400">{entry.field_changed}</span>{' '}
          from <span className="text-gray-500">{entry.old_value || 'empty'}</span>{' '}
          to <span className="text-gray-500">{entry.new_value || 'empty'}</span>
        </p>
        <p className="text-xs text-gray-500 mt-0.5">
          {new Date(entry.changed_at).toLocaleString('id-ID')}
        </p>
      </div>
    </div>
  )
}

function renderCommentText(text) {
  if (!text) return null
  const parts = text.split(/(@\w[\w\s]*?\s?|~\w[\w\s]*?\s?|#\d+\s?)/g)
  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      return <span key={i} className="text-indigo-400 font-medium">{part}</span>
    }
    if (part.startsWith('~')) {
      return <span key={i} className="text-emerald-400 font-medium">{part}</span>
    }
    if (part.startsWith('#')) {
      return <span key={i} className="text-amber-400 font-medium">{part}</span>
    }
    return <span key={i}>{part}</span>
  })
}

function ChecklistItem({ item, onToggle, onDelete, taskId, onRefresh, isAdmin, allUsers }) {
  const [expanded, setExpanded] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [replyImage, setReplyImage] = useState(null)
  const [replyImagePreview, setReplyImagePreview] = useState(null)
  const replyFileRef = useRef(null)

  async function handleAddReply() {
    if (!replyText.trim() && !replyImage) return
    let imageUrl = null
    if (replyImage) {
      const formData = new FormData()
      formData.append('image', replyImage)
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData })
      if (uploadRes.ok) {
        const uploadData = await uploadRes.json()
        imageUrl = uploadData.url
      }
    }
    try {
      const res = await fetch(`/api/tasks/${taskId}/checklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checklist_id: item.id, comment: replyText.trim(), image_url: imageUrl }),
      })
      if (res.ok) {
        setReplyText('')
        setReplyImage(null)
        setReplyImagePreview(null)
        onRefresh()
      }
    } catch (err) {}
  }

  async function handleReplyPaste(e) {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (!file) return
        try {
          const compressed = await compressImage(file)
          setReplyImage(compressed)
          const reader = new FileReader()
          reader.onload = (ev) => setReplyImagePreview(ev.target.result)
          reader.readAsDataURL(compressed)
        } catch (err) {}
        return
      }
    }
  }

  async function handleDeleteReply(replyId) {
    try {
      await fetch(`/api/tasks/${taskId}/checklist?comment_id=${replyId}`, {
        method: 'DELETE',
      })
      onRefresh()
    } catch (err) {}
  }

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
      <div className="flex items-center gap-3 p-3">
        <button
          onClick={() => onToggle(item.id, item.is_checked)}
          className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
            item.is_checked
              ? 'bg-emerald-500 border-emerald-500'
              : 'border-gray-500 hover:border-emerald-400'
          }`}
        >
          {item.is_checked && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
        </button>
        <span className={`flex-1 text-sm ${item.is_checked ? 'text-gray-500 line-through' : 'text-white'}`}>
          {item.title}
        </span>
        <button onClick={() => setExpanded(!expanded)} className="text-gray-500 hover:text-white transition-colors p-1">
          <MessageSquare className="w-4 h-4" /> <span className="text-xs ml-1">{item.replies?.length || 0}</span>
        </button>
        {isAdmin && <button onClick={() => onDelete(item.id)} className="text-gray-500 hover:text-red-400 transition-colors p-1"><X className="w-4 h-4" /></button>}
      </div>
      {expanded && (
        <div className="border-t border-gray-700">
          {item.replies?.length > 0 && (
            <div className="max-h-60 overflow-y-auto">
              {item.replies.map(reply => (
                <div key={reply.id} className="flex gap-2 py-2 px-3 border-b border-gray-700/50 last:border-b-0">
                   <Avatar name={reply.user_name} avatarStyle={reply.user_avatar_style} avatarSeed={reply.user_avatar_seed} avatarOptions={reply.user_avatar_options} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-white">{reply.user_name}</span>
                      <span className="text-[10px] text-gray-500">{new Date(reply.created_at).toLocaleDateString('id-ID')}</span>
                    </div>
                    {reply.comment && <p className="text-xs text-gray-300 mt-0.5 whitespace-pre-wrap">{reply.comment}</p>}
                    {reply.image_url && <img src={reply.image_url} alt="attachment" className="mt-1 max-h-32 rounded border border-gray-600 cursor-pointer" onClick={() => window.open(reply.image_url, '_blank')} />}
                  </div>
                  <button onClick={() => handleDeleteReply(reply.id)} className="text-gray-600 hover:text-red-400 transition-colors p-0.5 self-start"><X className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
          )}
          <div className="p-2 bg-gray-800">
            {replyImagePreview && (
              <div className="relative mb-2">
                <img src={replyImagePreview} alt="preview" className="max-h-20 rounded border border-gray-600" />
                <button onClick={() => { setReplyImage(null); setReplyImagePreview(null); }} className="absolute top-1 right-1 p-0.5 bg-gray-900/80 rounded-full text-gray-400 hover:text-white"><X className="w-3 h-3" /></button>
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddReply() } }}
                onPaste={handleReplyPaste}
                className="flex-1 px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="Reply or paste image..."
              />
              <button onClick={() => replyFileRef.current?.click()} className="p-1.5 text-gray-400 hover:text-white transition-colors">
                <ImageIcon className="w-3.5 h-3.5" />
              </button>
              <input ref={replyFileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setReplyImage(f); const r = new FileReader(); r.onload = (ev) => setReplyImagePreview(ev.target.result); r.readAsDataURL(f); } }} />
              <button onClick={handleAddReply} disabled={!replyText.trim() && !replyImage} className="p-1.5 text-indigo-400 hover:text-indigo-300 disabled:opacity-30 transition-colors">
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function CommentItem({ comment, onDelete, canDeleteAny }) {
  const { user } = useAuth()
  return (
    <div className="flex gap-3 py-3 border-b border-gray-700 last:border-b-0">
       <Avatar name={comment.user_name} avatarStyle={comment.user_avatar_style} avatarSeed={comment.user_avatar_seed} avatarOptions={comment.user_avatar_options} size="sm" />
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">{comment.user_name}</span>
            <span className="text-xs text-gray-500">
              {new Date(comment.created_at).toLocaleDateString('id-ID')}
            </span>
          </div>
          {(user?.id === comment.user_id || canDeleteAny) && (
            <button
              onClick={() => onDelete(comment.id)}
              className="text-gray-500 hover:text-red-400 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {comment.comment && <p className="text-sm text-gray-300 mt-1 whitespace-pre-wrap">{renderCommentText(comment.comment)}</p>}
        {comment.image_url && (
          <div className="mt-2">
            <img
              src={comment.image_url}
              alt="Comment attachment"
              className="max-w-full max-h-64 rounded-lg border border-gray-600 cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => window.open(comment.image_url, '_blank')}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default function TaskDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useAuth();
  const [task, setTask] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('details');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [deadline, setDeadline] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('');
  const [actualHours, setActualHours] = useState('');
  const [module, setModule] = useState('');
  const [modules, setModules] = useState([]);

  const [progress, setProgress] = useState(0);
  const [startDate, setStartDate] = useState('');
  const [dependsOn, setDependsOn] = useState('');
  const [allUsers, setAllUsers] = useState([]);
  const [descPreview, setDescPreview] = useState(false);
  const [checklist, setChecklist] = useState([]);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [approved, setApproved] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteCommentId, setDeleteCommentId] = useState(null);
  const [showDeleteCommentConfirm, setShowDeleteCommentConfirm] = useState(false);
  const [mentionType, setMentionType] = useState('');

  const [showAddCommit, setShowAddCommit] = useState(false);
  const [commitForm, setCommitForm] = useState({ commit_hash: '', message: '', author: '', additions: 0, deletions: 0 });
  const [commentText, setCommentText] = useState('');
  const [commentImage, setCommentImage] = useState(null);
  const [commentImagePreview, setCommentImagePreview] = useState(null);
  const [uploadingComment, setUploadingComment] = useState(false);
  const commentFileRef = useRef(null);

  const [showSnipping, setShowSnipping] = useState(false);
  const [snippingImage, setSnippingImage] = useState(null);
  const [allTasks, setAllTasks] = useState([]);
  const [mentionQuery, setMentionQuery] = useState('');
  const [showTaskMention, setShowTaskMention] = useState(false);
  const [mentionSelectedIdx, setMentionSelectedIdx] = useState(0);
  const commentRef = useRef(null);

  const [timerState, setTimerState] = useState({ is_running: false, elapsed_seconds: 0, timer_started_at: null });
  const timerIntervalRef = useRef(null);
  const [timerDisplay, setTimerDisplay] = useState('00:00:00');

  const canEditFields = user?.role === 'admin' || (task && user?.id == task.assigned_to);

  function calcWorkingHours(deadlineStr) {
    if (!deadlineStr) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deadline = new Date(deadlineStr + 'T00:00:00');
    deadline.setHours(0, 0, 0, 0);
    if (deadline <= today) return null;
    let workDays = 0;
    const cur = new Date(today);
    while (cur < deadline) {
      cur.setDate(cur.getDate() + 1);
      const dow = cur.getDay();
      if (dow !== 0 && dow !== 6) workDays++;
    }
    return workDays * 8;
  }

  const taskMentionCandidates = allTasks
    .filter(t => t.id !== parseInt(id) && t.title.toLowerCase().includes(mentionQuery.toLowerCase()))
    .slice(0, 6);
  const userMentionCandidates = allUsers
    .filter(u => u.name.toLowerCase().includes(mentionQuery.toLowerCase()))
    .slice(0, 6);

  function insertUserMention(u) {
    const textarea = commentRef.current
    if (!textarea) return
    const val = commentText
    const lastIdx = val.lastIndexOf('@')
    if (lastIdx === -1) { setShowTaskMention(false); return }
    const before = val.slice(0, lastIdx)
    const after = val.slice(textarea.selectionStart || val.length)
    const newVal = before + '@' + u.name + ' ' + after
    setCommentText(newVal)
    setShowTaskMention(false)
    setMentionQuery('')
    setMentionType('')
    setTimeout(() => {
      textarea.focus()
      const p = (before + '@' + u.name + ' ').length
      textarea.setSelectionRange(p, p)
    }, 0)
  }

  function insertTaskMention(task) {
    const textarea = commentRef.current
    if (!textarea) return
    const val = commentText
    const lastIdx = val.lastIndexOf('~')
    if (lastIdx === -1) { setShowTaskMention(false); return }
    const before = val.slice(0, lastIdx)
    const after = val.slice(textarea.selectionStart || val.length)
    const newVal = before + '~' + task.title + ' ' + after
    setCommentText(newVal)
    setShowTaskMention(false)
    setMentionQuery('')
    setTimeout(() => {
      textarea.focus()
      const p = (before + '~' + task.title + ' ').length
      textarea.setSelectionRange(p, p)
    }, 0)
  }

  function handleCommentChange(e) {
    const val = e.target.value
    setCommentText(val)
    const textBefore = val.slice(0, e.target.selectionStart)
    const m = textBefore.match(/([@~])(\w*)$/)
    if (m) {
      setMentionType(m[1])
      setMentionQuery(m[2])
      setShowTaskMention(true)
      setMentionSelectedIdx(0)
    } else {
      setShowTaskMention(false)
    }
  }

  function handleCommentKeyDown(e) {
    const candidates = mentionType === '@' ? userMentionCandidates : taskMentionCandidates
    if (showTaskMention && candidates.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionSelectedIdx(p => Math.min(p + 1, taskMentionCandidates.length - 1)); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setMentionSelectedIdx(p => Math.max(p - 1, 0)); return }
      if (e.key === 'Tab' || e.key === 'Enter') { e.preventDefault(); if (mentionType === '@') insertUserMention(userMentionCandidates[mentionSelectedIdx]); else insertTaskMention(taskMentionCandidates[mentionSelectedIdx]); return }
      if (e.key === 'Escape') { setShowTaskMention(false); return }
    }
  }

  function handleSnippingSave(file) {
    setCommentImage(file)
    const reader = new FileReader()
    reader.onload = (ev) => setCommentImagePreview(ev.target.result)
    reader.readAsDataURL(file)
    setShowSnipping(false)
  }

  async function startScreenCapture() {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: 'always' } })
      const video = document.createElement('video')
      video.srcObject = stream
      await video.play()

      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      ctx.drawImage(video, 0, 0)

      stream.getTracks().forEach(t => t.stop())

      setSnippingImage(canvas.toDataURL('image/png'))
      setShowSnipping(true)
    } catch (err) {
      console.log('Screen capture cancelled or not supported')
    }
  }

  function openSnippingFromFile() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = (e) => {
      const file = e.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (ev) => {
        setSnippingImage(ev.target.result)
        setShowSnipping(true)
      }
      reader.readAsDataURL(file)
    }
    input.click()
  }

  useEffect(() => {
    if (id) {
      fetchTask();
      fetchUsers();
      fetchModules();
      fetchTimer();
      fetchAllTasks();
      fetchChecklist();
      fetchAttachments();
    }
  }, [id]);

  async function fetchChecklist() {
    try {
      const res = await fetch(`/api/tasks/${id}/checklist`);
      const data = await res.json();
      setChecklist(data.items || []);
    } catch (err) {}
  }
  async function fetchAttachments() {
    try {
      const res = await fetch(`/api/tasks/${id}/attachments`);
      const data = await res.json();
      setAttachments(data.attachments || []);
    } catch (err) {}
  }
  async function fetchAllTasks() {
    try {
      const res = await fetch('/api/tasks');
      const data = await res.json();
      setAllTasks(data.tasks || []);
    } catch (err) {}
  }

  async function fetchModules() {
    try {
      const res = await fetch('/api/deploy/modules');
      const data = await res.json();
      setModules(data.modules || []);
    } catch (err) {}
  }

  async function fetchTimer() {
    try {
      const res = await fetch(`/api/tasks/${id}/timer`);
      if (res.ok) {
        const data = await res.json();
        setTimerState(data);
        updateTimerDisplay(data.elapsed_seconds);
      }
    } catch (err) {}
  }

  function updateTimerDisplay(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    setTimerDisplay(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
  }

  useEffect(() => {
    if (timerState.is_running) {
      let elapsed = timerState.elapsed_seconds;
      timerIntervalRef.current = setInterval(() => {
        elapsed += 1;
        updateTimerDisplay(elapsed);
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [timerState.is_running]);

  async function handleTimerAction(action) {
    if (action === 'start') {
      if (!confirm('Are you sure you want to start the timer for this task?')) return;
    }
    try {
      const res = await fetch(`/api/tasks/${id}/timer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        fetchTimer();
        if (action === 'stop') {
          fetchTask();
        }
      }
    } catch (err) {
      console.error('Timer action failed:', err);
    }
  }

  async function fetchTask() {
    try {
      const res = await fetch(`/api/tasks/${id}`);
      const data = await res.json();
      if (data.task) {
        setTask(data.task);
        setTitle(data.task.title);
        setDescription(data.task.description || '');
        setStatus(data.task.status);
        setPriority(data.task.priority);
        setAssignedTo(data.task.assigned_to || '');
        setModule(data.task.module || '');
        if (data.task.deadline) {
          const ds = String(data.task.deadline).split('T')[0].split(' ')[0]
          const parts = ds.split('-')
          if (parts.length === 3) {
            const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
            setDeadline(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
          } else {
            setDeadline(ds)
          }
        } else {
          setDeadline('');
        }
        setEstimatedHours(data.task.estimated_hours || '');
        setActualHours(data.task.actual_hours || '');
        setProgress(data.task.progress || 0);
        setDependsOn(data.task.depends_on || '');
        setApproved(!!data.task.approved_by);
        if (data.task.start_date) {
          const sds = String(data.task.start_date).split('T')[0].split(' ')[0]
          const sparts = sds.split('-')
          if (sparts.length === 3) {
            const sd = new Date(parseInt(sparts[0]), parseInt(sparts[1]) - 1, parseInt(sparts[2]))
            setStartDate(sd.getFullYear() + '-' + String(sd.getMonth()+1).padStart(2,'0') + '-' + String(sd.getDate()).padStart(2,'0'))
          }
        } else { setStartDate(''); }
        if (!data.task.estimated_hours && data.task.deadline) {
          const hours = calcWorkingHours(
            data.task.deadline.includes('T')
              ? data.task.deadline.split('T')[0]
              : String(data.task.deadline).split(' ')[0]
          );
          if (hours !== null) {
            setEstimatedHours(String(hours));
            updateField('estimated_hours', hours);
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch task:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchUsers() {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      setUsers(data.users || []);
        setAllUsers(data.users || []);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  }

  async function updateField(field, value) {
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      if (res.ok) {
        fetchTask();
      }
    } catch (err) {
      console.error('Failed to update task:', err);
    }
  }

  async function handleSaveAll() {
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          status,
          priority,
          assigned_to: assignedTo || null,
          module: module || null,
          deadline: deadline || null,
          estimated_hours: estimatedHours || null,
          actual_hours: actualHours || null,
          progress: progress || 0,
          start_date: startDate || null,
          depends_on: dependsOn || null,
          approved_by: approved ? user.id : null,
          approved_at: approved ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null,
        }),
      });
      if (res.ok) {
        fetchTask();
      }
    } catch (err) {
      console.error('Failed to update task:', err);
    }
  }

  async function handleAddCommit(e) {
    e.preventDefault();
    try {
      const res = await fetch(`/api/tasks/${id}/commits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(commitForm),
      });
      if (res.ok) {
        setShowAddCommit(false);
        setCommitForm({ commit_hash: '', message: '', author: '', additions: 0, deletions: 0 });
        fetchTask();
      }
    } catch (err) {
      console.error('Failed to add commit:', err);
    }
  }

  async function handleCommentPaste(e) {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (!file) return
        try {
          const compressed = await compressImage(file)
          setCommentImage(compressed)
          const reader = new FileReader()
          reader.onload = (ev) => setCommentImagePreview(ev.target.result)
          reader.readAsDataURL(compressed)
        } catch (err) {
          console.error('Failed to process pasted image:', err)
        }
        return
      }
    }
  }

  async function handleAddComment(e) {
    e.preventDefault();
    if (!commentText.trim() && !commentImage) return;
    setUploadingComment(true);
    try {
      let imageUrl = null;
      if (commentImage) {
        const formData = new FormData();
        formData.append('image', commentImage);
        const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          imageUrl = uploadData.url;
        }
      }
      const res = await fetch(`/api/tasks/${id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: commentText.trim() || '', image_url: imageUrl }),
      });
      if (res.ok) {
        setCommentText('');
        setCommentImage(null);
        setCommentImagePreview(null);
        fetchTask();
      }
    } catch (err) {
      console.error('Failed to add comment:', err);
    } finally {
      setUploadingComment(false);
    }
  }

  
  async function handleAddChecklistItem() {
    if (!newChecklistItem.trim()) return;
    try {
      const res = await fetch(`/api/tasks/${id}/checklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newChecklistItem.trim() }),
      });
      if (res.ok) { setNewChecklistItem(''); fetchChecklist(); }
    } catch (err) {}
  }
  async function handleToggleChecklist(itemId, checked) {
    try {
      await fetch(`/api/tasks/${id}/checklist`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId, is_checked: !checked }),
      });
      fetchChecklist();
    } catch (err) {}
  }
  async function handleDeleteChecklistItem(itemId) {
    try {
      await fetch(`/api/tasks/${id}/checklist?item_id=${itemId}`, { method: 'DELETE' });
      fetchChecklist();
    } catch (err) {}
  }
  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
      if (uploadRes.ok) {
        const data = await uploadRes.json();
        await fetch(`/api/tasks/${id}/attachments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: file.name, file_url: data.url, file_size: file.size, mime_type: file.type }),
        });
        fetchAttachments();
      }
    } catch (err) {}
    finally { setUploadingFile(false); }
  }
  async function handleDeleteAttachment(attachmentId) {
    try {
      await fetch(`/api/tasks/${id}/attachments?attachment_id=${attachmentId}`, { method: 'DELETE' });
      fetchAttachments();
    } catch (err) {}
  }
  async function handleApprove() {
    try {
      const newApproved = !approved;
      await fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved_by: newApproved ? user.id : null, approved_at: newApproved ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null }),
      });
      setApproved(newApproved);
      fetchTask();
    } catch (err) {}
  }

  async function handleDeleteTask() {
    try {
      const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/dashboard/projects/' + task.project_id);
      }
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  }

  async function handleDeleteComment() {
    try {
      await fetch(`/api/tasks/${id}/comments?comment_id=${deleteCommentId}`, { method: 'DELETE' });
      setDeleteCommentId(null);
      fetchTask();
    } catch (err) {
      console.error('Failed to delete comment:', err);
    }
  }

  if (loading) {
    return (
      <Layout>
        <Loading />
      </Layout>
    );
  }

  if (!task) {
    return (
      <Layout>
        <div className="p-6 text-center text-gray-400">Task not found</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        <div id="task-detail-content">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4 md:mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-400" />
            </button>
            <div className="flex-1 min-w-0">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => updateField('title', title)}
                readOnly={!canEditFields}
                className={`text-lg md:text-2xl font-bold bg-transparent border-none focus:outline-none focus:ring-0 w-full ${canEditFields ? 'text-white' : 'text-gray-300 cursor-not-allowed'}`}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <PdfExportButton elementId="task-detail-content" filename={`task-${task?.id || 'export'}.pdf`} label="Export PDF" />
            {canEditFields && (
              <button
                onClick={handleSaveAll}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-sm"
              >
                Save All
              </button>
            )}
            {approved && (
              <span className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-sm text-emerald-400">
                <CheckCircle2 className="w-4 h-4" /> Approved
              </span>
            )}
            {user?.role === 'admin' && (
              <button
                onClick={handleApprove}
                className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm transition-colors ${approved ? 'bg-gray-700 text-gray-400 hover:text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}
                title={approved ? 'Unapprove' : 'Approve task'}
              >
                <ClipboardCheck className="w-4 h-4" />
                <span className="hidden sm:inline">{approved ? 'Unapprove' : 'Approve'}</span>
              </button>
            )}
            {(user?.role === 'admin' || user?.id == task.created_by) && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                title="Delete task"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-400">Description</h3>
                <button onClick={() => setDescPreview(!descPreview)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-white transition-colors">
                  {descPreview ? <><EyeOff className="w-3.5 h-3.5" /> Edit</> : <><Eye className="w-3.5 h-3.5" /> Preview</>}
                </button>
              </div>
              {descPreview ? (
                <div className="prose prose-invert prose-sm max-w-none bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 min-h-[10rem] prose-headings:text-white prose-p:text-gray-300 prose-code:text-emerald-400 prose-code:bg-gray-800 prose-code:px-1 prose-code:rounded prose-a:text-indigo-400">
                  <Markdown remarkPlugins={[remarkGfm]}>{description || '_No description_'}</Markdown>
                </div>
              ) : (
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onBlur={() => updateField('description', description)}
                  readOnly={!canEditFields}
                  className={`w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 h-40 resize-none font-mono text-sm ${canEditFields ? 'text-white' : 'text-gray-300 cursor-not-allowed'}`}
                  placeholder="Write a description (supports markdown)..."
                />
              )}
            </div>

            <div className="bg-gray-800 rounded-xl border border-gray-700">
              <div className="flex overflow-x-auto border-b border-gray-700 scrollbar-hide">
                {[
                  { id: 'details', label: 'Details', icon: Clock },
                  { id: 'checklist', label: `Checklist (${checklist.filter(i => i.is_checked).length}/${checklist.length})`, icon: ClipboardCheck },
                  { id: 'commits', label: `Commits (${task.commits?.length || 0})`, icon: GitCommit },
                  { id: 'comments', label: `Comments (${task.comments?.length || 0})`, icon: MessageSquare },
                  { id: 'attachments', label: `Files (${attachments.length})`, icon: Paperclip },
                  { id: 'history', label: 'History', icon: History },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-3 text-xs md:text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex-shrink-0 ${
                      activeTab === tab.id
                        ? 'border-indigo-500 text-indigo-400'
                        : 'border-transparent text-gray-400 hover:text-white'
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="p-4">
                {activeTab === 'details' && (
                  <div className="space-y-4">
                    <div className="bg-gray-700/50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-gray-500">Progress</p>
                        <p className="text-sm text-white font-mono">{progress}%</p>
                      </div>
                      <div className="w-full h-3 bg-gray-600 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${progress >= 100 ? 'bg-emerald-500' : progress >= 50 ? 'bg-indigo-500' : 'bg-amber-500'}`} style={{ width: progress + '%' }} />
                      </div>
                    </div>
                    {startDate && (
                      <div className="bg-gray-700/50 rounded-lg p-4">
                        <p className="text-xs text-gray-500 mb-1">Start Date</p>
                        <p className="text-sm text-white">{new Date(startDate).toLocaleDateString('id-ID')}</p>
                      </div>
                    )}
                    {task.depends_on && (() => {
                      const depTask = allTasks.find(t => t.id == task.depends_on)
                      if (!depTask) return null
                      const isDone = depTask.status === 'done'
                      return (
                        <div className={`rounded-lg p-4 ${isDone ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
                          <p className="text-xs text-gray-500 mb-1">Depends On</p>
                          <div className="flex items-center gap-2">
                            {isDone ? <span className="w-2 h-2 rounded-full bg-emerald-400" /> : <AlertCircle className="w-4 h-4 text-red-400" />}
                            <a href={`/task/${depTask.id}`} className={`text-sm font-medium no-underline ${isDone ? 'text-emerald-400' : 'text-red-400'}`}>
                              #{depTask.id} - {depTask.title}
                            </a>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${isDone ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
                              {isDone ? 'Done' : depTask.status.replace('_', ' ')}
                            </span>
                          </div>
                        </div>
                      )
                    })()}
                    <div className="bg-gray-700/50 rounded-lg p-4">
                      <p className="text-xs text-gray-500 mb-1">Created</p>
                      <p className="text-sm text-white">{new Date(task.created_at).toLocaleString()}</p>
                    </div>
                    {task.assignee_name && (
                      <div className="bg-gray-700/50 rounded-lg p-4">
                        <p className="text-xs text-gray-500 mb-1">Assigned to</p>
                        <div className="flex items-center gap-2">
                           <Avatar name={task.assignee_name} avatarStyle={task.assignee_avatar_style} avatarSeed={task.assignee_avatar_seed} avatarOptions={task.assignee_avatar_options} size="sm" />
                          <span className="text-sm text-white">{task.assignee_name}</span>
                        </div>
                      </div>
                    )}
                    <div className="bg-gray-700/50 rounded-lg p-4">
                      <p className="text-xs text-gray-500 mb-1">Deadline</p>
                      <p className="text-sm text-white">{task.deadline ? new Date(((task.deadline || '').split('T')[0].split(' ')[0]) + 'T00:00:00').toLocaleDateString('id-ID') : 'Not set'}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-700/50 rounded-lg p-4">
                        <p className="text-xs text-gray-500 mb-1">Estimated Hours</p>
                        <p className="text-sm text-white">{task.estimated_hours || 'Not set'}</p>
                      </div>
                      <div className="bg-gray-700/50 rounded-lg p-4">
                        <p className="text-xs text-gray-500 mb-1">Actual Hours</p>
                        <p className="text-sm text-white">{task.actual_hours || 'Not set'}</p>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'checklist' && (
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <input type="text" value={newChecklistItem} onChange={(e) => setNewChecklistItem(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddChecklistItem(); } }} className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Add a subtask..." />
                      <button onClick={handleAddChecklistItem} className="p-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"><Plus className="w-4 h-4 text-white" /></button>
                    </div>
                    {checklist.length > 0 && (
                      <div className="mb-4">
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                          <span>{checklist.filter(i => i.is_checked).length} of {checklist.length} completed</span>
                          <span>{checklist.length > 0 ? Math.round((checklist.filter(i => i.is_checked).length / checklist.length) * 100) : 0}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: (checklist.length > 0 ? (checklist.filter(i => i.is_checked).length / checklist.length) * 100 : 0) + '%' }} />
                        </div>
                      </div>
                    )}
                    <div className="space-y-3">
                      {checklist.map(item => (
                        <ChecklistItem key={item.id} item={item} onToggle={handleToggleChecklist} onDelete={handleDeleteChecklistItem} taskId={id} onRefresh={fetchChecklist} isAdmin={user?.role === 'admin'} allUsers={allUsers} />
                      ))}
                      {checklist.length === 0 && <p className="text-gray-500 text-center py-4 text-sm">No subtasks yet</p>}
                    </div>
                  </div>
                )}

                {activeTab === 'commits' && (
                  <div>
                    <div className="flex justify-end mb-3">
                      <button
                        onClick={() => setShowAddCommit(true)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-gray-300 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Add Commit
                      </button>
                    </div>
                    {task.commits?.length > 0 ? (
                      task.commits.map((commit) => (
                        <CommitRow key={commit.id} commit={commit} />
                      ))
                    ) : (
                      <p className="text-gray-500 text-center py-8">No commits yet</p>
                    )}
                  </div>
                )}

                {activeTab === 'comments' && (
                  <div>
                    {task.comments?.map((comment) => (
                      <CommentItem
                        key={comment.id}
                        comment={comment}
                        onDelete={(cid) => { setDeleteCommentId(cid); setShowDeleteCommentConfirm(true); }}
                        allTasks={allTasks}
                        allUsers={allUsers}
                        canDeleteAny={user?.role === 'admin'}
                      />
                    ))}
                    {(!task.comments || task.comments.length === 0) && (
                      <p className="text-gray-500 text-center py-8">No comments yet</p>
                    )}
                  </div>
                )}

                {activeTab === 'attachments' && (
                  <div>
                    <div className="mb-3">
                      <label className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-gray-300 cursor-pointer transition-colors w-fit">
                        <Paperclip className="w-4 h-4" />
                        {uploadingFile ? 'Uploading...' : 'Attach File'}
                        <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploadingFile} />
                      </label>
                    </div>
                    {attachments.length > 0 ? (
                      <div className="space-y-2">
                        {attachments.map(att => (
                          <div key={att.id} className="flex items-center gap-3 p-3 bg-gray-700/50 rounded-lg">
                            <FileText className="w-5 h-5 text-gray-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <a href={att.file_url} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-400 hover:underline truncate block">{att.filename}</a>
                              <p className="text-xs text-gray-500">{att.uploaded_by_name} \u2022 {att.file_size ? (att.file_size / 1024).toFixed(1) + ' KB' : 'Unknown size'} \u2022 {new Date(att.created_at).toLocaleDateString('id-ID')}</p>
                            </div>
                            <a href={att.file_url} download className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-600 rounded-lg transition-colors"><Download className="w-4 h-4" /></a>
                            {(user?.role === 'admin' || user?.id === att.uploaded_by) && (
                              <button onClick={() => handleDeleteAttachment(att.id)} className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-600 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-gray-500 text-center py-4 text-sm">No files attached</p>}
                  </div>
                )}

                {activeTab === 'history' && (
                  <div>
                    {task.history?.map((entry) => (
                      <HistoryItem key={entry.id} entry={entry} />
                    ))}
                    {(!task.history || task.history.length === 0) && (
                      <p className="text-gray-500 text-center py-8">No history yet</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 space-y-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => { const v = e.target.value; setStatus(v); if (v === 'in_progress' && !startDate) { const now = new Date(); const ds = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0'); setStartDate(ds); updateField('status', v); updateField('start_date', ds); } else { updateField('status', v); } }}
                  disabled={!canEditFields}
                  className={`w-full px-3 py-2 rounded-lg text-sm border border-gray-600 focus:ring-2 focus:ring-indigo-500 focus:outline-none ${canEditFields ? 'bg-gray-700 text-white' : 'bg-gray-700/50 text-gray-400 cursor-not-allowed'}`}
                >
                  <option value="todo">Todo</option>
                  <option value="in_progress">In Progress</option>
                  <option value="review">Review</option>
                  <option value="done">Done</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => { setPriority(e.target.value); updateField('priority', e.target.value); }}
                  disabled={!canEditFields}
                  className={`w-full px-3 py-2 rounded-lg text-sm border border-gray-600 focus:ring-2 focus:ring-indigo-500 focus:outline-none ${canEditFields ? 'bg-gray-700 text-white' : 'bg-gray-700/50 text-gray-400 cursor-not-allowed'}`}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Assignee</label>
                <select
                  value={assignedTo}
                  onChange={(e) => { setAssignedTo(e.target.value); updateField('assigned_to', e.target.value || null); }}
                  disabled={!canEditFields}
                  className={`w-full px-3 py-2 rounded-lg text-sm border border-gray-600 focus:ring-2 focus:ring-indigo-500 focus:outline-none ${canEditFields ? 'bg-gray-700 text-white' : 'bg-gray-700/50 text-gray-400 cursor-not-allowed'}`}
                >
                  <option value="">Unassigned</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Deadline</label>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => {
                    setDeadline(e.target.value);
                    if (!estimatedHours && e.target.value) {
                      const hours = calcWorkingHours(e.target.value);
                      if (hours !== null) setEstimatedHours(String(hours));
                    }
                  }}
                  onBlur={() => updateField('deadline', deadline || null)}
                  disabled={!canEditFields}
                  className={`w-full px-3 py-2 rounded-lg text-sm border border-gray-600 focus:ring-2 focus:ring-indigo-500 focus:outline-none ${canEditFields ? 'bg-gray-700 text-white' : 'bg-gray-700/50 text-gray-400 cursor-not-allowed'}`}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Module</label>
                <select
                  value={module}
                  onChange={(e) => { setModule(e.target.value); updateField('module', e.target.value || null); }}
                  disabled={!canEditFields}
                  className={`w-full px-3 py-2 rounded-lg text-sm border border-gray-600 focus:ring-2 focus:ring-indigo-500 focus:outline-none ${canEditFields ? 'bg-gray-700 text-white' : 'bg-gray-700/50 text-gray-400 cursor-not-allowed'}`}
                >
                  <option value="">No Module</option>
                  {modules.map((m) => (
                    <option key={m.id} value={m.name}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Est. Hours</label>
                  <input
                    type="number"
                    value={estimatedHours}
                    onChange={(e) => setEstimatedHours(e.target.value)}
                    onBlur={() => updateField('estimated_hours', estimatedHours || null)}
                    disabled={!canEditFields}
                    min="0"
                    step="0.5"
                    className={`w-full px-3 py-2 rounded-lg text-sm border border-gray-600 focus:ring-2 focus:ring-indigo-500 focus:outline-none ${canEditFields ? 'bg-gray-700 text-white' : 'bg-gray-700/50 text-gray-400 cursor-not-allowed'}`}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Actual Hours</label>
                  <input
                    type="number"
                    value={actualHours}
                    onChange={(e) => setActualHours(e.target.value)}
                    onBlur={() => updateField('actual_hours', actualHours || null)}
                    disabled={!canEditFields}
                    min="0"
                    step="0.5"
                    className={`w-full px-3 py-2 rounded-lg text-sm border border-gray-600 focus:ring-2 focus:ring-indigo-500 focus:outline-none ${canEditFields ? 'bg-gray-700 text-white' : 'bg-gray-700/50 text-gray-400 cursor-not-allowed'}`}
                  />
                </div>
              </div>
            </div>

            {user?.role === 'admin' ? (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Progress</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range" min="0" max="100" value={progress}
                    onChange={(e) => setProgress(parseInt(e.target.value))}
                    onMouseUp={() => updateField('progress', progress)}
                    onTouchEnd={() => updateField('progress', progress)}
                    disabled={!canEditFields}
                    className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                  <span className="text-sm text-white font-mono w-10 text-right">{progress}%</span>
                </div>
                <div className="w-full h-2 bg-gray-700 rounded-full mt-2 overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${progress >= 100 ? 'bg-emerald-500' : progress >= 50 ? 'bg-indigo-500' : 'bg-amber-500'}`} style={{ width: progress + '%' }} />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Progress</label>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${progress >= 100 ? 'bg-emerald-500' : progress >= 50 ? 'bg-indigo-500' : 'bg-amber-500'}`} style={{ width: progress + '%' }} />
                  </div>
                  <span className="text-sm text-white font-mono w-10 text-right">{progress}%</span>
                </div>
                <p className="text-[10px] text-gray-600 mt-1">Only admin can update progress</p>
              </div>
            )}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Start Date</label>
                <input
                  type="date" value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  onBlur={() => updateField('start_date', startDate || null)}
                  disabled={!canEditFields}
                  className={`w-full px-3 py-2 rounded-lg text-sm border border-gray-600 focus:ring-2 focus:ring-indigo-500 focus:outline-none ${canEditFields ? 'bg-gray-700 text-white' : 'bg-gray-700/50 text-gray-400 cursor-not-allowed'}`}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Depends On</label>
                <select
                  value={dependsOn}
                  onChange={(e) => { setDependsOn(e.target.value); updateField('depends_on', e.target.value || null); }}
                  disabled={!canEditFields}
                  className={`w-full px-3 py-2 rounded-lg text-sm border border-gray-600 focus:ring-2 focus:ring-indigo-500 focus:outline-none ${canEditFields ? 'bg-gray-700 text-white' : 'bg-gray-700/50 text-gray-400 cursor-not-allowed'}`}
                >
                  <option value="">No Dependency</option>
                  {allTasks.filter(t => t.id !== parseInt(id)).map(t => (
                    <option key={t.id} value={t.id}>#{t.id} - {t.title}</option>
                  ))}
                </select>
                {dependsOn && (() => {
                  const depTask = allTasks.find(t => t.id == dependsOn)
                  if (!depTask) return null
                  const isDone = depTask.status === 'done'
                  return (
                    <div className={`flex items-center gap-2 mt-2 px-3 py-2 rounded-lg text-xs ${isDone ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                      {isDone ? <span className="w-2 h-2 rounded-full bg-emerald-400" /> : <AlertCircle className="w-3.5 h-3.5" />}
                      {isDone ? 'Dependency completed' : `Blocked: ${depTask.title} is ${depTask.status.replace('_', ' ')}`}
                    </div>
                  )
                })()}
              </div>

            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <label className="block text-xs text-gray-500 mb-2">Timer</label>
              <div className="flex items-center gap-3">
                <span className={`font-mono text-lg ${timerState.is_running ? 'text-emerald-400' : 'text-gray-300'}`}>{timerDisplay}</span>
                <div className="flex gap-2 ml-auto">
                  {!timerState.is_running ? (
                    <button onClick={() => handleTimerAction('start')} className="p-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors">
                      <Play className="w-4 h-4 text-white" />
                    </button>
                  ) : (
                    <button onClick={() => handleTimerAction('stop')} className="p-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors">
                      <Square className="w-4 h-4 text-white" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <h4 className="text-xs text-gray-500 mb-3">Add Comment</h4>
              {commentImagePreview && (
                <div className="relative mb-3">
                  <img src={commentImagePreview} alt="Preview" className="max-h-40 rounded-lg border border-gray-600" />
                  <button
                    onClick={() => { setCommentImage(null); setCommentImagePreview(null); }}
                    className="absolute top-2 right-2 p-1 bg-gray-900/80 rounded-full text-gray-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              <div className="relative">
                <textarea
                  ref={commentRef}
                  value={commentText}
                  onChange={handleCommentChange}
                  onKeyDown={handleCommentKeyDown}
                  onPaste={handleCommentPaste}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none h-20"
                  placeholder="Write a comment..."
                />
                {showTaskMention && mentionType === '@' && userMentionCandidates.length > 0 && (
                  <div className="absolute bottom-full left-0 w-full mb-1 bg-gray-700 border border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto z-20">
                    {userMentionCandidates.map((u, i) => (
                      <button
                        key={u.id}
                        onMouseDown={(e) => { e.preventDefault(); insertUserMention(u); }}
                        className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${i === mentionSelectedIdx ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-600'}`}
                      >
                        <User className="w-4 h-4 text-indigo-400" /> {u.name}
                      </button>
                    ))}
                  </div>
                )}
                {showTaskMention && mentionType === '~' && taskMentionCandidates.length > 0 && (
                  <div className="absolute bottom-full left-0 w-full mb-1 bg-gray-700 border border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto z-20">
                    {taskMentionCandidates.map((t, i) => (
                      <button
                        key={t.id}
                        onMouseDown={(e) => { e.preventDefault(); insertTaskMention(t); }}
                        className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${i === mentionSelectedIdx ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-600'}`}
                      >
                        <span className="text-gray-500">#{t.id}</span> {t.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <button onClick={() => commentFileRef.current?.click()} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors" title="Add image">
                  <ImageIcon className="w-4 h-4" />
                </button>
                <input ref={commentFileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setCommentImage(f); const r = new FileReader(); r.onload = (ev) => setCommentImagePreview(ev.target.result); r.readAsDataURL(f); } }} />
                <button onClick={() => startScreenCapture()} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors" title="Snip">
                  <Scan className="w-4 h-4" />
                </button>
                <button onClick={() => openSnippingFromFile()} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors" title="Edit image">
                  <Scissors className="w-4 h-4" />
                </button>
                <button
                  type="submit"
                  form="comment-form"
                  disabled={uploadingComment || (!commentText.trim() && !commentImage)}
                  onClick={handleAddComment}
                  className="ml-auto px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm transition-colors"
                >
                  {uploadingComment ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {showAddCommit && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md border border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Add Commit</h3>
                <button onClick={() => setShowAddCommit(false)} className="text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleAddCommit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Commit Hash</label>
                  <input
                    type="text"
                    value={commitForm.commit_hash}
                    onChange={(e) => setCommitForm({ ...commitForm, commit_hash: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    placeholder="abc1234"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Message</label>
                  <input
                    type="text"
                    value={commitForm.message}
                    onChange={(e) => setCommitForm({ ...commitForm, message: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Fix login bug"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Author</label>
                  <input
                    type="text"
                    value={commitForm.author}
                    onChange={(e) => setCommitForm({ ...commitForm, author: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Author name"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Additions (+)</label>
                    <input
                      type="number"
                      value={commitForm.additions}
                      onChange={(e) => setCommitForm({ ...commitForm, additions: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Deletions (-)</label>
                    <input
                      type="number"
                      value={commitForm.deletions}
                      onChange={(e) => setCommitForm({ ...commitForm, deletions: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      min="0"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddCommit(false)}
                    className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                  >
                    Add Commit
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
        </div>
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteTask}
        title="Delete Task"
        message={`Are you sure you want to delete "${task?.title}"? This will permanently remove the task, all its commits, comments, and history. This action cannot be undone.`}
        confirmText="Delete Task"
        confirmColor="bg-red-600 hover:bg-red-700"
      />
      <ConfirmDialog
        isOpen={showDeleteCommentConfirm}
        onClose={() => { setShowDeleteCommentConfirm(false); setDeleteCommentId(null); }}
        onConfirm={handleDeleteComment}
        title="Delete Comment"
        message="Are you sure you want to delete this comment? This action cannot be undone."
        confirmText="Delete"
      />
      <SnippingEditor
        open={showSnipping}
        onClose={() => { setShowSnipping(false); setSnippingImage(null) }}
        onSave={handleSnippingSave}
        imageSrc={snippingImage}
      />
    </Layout>
  );
}
