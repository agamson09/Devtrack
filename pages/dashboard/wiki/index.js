import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/layout/Layout';
import { useAuth } from '@/components/AuthContext';
import { useToast } from '@/components/ToastContext';
import Loading from '@/components/common/Loading';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Plus, Search, Pencil, Trash2, ArrowLeft, Link2, X } from 'lucide-react';
import { csrfFetch } from '@/lib/csrfFetch';

const EMPTY_DRAFT = { title: '', content: '', tags: '', project_id: '' };

function slugify(text) {
  return String(text).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function formatDate(d) {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return d;
  }
}

/** Convert [[wikilinks]] to markdown links the renderer can intercept. */
function renderContent(content) {
  return String(content || '').replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, target, label) =>
    `[${label || target}](wikilink:${encodeURIComponent(target.trim())})`
  );
}

export default function WikiPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [note, setNote] = useState(null);
  const [backlinks, setBacklinks] = useState([]);
  const [noteLoading, setNoteLoading] = useState(false);
  const [mode, setMode] = useState('view'); // view | edit | create
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [showPreview, setShowPreview] = useState(true);
  const [query, setQuery] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [projects, setProjects] = useState([]);

  // ---- data loading -------------------------------------------------------
  const fetchNotes = useCallback(async () => {
    try {
      const res = await fetch('/api/wiki');
      const data = await res.json();
      setNotes(data.notes || []);
    } catch (err) {
      console.error('Failed to fetch wiki notes:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  useEffect(() => {
    fetch('/api/projects')
      .then(r => r.json())
      .then(d => setProjects((d.projects || []).filter(p => p.status !== 'archived')))
      .catch(() => {});
  }, []);

  // Deep-link support: /dashboard/wiki?note=12
  useEffect(() => {
    const qid = router.query.note ? Number(router.query.note) : null;
    setSelectedId(qid && notes.some(n => n.id === qid) ? qid : null);
    if (!router.query.note) setSelectedId(prev => (prev === null ? null : prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.query.note]);

  // Command Palette: open the "new note" form when dispatched from anywhere
  useEffect(() => {
    const handler = () => startCreate();
    window.addEventListener('devtrack:new-wiki-note', handler);
    return () => window.removeEventListener('devtrack:new-wiki-note', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedId) { setNote(null); return; }
    let cancelled = false;
    setNoteLoading(true);
    fetch(`/api/wiki/${selectedId}`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        if (data.note) {
          setNote(data.note);
          setBacklinks(data.backlinks || []);
        } else {
          showToast('error', data.error || 'Catatan tidak ditemukan');
          selectNote(null);
        }
      })
      .catch(() => !cancelled && showToast('error', 'Gagal memuat catatan'))
      .finally(() => !cancelled && setNoteLoading(false));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  function selectNote(id) {
    router.replace(id ? `/dashboard/wiki?note=${id}` : '/dashboard/wiki', undefined, { shallow: true });
    setSelectedId(id);
    setMode('view');
  }

  // ---- derived ------------------------------------------------------------
  const allTags = useMemo(() => {
    const set = new Set();
    for (const n of notes) {
      (n.tags || '').split(',').map(t => t.trim()).filter(Boolean).forEach(t => set.add(t));
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [notes]);

  const filteredNotes = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notes.filter(n => {
      if (tagFilter && !(n.tags || '').toLowerCase().includes(tagFilter.toLowerCase())) return false;
      if (!q) return true;
      return n.title.toLowerCase().includes(q) || (n.tags || '').toLowerCase().includes(q);
    });
  }, [notes, query, tagFilter]);

  const canEdit = note && (user?.role === 'admin' || user?.id === note.created_by);

  // ---- actions ------------------------------------------------------------
  async function saveDraft() {
    if (!draft.title.trim()) return showToast('error', 'Judul wajib diisi');
    try {
      const payload = {
        title: draft.title,
        content: draft.content,
        tags: draft.tags,
        project_id: draft.project_id ? Number(draft.project_id) : undefined,
      };
      let res;
      if (mode === 'create') {
        res = await csrfFetch('/api/wiki', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      } else {
        res = await csrfFetch(`/api/wiki/${selectedId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.details?.join(', ') || data.error || 'Gagal menyimpan');
      }
      const data = await res.json();
      showToast('success', mode === 'create' ? 'Catatan dibuat' : 'Catatan disimpan');
      await fetchNotes();
      selectNote(data.note.id);
    } catch (err) {
      console.error(err);
      showToast('error', err.message || 'Gagal menyimpan catatan');
    }
  }

  async function deleteNote() {
    if (!confirm(`Hapus catatan "${note.title}"?`)) return;
    try {
      const res = await csrfFetch(`/api/wiki/${note.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete failed');
      showToast('success', 'Catatan dihapus');
      setNotes(prev => prev.filter(n => n.id !== note.id));
      selectNote(null);
    } catch (err) {
      console.error(err);
      showToast('error', 'Gagal menghapus catatan');
    }
  }

  function startCreate(prefillTitle = '') {
    setDraft({ ...EMPTY_DRAFT, title: prefillTitle });
    setShowPreview(false);
    setMode('create');
  }

  function startEdit() {
    setDraft({
      title: note.title,
      content: note.content || '',
      tags: note.tags || '',
      project_id: note.project_id ? String(note.project_id) : '',
    });
    setMode('edit');
  }

  /** Follow a [[wikilink]]; create the note on the fly when it does not exist yet. */
  function followLink(target) {
    const norm = slugify(target);
    const found = notes.find(n => n.slug === norm || n.slug === norm.replace(/-+/g, '-') || n.title.toLowerCase() === target.trim().toLowerCase());
    if (found) {
      selectNote(found.id);
    } else {
      showToast('info', `Catatan "${target}" belum ada — buat sekarang.`);
      startCreate(target);
    }
  }

  // ---- markdown components ------------------------------------------------
  const mdComponents = useMemo(() => ({
    a: ({ href, children }) => {
      if (href && href.startsWith('wikilink:')) {
        const target = decodeURIComponent(href.slice('wikilink:'.length));
        const exists = notes.some(n => n.slug === slugify(target) || n.title.toLowerCase() === target.toLowerCase());
        return (
          <button
            onClick={(e) => { e.preventDefault(); followLink(target); }}
            className={`inline-flex items-center gap-1 align-baseline px-0.5 rounded transition-colors ${exists ? 'text-indigo-300 hover:text-indigo-200 hover:bg-indigo-500/10' : 'text-red-300/90 hover:text-red-200 hover:bg-red-500/10 border-b border-dashed border-current'}`}
            title={exists ? `Buka: ${target}` : `Buat catatan: ${target}`}
          >
            <Link2 className="w-3 h-3 inline" />
            {children}
          </button>
        );
      }
      return <a href={href} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 underline">{children}</a>;
    },
    h1: (p) => <h1 className="text-2xl font-bold text-white mt-6 mb-3 first:mt-0" {...p} />,
    h2: (p) => <h2 className="text-xl font-bold text-white mt-6 mb-2" {...p} />,
    h3: (p) => <h3 className="text-lg font-semibold text-gray-100 mt-4 mb-2" {...p} />,
    p: (p) => <p className="text-gray-300 leading-relaxed my-3" {...p} />,
    ul: (p) => <ul className="list-disc pl-6 text-gray-300 my-3 space-y-1" {...p} />,
    ol: (p) => <ol className="list-decimal pl-6 text-gray-300 my-3 space-y-1" {...p} />,
    blockquote: (p) => <blockquote className="border-l-4 border-indigo-500/50 bg-indigo-500/5 pl-4 py-1 my-3 text-gray-300 italic" {...p} />,
    code: ({ className, children }) =>
      className ? <code className={`${className} block bg-gray-900 rounded-lg p-4 my-3 text-sm overflow-x-auto text-emerald-200`} >{children}</code>
        : <code className="bg-gray-900 rounded px-1.5 py-0.5 text-sm text-emerald-200">{children}</code>,
    table: (p) => <div className="overflow-x-auto my-3"><table className="min-w-full text-sm border border-gray-700 rounded-lg" {...p} /></div>,
    th: (p) => <th className="border-b border-gray-700 px-3 py-2 text-left text-gray-200 bg-gray-800/60" {...p} />,
    td: (p) => <td className="border-b border-gray-700/60 px-3 py-2 text-gray-300" {...p} />,
    hr: () => <hr className="border-gray-700 my-5" />,
  }), [notes]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- render helpers -----------------------------------------------------
  function editorPane(withPreview) {
    return (
      <div className={`flex flex-col ${withPreview ? 'md:flex-row gap-4' : ''}`}>
        <textarea
          value={draft.content}
          onChange={(e) => setDraft({ ...draft, content: e.target.value })}
          placeholder={'Tulis catatan di sini...\n\nDukungan: **bold**, *italic*, # heading, - list, `kode`, tabel,\ndan taut antar catatan dengan [[Nama Catatan]]'}
          className={`input-field font-mono text-sm leading-relaxed min-h-[55vh] resize-y ${withPreview ? 'md:w-1/2' : ''}`}
        />
        {withPreview && (
          <div className="md:w-1/2 min-h-[55vh] overflow-y-auto glass-panel !rounded-lg p-5">
            {draft.content.trim()
              ? <Markdown remarkPlugins={[remarkGfm]} components={mdComponents}>{renderContent(draft.content)}</Markdown>
              : <p className="text-gray-600 text-sm">Preview kosong…</p>}
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return <Layout><Loading /></Layout>;
  }

  return (
    <Layout>
      <div className="flex gap-4 lg:gap-6" style={{ height: 'calc(100vh - 8rem)' }}>
        {/* Sidebar list */}
        <aside className="hidden md:flex w-64 lg:w-72 flex-col flex-shrink-0 bg-gray-800/50 border border-gray-700/60 rounded-xl overflow-hidden">
          <div className="p-3 space-y-2 border-b border-gray-700/60">
            <button onClick={() => startCreate()} className="btn-primary w-full flex items-center justify-center gap-2 text-sm">
              <Plus className="w-4 h-4" /> Catatan Baru
            </button>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari catatan..."
                className="w-full pl-9 pr-3 py-2 bg-gray-900/70 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
              />
            </div>
            {allTags.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {allTags.slice(0, 12).map(t => (
                  <button
                    key={t}
                    onClick={() => setTagFilter(tagFilter === t ? '' : t)}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${tagFilter === t ? 'bg-indigo-500 text-white' : 'bg-gray-700/70 text-gray-400 hover:text-white'}`}
                  >
                    #{t}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredNotes.length === 0 && (
              <p className="text-gray-600 text-xs text-center pt-8">
                {query || tagFilter ? 'Tidak ada hasil' : 'Belum ada catatan.\nBuat yang pertama!'}
              </p>
            )}
            {filteredNotes.map(n => (
              <button
                key={n.id}
                onClick={() => selectNote(n.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${n.id === selectedId ? 'bg-indigo-500/15 ring-1 ring-indigo-500/40' : 'hover:bg-gray-700/50'}`}
              >
                <p className={`text-sm font-medium truncate ${n.id === selectedId ? 'text-indigo-200' : 'text-gray-200'}`}>{n.title}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] text-gray-500">{formatDate(n.updated_at)}</span>
                  {(n.tags || '').split(',').filter(Boolean).slice(0, 2).map(t => (
                    <span key={t} className="text-[9px] text-indigo-300/80">#{t.trim()}</span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </aside>

        {/* Main pane */}
        <main className="flex-1 min-w-0 overflow-y-auto">
          {mode === 'create' || mode === 'edit' ? (
            /* ---------- EDITOR ---------- */
            <div className="glass-panel p-5 md:p-6 animate-fade-in-up">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold gradient-text">{mode === 'create' ? 'Catatan Baru' : 'Edit Catatan'}</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowPreview(!showPreview)}
                    className={`btn-secondary !py-1.5 !px-3 text-xs ${showPreview ? '!bg-indigo-500/20 !text-indigo-300' : ''}`}
                  >
                    Preview
                  </button>
                  <button onClick={() => setMode('view')} className="btn-secondary !py-1.5 !px-3 text-xs" type="button">
                    Cancel
                  </button>
                  <button onClick={saveDraft} className="btn-primary !py-1.5 !px-4 text-xs">Simpan</button>
                </div>
              </div>

              <div className="space-y-3 mb-4">
                <input
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  placeholder="Judul catatan"
                  className="w-full bg-transparent border-none text-2xl font-bold text-white placeholder-gray-600 focus:outline-none focus:ring-0"
                  autoFocus
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    value={draft.tags}
                    onChange={(e) => setDraft({ ...draft, tags: e.target.value })}
                    placeholder="Tag (pisahkan koma): sop, devops"
                    className="input-field !py-2 text-sm"
                  />
                  <select
                    value={draft.project_id}
                    onChange={(e) => setDraft({ ...draft, project_id: e.target.value })}
                    className="input-field !py-2 text-sm"
                  >
                    <option value="">Tanpa proyek</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>

              {editorPane(showPreview)}
            </div>
          ) : note ? (
            /* ---------- VIEW ---------- */
            <article className="glass-panel p-5 md:p-8 animate-fade-in-up max-w-4xl mx-auto">
              <div className="flex items-start justify-between gap-3 mb-1">
                <h1 className="text-2xl md:text-3xl font-bold text-white">{note.title}</h1>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {canEdit && (
                    <button onClick={startEdit} className="p-2 text-gray-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-lg transition-colors" title="Edit">
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                  {canEdit && (
                    <button onClick={deleteNote} className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => selectNote(null)} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors" title="Close">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 mb-5">
                <span>oleh <span className="text-gray-400">{note.author_name}</span></span>
                <span>·</span>
                <span>diubah {formatDate(note.updated_at)}</span>
                {note.project_name && (
                  <>
                    <span>·</span>
                    <span className="bg-violet-500/15 text-violet-300 px-2 py-0.5 rounded-full">{note.project_name}</span>
                  </>
                )}
                {(note.tags || '').split(',').filter(Boolean).map(t => (
                  <button key={t} onClick={() => { setTagFilter(t.trim()); selectNote(null); }} className="text-indigo-300/90 hover:text-indigo-200">
                    #{t.trim()}
                  </button>
                ))}
              </div>

              <Markdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                {renderContent(note.content)}
              </Markdown>

              {backlinks.length > 0 && (
                <div className="mt-10 pt-5 border-t border-gray-700/60">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-1.5">
                    <Link2 className="w-3.5 h-3.5" /> Ditautkan dari ({backlinks.length})
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {backlinks.map(b => (
                      <button
                        key={b.id}
                        onClick={() => selectNote(b.id)}
                        className="px-3 py-1.5 bg-gray-700/60 hover:bg-indigo-500/20 text-gray-300 hover:text-indigo-200 text-xs rounded-lg transition-colors"
                      >
                        {b.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </article>
          ) : (
            /* ---------- EMPTY STATE ---------- */
            <div className="h-full flex flex-col items-center justify-center text-center px-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-glow mb-4">
                <i className="fa-solid fa-book-open text-white text-2xl"></i>
              </div>
              <h2 className="text-xl font-bold gradient-text mb-1">Knowledge Base Tim</h2>
              <p className="text-gray-500 text-sm max-w-md mb-5">
                Simpan SOP, dokumentasi, meeting notes, dan panduan di sini.
                Tautkan antar catatan dengan <code className="text-indigo-300 bg-gray-800 px-1.5 py-0.5 rounded">[[Nama Catatan]]</code>.
              </p>
              <button onClick={() => startCreate()} className="btn-primary flex items-center gap-2">
                <Plus className="w-4 h-4" /> Tulis Catatan Pertama
              </button>
            </div>
          )}
        </main>
      </div>
    </Layout>
  );
}
