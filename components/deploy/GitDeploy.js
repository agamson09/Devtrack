import { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';

const TYPE_COLORS = {
  mysql: 'text-emerald-400',
};

function shortHash(h) {
  return h ? String(h).slice(0, 7) : '—';
}

export default function GitDeploy({ showToast }) {
  const [configs, setConfigs] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [status, setStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState(null);
  const [history, setHistory] = useState([]);
  const [manageOpen, setManageOpen] = useState(false);
  const [form, setForm] = useState({ id: null, name: '', host: '', port: '22', username: 'root', password: '', project_path: '', repo_url: '', repo_token: '', branch: 'main', install_cmd: 'npm install', build_cmd: 'npm run build', restart_cmd: 'pm2 restart app', auto_deploy: false });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState(null);
  const [deployOpen, setDeployOpen] = useState(false);
  const [deploySteps, setDeploySteps] = useState([]);
  const [deployResult, setDeployResult] = useState(null);
  const [deploying, setDeploying] = useState(false);
  const [deployMode, setDeployMode] = useState('deploy'); // deploy | rollback

  const active = configs.find(c => String(c.id) === String(activeId)) || null;

  const fetchConfigs = useCallback(async () => {
    try {
      const res = await fetch('/api/deploy/remote-config');
      const d = await res.json();
      setConfigs(d.configs || []);
      setActiveId(prev => {
        if (prev && (d.configs || []).some(c => String(c.id) === String(prev))) return prev;
        return d.configs?.[0]?.id ?? null;
      });
    } catch {}
  }, []);

  const fetchStatus = useCallback(async (id) => {
    if (!id) return;
    setStatusLoading(true);
    setStatusError(null);
    try {
      const res = await fetch(`/api/deploy/git-status?id=${id}`);
      const d = await res.json();
      if (res.ok) setStatus(d);
      else { setStatus(null); setStatusError(d.error || 'Status check failed'); }
    } catch {
      setStatusError('Status check failed');
    } finally {
      setStatusLoading(false);
    }
  }, []);

  const fetchHistory = useCallback(async (id) => {
    try {
      const res = await fetch('/api/deploy/history?limit=50');
      const d = await res.json();
      setHistory((d.history || []).filter(h => String(h.connection_id) === String(id)));
    } catch {}
  }, []);

  useEffect(() => { fetchConfigs() }, [fetchConfigs]);
  useEffect(() => {
    setStatus(null);
    setStatusError(null);
    setHistory([]);
    if (activeId) { fetchStatus(activeId); fetchHistory(activeId); }
  }, [activeId, fetchStatus, fetchHistory]);

  function openForm(c = null) {
    setForm(c ? {
      id: c.id, name: c.name, host: c.host, port: String(c.port), username: c.username, password: '',
      project_path: c.project_path || '', repo_url: c.repo_url || '', repo_token: '',
      branch: c.branch || 'main',
      install_cmd: c.install_cmd ?? 'npm install', build_cmd: c.build_cmd ?? 'npm run build', restart_cmd: c.restart_cmd ?? 'pm2 restart app',
      auto_deploy: !!c.auto_deploy,
    } : { id: null, name: '', host: '', port: '22', username: 'root', password: '', project_path: '', repo_url: '', repo_token: '', branch: 'main', install_cmd: 'npm install', build_cmd: 'npm run build', restart_cmd: 'pm2 restart app', auto_deploy: false });
    setTestMsg(null);
    setManageOpen(true);
  }

  async function saveForm(e) {
    e?.preventDefault();
    if (!form.host || !form.username) return showToast?.('error', 'Host dan username wajib diisi');
    if (!form.id && !form.password) return showToast?.('error', 'Password SSH wajib untuk server baru');
    setSaving(true);
    try {
      const res = await fetch('/api/deploy/remote-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (d.success) {
        showToast?.('success', 'Target deploy tersimpan');
        setManageOpen(false);
        fetchConfigs();
        if (!activeId) setActiveId(d.id);
      } else showToast?.('error', d.error || 'Save failed');
    } catch {
      showToast?.('error', 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function testForm() {
    setTesting(true);
    setTestMsg(null);
    try {
      const res = await fetch('/api/deploy/remote-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test', ...form }),
      });
      const d = await res.json();
      setTestMsg(d);
    } catch {
      setTestMsg({ ok: false, message: 'Test failed' });
    } finally {
      setTesting(false);
    }
  }

  async function deleteConn(id) {
    if (!confirm('Hapus target deploy ini?')) return;
    await fetch(`/api/deploy/remote-config?id=${id}`, { method: 'DELETE' }).catch(() => {});
    if (String(activeId) === String(id)) setActiveId(null);
    fetchConfigs();
  }

  async function runDeploy(rollbackCommit = null) {
    if (!activeId || deploying) return;
    setDeploying(true);
    setDeployOpen(true);
    setDeployMode(rollbackCommit ? 'rollback' : 'deploy');
    setDeploySteps([]);
    setDeployResult(null);
    let socket = null;
    try {
      socket = io({ transports: ['websocket'] });
      socket.on('deploy:git-step', (e) => {
        if (String(e.configId) === String(activeId)) {
          setDeploySteps(prev => [...prev, e.step]);
        }
      });
      const body = { id: activeId };
      if (rollbackCommit) body.rollback_commit = rollbackCommit;
      const res = await fetch('/api/deploy/git-deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      setDeployResult({ ok: res.ok, ...d });
      fetchStatus(activeId);
      fetchHistory(activeId);
      fetchConfigs();
    } catch {
      setDeployResult({ ok: false, error: 'Deploy request failed' });
    } finally {
      setDeploying(false);
      socket?.disconnect();
    }
  }

  function handleRollback(row) {
    if (!row.commit_before) {
      showToast?.('error', 'Commit sebelum deploy tidak tercatat untuk entry ini');
      return;
    }
    if (confirm(`Rollback ke commit ${String(row.commit_before).slice(0, 7)}? Server akan di-reset ke commit tersebut lalu build & restart ulang.`)) {
      runDeploy(row.commit_before);
    }
  }

  return (
    <div className="space-y-4">
      {/* Target selector */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-xs text-gray-400 uppercase font-semibold whitespace-nowrap">Target</span>
          <select
            value={String(activeId ?? '')}
            onChange={(e) => setActiveId(e.target.value ? Number(e.target.value) : null)}
            className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 min-w-0"
          >
            <option value="">— pilih target deploy —</option>
            {configs.map(c => (
              <option key={c.id} value={c.id}>{c.name} — {c.host} · {c.repo_url || 'no repo'}</option>
            ))}
          </select>
        </div>
        <button onClick={() => openForm()} className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg text-xs whitespace-nowrap transition-colors">
          <i className="fa-solid fa-plus mr-1"></i> Target Baru
        </button>
        <button onClick={() => activeId && fetchStatus(activeId)} disabled={!activeId || statusLoading}
          className="px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-200 rounded-lg text-xs whitespace-nowrap transition-colors">
          <i className={`fa-solid ${statusLoading ? 'fa-spinner fa-spin' : 'fa-rotate'} mr-1`}></i> Refresh
        </button>
        <button onClick={runDeploy} disabled={!activeId || deploying || !status}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold whitespace-nowrap transition-colors">
          <i className={`fa-solid ${deploying ? 'fa-spinner fa-spin' : 'fa-rocket'} mr-1`}></i>
          {deploying ? 'Deploying...' : 'Deploy Now'}
        </button>
      </div>

      {!active && (
        <div className="bg-gray-800 rounded-xl border border-dashed border-gray-700 p-10 text-center text-gray-500">
          <i className="fa-brands fa-git-alt text-4xl mb-3 opacity-50"></i>
          <p className="text-sm">Belum ada target. Klik <strong>Target Baru</strong> untuk mendaftarkan server + repo Git.</p>
        </div>
      )}

      {active && (
        <>
          {/* Status card */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-5 space-y-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-white font-semibold">{active.name}</h3>
                  <span className="text-[10px] bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 px-1.5 py-0.5 rounded-full uppercase">{status?.branch || active.branch}</span>
                  {status && (
                    status.upToDate
                      ? <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-1.5 py-0.5 rounded-full">UP TO DATE</span>
                      : <span className="text-[10px] bg-red-500/10 border border-red-500/30 text-red-300 px-1.5 py-0.5 rounded-full">{status.pending?.length ?? '?'} COMMIT BEHIND</span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1 font-mono truncate">
                  <i className="fa-brands fa-git-alt mr-1 text-orange-400"></i>{active.repo_url || '(no repo configured)'}
                </p>
                <p className="text-[11px] text-gray-600 mt-0.5">{active.username}@{active.host}:{active.port} → {active.project_path}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-[10px] text-gray-500 uppercase">Live commit</p>
                <p className="text-sm font-mono text-white">{shortHash(status?.currentCommit || active.last_commit)}</p>
                {active.last_deployed_at && <p className="text-[10px] text-gray-500 mt-0.5">{new Date(active.last_deployed_at).toLocaleString('id-ID')}</p>}
              </div>
            </div>

            {statusLoading && <p className="text-xs text-gray-500 animate-pulse"><i className="fa-solid fa-spinner fa-spin mr-1"></i> Checking remote...</p>}
            {statusError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-xs text-red-300">
                <i className="fa-solid fa-circle-exclamation mr-1"></i>{statusError}
              </div>
            )}

            {status && !status.upToDate && status.pending?.length > 0 && (
              <div>
                <p className="text-[10px] text-gray-400 uppercase font-semibold mb-1.5">Pending commits ({status.pending.length})</p>
                <div className="bg-gray-900 rounded-lg max-h-44 overflow-y-auto divide-y divide-gray-800">
                  {status.pending.map((c, i) => (
                    <div key={c.hash + i} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                      <span className="font-mono text-amber-400">{c.hash}</span>
                      <span className="text-gray-300 truncate flex-1">{c.msg}</span>
                      <span className="text-gray-600 flex-shrink-0">{c.author}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {status?.dirtyFiles > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 text-xs text-amber-300">
                <i className="fa-solid fa-triangle-exclamation mr-1"></i>{status.dirtyFiles} uncommitted change(s) on the server — deploy (hard reset) akan menimpanya.
              </div>
            )}
          </div>

          {/* History */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-700">
              <h3 className="text-sm font-semibold text-white">Riwayat Deploy ({history.length})</h3>
            </div>
            {history.length === 0 ? (
              <p className="text-center text-gray-500 text-xs py-8">Belum ada riwayat deploy untuk target ini.</p>
            ) : (
              <div className="max-h-72 overflow-y-auto divide-y divide-gray-700/50">
                {history.map(h => (
                  <div key={h.id} className="flex items-center gap-3 px-4 py-2.5 text-xs">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${h.status === 'deployed' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : h.status === 'failed' ? 'bg-red-500/10 border-red-500/30 text-red-300' : 'bg-gray-500/10 border-gray-500/30 text-gray-300'}`}>{h.status}</span>
                    <span className="font-mono text-gray-300">{shortHash(h.commit_before)} → {shortHash(h.commit_after)}</span>
                    <span className="text-gray-600 flex-1 truncate">{h.note || ''}</span>
                    <span className="text-gray-600 flex-shrink-0">{h.deployed_by_name || 'webhook'}</span>
                    <span className="text-gray-600 flex-shrink-0">{new Date(h.created_at).toLocaleString('id-ID')}</span>
                    {h.status === 'deployed' && h.commit_before && (
                      <button onClick={() => handleRollback(h)}
                        className="text-amber-400 hover:text-amber-300 p-1 flex-shrink-0"
                        title={`Rollback ke ${String(h.commit_before).slice(0, 7)}`}>
                        <i className="fa-solid fa-rotate-left"></i>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Deploy modal with live log */}
      {deployOpen && (
        <div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-2xl max-h-[85vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-gray-700 flex items-center justify-between">
              <h3 className="text-white font-bold">
                <i className={`fa-solid ${deployMode === 'rollback' ? 'fa-rotate-left text-amber-400' : 'fa-rocket text-indigo-400'} mr-2`}></i>
                {deployMode === 'rollback' ? 'Rollback' : 'Git Deploy'} — {active?.name}
              </h3>
              {!deploying && <button onClick={() => setDeployOpen(false)} className="text-gray-400 hover:text-white">&times;</button>}
            </div>
            <div className="p-5 space-y-2 font-mono text-xs">
              {deploySteps.length === 0 && !deployResult && (
                <p className="text-gray-500 animate-pulse">Connecting & fetching...</p>
              )}
              {deploySteps.map((s, i) => (
                <div key={i} className={`rounded-lg px-3 py-2 border ${s.ok ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/40 bg-red-500/10'}`}>
                  <p className={s.ok ? 'text-emerald-300' : 'text-red-300'}>
                    {s.ok ? '✓' : '✗'} <strong>{s.name}</strong> <span className="text-gray-500">({s.ms}ms)</span>
                  </p>
                  {s.output && <pre className="text-gray-400 mt-1 whitespace-pre-wrap break-all max-h-32 overflow-y-auto">{s.output}</pre>}
                </div>
              ))}
              {deployResult && (
                <div className={`rounded-lg px-4 py-3 border mt-3 ${deployResult.ok ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-red-500/40 bg-red-500/10'}`}>
                  <p className={deployResult.ok ? 'text-emerald-300' : 'text-red-300'}>
                    {deployResult.ok
                      ? `🚀 ${deployResult.message} (${deployResult.duration_ms}ms)`
                      : `❌ ${deployResult.error || 'Deploy failed'}`}
                  </p>
                  {!deployResult.ok && deployResult.steps?.filter(s => !s.ok).map(s => (
                    <pre key={s.name} className="text-red-400/80 mt-1 whitespace-pre-wrap break-all text-[10px]">{s.output}</pre>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Manage targets modal */}
      {manageOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setManageOpen(false)} />
          <div className="relative w-full max-w-2xl glass-panel p-5 animate-scale-in max-h-[85vh] overflow-y-auto">
            <h3 className="text-white font-bold mb-4"><i className="fa-solid fa-server mr-2 text-indigo-400"></i>Target Deploy Git</h3>

            {configs.length > 0 && (
              <div className="space-y-2 mb-5">
                {configs.map(c => (
                  <div key={c.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-gray-700 bg-gray-900/40">
                    <div className="min-w-0">
                      <p className="text-sm text-white font-medium truncate">{c.name} {c.auto_deploy && <span className="text-[9px] uppercase text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-1 rounded-full ml-1">auto</span>}</p>
                      <p className="text-[11px] text-gray-500 truncate">{c.username}@{c.host} → {c.repo_url || 'no repo'}</p>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <button onClick={() => openForm(c)} className="p-1.5 text-gray-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-md" title="Edit">
                        <i className="fa-solid fa-pen text-xs"></i>
                      </button>
                      <button onClick={() => deleteConn(c.id)} className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-md" title="Hapus">
                        <i className="fa-solid fa-trash text-xs"></i>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={saveForm} className="space-y-3 border-t border-gray-700 pt-4">
              <p className="text-xs text-gray-400 font-semibold">{form.id ? `Edit: ${form.name}` : 'Target Baru'}</p>
              <div className="grid grid-cols-2 gap-3">
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Nama target *" required className="input-field !py-2 text-xs" />
                <input value={form.repo_url} onChange={e => setForm(p => ({ ...p, repo_url: e.target.value }))} placeholder="Repo URL (https://github.com/user/repo)" className="input-field !py-2 text-xs font-mono" />
                <input value={form.host} onChange={e => setForm(p => ({ ...p, host: e.target.value }))} placeholder="Host SSH *" required className="input-field !py-2 text-xs" />
                <input value={form.port} onChange={e => setForm(p => ({ ...p, port: e.target.value }))} placeholder="Port (22)" className="input-field !py-2 text-xs" />
                <input value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} placeholder="User SSH *" required className="input-field !py-2 text-xs" />
                <input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder={form.id ? 'Password SSH (kosongkan jika tetap)' : 'Password SSH *'} className="input-field !py-2 text-xs" />
                <input value={form.project_path} onChange={e => setForm(p => ({ ...p, project_path: e.target.value }))} placeholder="Path project di server (mis. /var/www/app)" className="input-field !py-2 text-xs font-mono col-span-2" />
                <input value={form.branch} onChange={e => setForm(p => ({ ...p, branch: e.target.value }))} placeholder="Branch (main)" className="input-field !py-2 text-xs font-mono" />
                <input value={form.repo_token} onChange={e => setForm(p => ({ ...p, repo_token: e.target.value }))} placeholder="Token repo private (opsional, PAT)" className="input-field !py-2 text-xs" />
                <input value={form.install_cmd} onChange={e => setForm(p => ({ ...p, install_cmd: e.target.value }))} placeholder="Install cmd (kosong = skip)" className="input-field !py-2 text-xs font-mono" />
                <input value={form.build_cmd} onChange={e => setForm(p => ({ ...p, build_cmd: e.target.value }))} placeholder="Build cmd (kosong = skip)" className="input-field !py-2 text-xs font-mono" />
                <input value={form.restart_cmd} onChange={e => setForm(p => ({ ...p, restart_cmd: e.target.value }))} placeholder="Restart cmd (kosong = skip)" className="input-field !py-2 text-xs font-mono col-span-2" />
              </div>
              <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                <input type="checkbox" checked={form.auto_deploy} onChange={e => setForm(p => ({ ...p, auto_deploy: e.target.checked }))} className="accent-indigo-500 w-4 h-4" />
                Auto-deploy saat ada push ke branch ini (webhook)
              </label>
              {testMsg && (
                <div className={`rounded-lg px-3 py-2 text-xs ${testMsg.ok ? 'bg-emerald-900/30 text-emerald-300' : 'bg-red-900/30 text-red-300'}`}>
                  {testMsg.ok ? '✅' : '❌'} {testMsg.message}
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={testForm} disabled={testing || !form.host} className="px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded-lg text-gray-200 text-xs">
                  <i className={`fa-solid ${testing ? 'fa-spinner fa-spin' : 'fa-wave-square'} mr-1`}></i>Test SSH
                </button>
                <button type="submit" disabled={saving} className="btn-primary !py-1.5 !px-4 text-xs">
                  <i className="fa-solid fa-floppy-disk mr-1"></i>{form.id ? 'Update' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
