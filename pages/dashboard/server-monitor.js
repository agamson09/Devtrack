import { useState, useEffect } from 'react';
import Layout from '@/components/layout/Layout';
import Loading from '@/components/common/Loading';
import { Server, Cpu, HardDrive, MemoryStick, Activity, Database, Wifi, RefreshCw, Bell, ChevronDown, ChevronRight } from 'lucide-react';

function MetricCard({ icon: Icon, label, value, sub, color, percent }) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2.5 rounded-lg ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-xs text-gray-400">{label}</p>
          <p className="text-xl font-bold text-white">{value}</p>
        </div>
      </div>
      {percent !== undefined && (
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-500 ${
              percent > 90 ? 'bg-red-500' : percent > 70 ? 'bg-yellow-500' : 'bg-emerald-500'
            }`}
            style={{ width: `${Math.min(percent, 100)}%` }}
          />
        </div>
      )}
      {sub && <p className="text-xs text-gray-500 mt-2">{sub}</p>}
    </div>
  );
}

function ProcessRow({ name, pid, cpu, mem }) {
  return (
    <tr className="border-b border-gray-700/50">
      <td className="py-2 px-3 text-sm text-white">{name}</td>
      <td className="py-2 px-3 text-sm text-gray-400 text-center">{pid}</td>
      <td className="py-2 px-3 text-sm text-gray-400 text-center">{cpu}%</td>
      <td className="py-2 px-3 text-sm text-gray-400 text-center">{mem}%</td>
    </tr>
  );
}

export default function ServerMonitorPage() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [connections, setConnections] = useState([]);
  const [activeConn, setActiveConn] = useState('local');
  const [error, setError] = useState(null);
  const [alertSettings, setAlertSettings] = useState(null);
  const [alertOpen, setAlertOpen] = useState(false);
  const [savingAlert, setSavingAlert] = useState(false);

  useEffect(() => {
    fetch('/api/system/alert-settings')
      .then(r => r.json())
      .then(setAlertSettings)
      .catch(() => {});
  }, []);

  async function saveAlertSettings() {
    setSavingAlert(true);
    try {
      const res = await fetch('/api/system/alert-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alertSettings),
      });
      const d = await res.json();
      if (d.success) {
        setAlertSettings(d.settings);
        alert('Pengaturan alert tersimpan');
      } else {
        alert(d.error || 'Save failed');
      }
    } catch {
      alert('Save failed');
    } finally {
      setSavingAlert(false);
    }
  }

  useEffect(() => {
    fetch('/api/deploy/remote-config')
      .then(r => r.json())
      .then(d => setConnections(d.configs || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, [activeConn]);

  async function fetchStatus() {
    try {
      const qs = activeConn !== 'local' ? `?connection_id=${activeConn}` : '';
      const res = await fetch('/api/system/status' + qs);
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        setError(null);
        setLastRefresh(new Date());
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error || 'Monitoring failed');
      }
    } catch (err) {
      console.error('Failed to fetch status:', err);
      setError('Failed to fetch status');
    } finally {
      setLoading(false);
    }
  }

  function formatBytes(mb) {
    if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
    return `${mb} MB`;
  }

  if (loading) {
    return (
      <Layout>
        <Loading />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Server className="w-6 h-6 text-indigo-400" />
            <h1 className="text-2xl font-bold text-white">Server Monitor</h1>
          </div>
          <div className="flex items-center gap-3">
            {lastRefresh && (
              <span className="text-xs text-gray-500">
                Last updated: {lastRefresh.toLocaleTimeString('id-ID')}
              </span>
            )}
            <button
              onClick={fetchStatus}
              className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-gray-300 transition-colors"
            >
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
          </div>
        </div>

        {/* Connection bar */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-xs text-gray-400 uppercase font-semibold whitespace-nowrap">Server</span>
            <select
              value={String(activeConn)}
              onChange={(e) => setActiveConn(e.target.value === 'local' ? 'local' : Number(e.target.value))}
              className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 min-w-0"
            >
              <option value="local">🏠 Local server (DevTrack)</option>
              {connections.map(c => (
                <option key={c.id} value={c.id}>{c.name} — {c.username}@{c.host}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Alert settings */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <button
            onClick={() => setAlertOpen(!alertOpen)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-700/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-semibold text-white">Alert Settings</span>
              {alertSettings?.enabled ? (
                <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-1.5 py-0.5 rounded-full">ON</span>
              ) : (
                <span className="text-[10px] bg-gray-500/10 border border-gray-500/30 text-gray-400 px-1.5 py-0.5 rounded-full">OFF</span>
              )}
            </div>
            {alertOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
          </button>
          {alertOpen && alertSettings && (
            <div className="px-4 pb-4 space-y-3 border-t border-gray-700">
              <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer pt-3">
                <input
                  type="checkbox"
                  checked={!!alertSettings.enabled}
                  onChange={(e) => setAlertSettings({ ...alertSettings, enabled: e.target.checked })}
                  className="accent-indigo-500 w-4 h-4"
                />
                Aktifkan notifikasi Telegram saat metrik melewati batas
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { key: 'cpu_threshold', label: 'CPU %' },
                  { key: 'memory_threshold', label: 'Memory %' },
                  { key: 'disk_threshold', label: 'Disk %' },
                  { key: 'cooldown_minutes', label: 'Cooldown (menit)' },
                ].map((f) => (
                  <div key={f.key}>
                    <label className="block text-[10px] text-gray-500 mb-1">{f.label}</label>
                    <input
                      type="number"
                      min="1"
                      value={alertSettings[f.key] ?? ''}
                      onChange={(e) => setAlertSettings({ ...alertSettings, [f.key]: e.target.value })}
                      className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-1">Telegram Chat ID (pisah koma; kosong = kirim ke semua admin yang punya chat ID)</label>
                <input
                  value={alertSettings.telegram_chat_id || ''}
                  onChange={(e) => setAlertSettings({ ...alertSettings, telegram_chat_id: e.target.value })}
                  placeholder="123456789, 987654321"
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="flex justify-end">
                <button
                  onClick={saveAlertSettings}
                  disabled={savingAlert}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-colors"
                >
                  {savingAlert ? 'Saving...' : 'Save Alert Settings'}
                </button>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-300">
            <i className="fa-solid fa-circle-exclamation mr-2"></i>{error}
          </div>
        )}

        {status && (
          <>
            {/* Main metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                icon={Cpu}
                label="CPU Usage"
                value={`${status.cpu.usage}%`}
                color="bg-blue-500"
                percent={status.cpu.usage}
                sub={`Load: ${status.load['1m']} / ${status.load['5m']} / ${status.load['15m']}`}
              />
              <MetricCard
                icon={MemoryStick}
                label="Memory"
                value={`${status.memory.percent}%`}
                color="bg-purple-500"
                percent={status.memory.percent}
                sub={`${status.memory.used} MB / ${status.memory.total} MB`}
              />
              <MetricCard
                icon={HardDrive}
                label="Disk"
                value={`${status.disk.percent}%`}
                color="bg-amber-500"
                percent={status.disk.percent}
                sub={`${status.disk.used} / ${status.disk.total} (avail: ${status.disk.available})`}
              />
              <MetricCard
                icon={Activity}
                label="Uptime"
                value={status.uptime}
                color="bg-emerald-500"
                sub={`${status.processes} processes running`}
              />
            </div>

            {/* MySQL & Network */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <div className="flex items-center gap-2 mb-4">
                  <Database className="w-5 h-5 text-indigo-400" />
                  <h2 className="text-lg font-semibold text-white">MySQL Database</h2>
                </div>
                {!status.mysql ? (
                  <p className="text-xs text-gray-500 py-6 text-center">MySQL info not available on this target.</p>
                ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-700/50 rounded-lg p-4">
                    <p className="text-xs text-gray-400">Database Size</p>
                    <p className="text-2xl font-bold text-white">{status.mysql.size_mb != null ? formatBytes(status.mysql.size_mb) : '—'}</p>
                  </div>
                  <div className="bg-gray-700/50 rounded-lg p-4">
                    <p className="text-xs text-gray-400">Tables</p>
                    <p className="text-2xl font-bold text-white">{status.mysql.tables ?? '—'}</p>
                  </div>
                  <div className="bg-gray-700/50 rounded-lg p-4">
                    <p className="text-xs text-gray-400">Connections</p>
                    <p className="text-2xl font-bold text-white">{status.mysql.connections ?? '—'}</p>
                  </div>
                  <div className="bg-gray-700/50 rounded-lg p-4">
                    <p className="text-xs text-gray-400">Version</p>
                    <p className="text-sm font-medium text-white break-all">{status.mysql.version?.split(' ')[2] || status.mysql.version || '—'}</p>
                  </div>
                </div>
                )}
              </div>

              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <div className="flex items-center gap-2 mb-4">
                  <Wifi className="w-5 h-5 text-indigo-400" />
                  <h2 className="text-lg font-semibold text-white">System Info</h2>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-700/50 rounded-lg p-4">
                    <p className="text-xs text-gray-400">Node.js</p>
                    <p className="text-sm font-medium text-white">{status.nodeVersion || '—'}</p>
                  </div>
                  <div className="bg-gray-700/50 rounded-lg p-4">
                    <p className="text-xs text-gray-400">Network RX</p>
                    <p className="text-sm font-medium text-white">{status.network?.rx_mb ?? '—'} MB</p>
                  </div>
                  <div className="bg-gray-700/50 rounded-lg p-4">
                    <p className="text-xs text-gray-400">Network TX</p>
                    <p className="text-sm font-medium text-white">{status.network?.tx_mb ?? '—'} MB</p>
                  </div>
                  <div className="bg-gray-700/50 rounded-lg p-4">
                    <p className="text-xs text-gray-400">Processes</p>
                    <p className="text-2xl font-bold text-white">{status.processes}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Load average bars */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h2 className="text-lg font-semibold text-white mb-4">Load Average</h2>
              <div className="space-y-4">
                {[
                  { label: '1 minute', value: status.load['1m'] },
                  { label: '5 minutes', value: status.load['5m'] },
                  { label: '15 minutes', value: status.load['15m'] },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-400">{item.label}</span>
                      <span className="text-sm text-white font-medium">{item.value}</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2.5">
                      <div
                        className={`h-2.5 rounded-full transition-all duration-500 ${
                          item.value > 2 ? 'bg-red-500' : item.value > 1 ? 'bg-yellow-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min((item.value / 4) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
