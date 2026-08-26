import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/layout/Layout';
import Loading from '@/components/common/Loading';
import Toast from '@/components/common/Toast';
import { Activity, Plus, Trash2, RefreshCw, Pencil, Globe, Clock } from 'lucide-react';

function StatusPill({ status }) {
  const map = {
    up: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
    down: 'bg-red-500/10 border-red-500/30 text-red-300',
    paused: 'bg-gray-500/10 border-gray-500/30 text-gray-400',
  };
  const icon = status === 'up' ? '✓' : status === 'down' ? '✗' : '❚❚';
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full border uppercase font-semibold ${map[status] || map.paused}`}>
      {icon} {status}
    </span>
  );
}

export default function UptimePage() {
  const [monitors, setMonitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ id: null, name: '', url: '', method: 'HEAD', interval_seconds: 60, enabled: true });
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(null);

  const fetchMonitors = useCallback(async () => {
    try {
      const res = await fetch('/api/uptime');
      const d = await res.json();
      setMonitors(d.monitors || []);
    } catch {}
  }, []);

  useEffect(() => { fetchMonitors() }, [fetchMonitors]);

  function openForm(m = null) {
    setForm(m
      ? { id: m.id, name: m.name, url: m.url, method: m.method || 'HEAD', interval_seconds: m.interval_seconds || 60, enabled: !!m.enabled }
      : { id: null, name: '', url: '', method: 'HEAD', interval_seconds: 60, enabled: true });
    setModal(true);
  }

  async function saveForm(e) {
    e?.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/uptime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (d.success) {
        setToast({ type: 'success', message: 'Monitor tersimpan' });
        setModal(false);
        fetchMonitors();
      } else {
        setToast({ type: 'error', message: d.error || 'Save failed' });
      }
    } catch {
      setToast({ type: 'error', message: 'Save failed' });
    } finally {
      setSaving(false);
    }
  }

  async function deleteMonitor(id) {
    if (!confirm('Hapus monitor ini?')) return;
    await fetch(`/api/uptime?id=${id}`, { method: 'DELETE' }).catch(() => {});
    fetchMonitors();
  }

  async function checkNow(id) {
    setChecking(id);
    try {
      const res = await fetch('/api/uptime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check', id }),
      });
      const d = await res.json();
      if (d.success) {
        setToast({ type: d.status === 'up' ? 'success' : 'error', message: `${d.status.toUpperCase()} — ${d.statusCode || d.error || ''} (${d.responseMs}ms)` });
      } else {
        setToast({ type: 'error', message: d.error || 'Check failed' });
      }
      fetchMonitors();
    } catch {
      setToast({ type: 'error', message: 'Check failed' });
    } finally {
      setChecking(null);
    }
  }

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Activity className="w-6 h-6 text-emerald-400" />
            <h1 className="text-2xl font-bold text-white">Uptime Monitor</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchMonitors} className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-gray-300 transition-colors">
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
            <button onClick={() => openForm()} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-sm text-white font-medium transition-colors">
              <Plus className="w-4 h-4" /> Monitor Baru
            </button>
          </div>
        </div>

        <p className="text-xs text-gray-500 -mt-3">
          Pantau URL/portal eksternal — dicek otomatis tiap interval, notifikasi Telegram saat down/up. (Checker jalan di server; butuh <code className="bg-gray-800 px-1 rounded">TELEGRAM_BOT_TOKEN</code> untuk notifikasi.)
        </p>

        {monitors.length === 0 ? (
          <div className="bg-gray-800 rounded-xl border border-dashed border-gray-700 p-12 text-center text-gray-500">
            <Globe className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Belum ada monitor. Tambahkan URL yang mau dipantau.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {monitors.map((m) => (
              <div key={m.id} className="bg-gray-800 rounded-xl border border-gray-700 p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-white font-semibold truncate">{m.name}</h3>
                      <StatusPill status={m.enabled ? m.last_status : 'paused'} />
                    </div>
                    <p className="text-xs text-gray-500 font-mono truncate mt-1 flex items-center gap-1">
                      <Globe className="w-3 h-3 flex-shrink-0" /> {m.url}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => checkNow(m.id)} disabled={checking === m.id}
                      className="p-1.5 text-gray-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-md transition-colors" title="Check now">
                      <i className={`fa-solid ${checking === m.id ? 'fa-spinner fa-spin' : 'fa-wave-square'} text-xs`}></i>
                    </button>
                    <button onClick={() => openForm(m)} className="p-1.5 text-gray-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-md transition-colors" title="Edit">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => deleteMonitor(m.id)} className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors" title="Hapus">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-gray-900/60 rounded-lg px-3 py-2">
                    <p className="text-[10px] text-gray-500 uppercase">Uptime 24 jam</p>
                    <p className="text-sm font-bold text-white">{m.uptime_24h != null ? `${m.uptime_24h}%` : '—'}</p>
                  </div>
                  <div className="bg-gray-900/60 rounded-lg px-3 py-2">
                    <p className="text-[10px] text-gray-500 uppercase">Respons</p>
                    <p className="text-sm font-bold text-white">{m.avg_response_ms != null ? `${m.avg_response_ms} ms` : '—'}</p>
                  </div>
                  <div className="bg-gray-900/60 rounded-lg px-3 py-2">
                    <p className="text-[10px] text-gray-500 uppercase">Interval</p>
                    <p className="text-sm font-bold text-white flex items-center gap-1"><Clock className="w-3 h-3" />{m.interval_seconds}s</p>
                  </div>
                </div>
                {m.last_checked_at && (
                  <p className="text-[10px] text-gray-600">Terakhir dicek: {new Date(m.last_checked_at).toLocaleString('id-ID')}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4" onClick={() => setModal(false)}>
          <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-700">
              <h3 className="text-white font-bold">{form.id ? 'Edit Monitor' : 'Monitor Baru'}</h3>
            </div>
            <form onSubmit={saveForm} className="p-5 space-y-3">
              <div>
                <label className="block text-[10px] text-gray-500 mb-1">Nama *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Portal Utama" required className="input-field !py-2 text-xs" />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-1">URL *</label>
                <input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://portal.company.com" required className="input-field !py-2 text-xs font-mono" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] text-gray-500 mb-1">Method</label>
                  <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} className="input-field !py-2 text-xs">
                    <option value="HEAD">HEAD</option>
                    <option value="GET">GET</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-1">Interval (detik)</label>
                  <input type="number" min="30" value={form.interval_seconds} onChange={(e) => setForm({ ...form, interval_seconds: e.target.value })} className="input-field !py-2 text-xs" />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-1">Status</label>
                  <select value={form.enabled ? '1' : '0'} onChange={(e) => setForm({ ...form, enabled: e.target.value === '1' })} className="input-field !py-2 text-xs">
                    <option value="1">Aktif</option>
                    <option value="0">Paused</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setModal(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Batal</button>
                <button type="submit" disabled={saving} className="btn-primary !py-1.5 !px-4 text-xs">
                  {saving ? 'Saving...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
    </Layout>
  );
}
