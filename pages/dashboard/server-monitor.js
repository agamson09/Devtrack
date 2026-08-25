import { useState, useEffect } from 'react';
import Layout from '@/components/layout/Layout';
import Loading from '@/components/common/Loading';
import { Server, Cpu, HardDrive, MemoryStick, Activity, Database, Wifi, RefreshCw } from 'lucide-react';

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

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  async function fetchStatus() {
    try {
      const res = await fetch('/api/system/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        setLastRefresh(new Date());
      }
    } catch (err) {
      console.error('Failed to fetch status:', err);
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-700/50 rounded-lg p-4">
                    <p className="text-xs text-gray-400">Database Size</p>
                    <p className="text-2xl font-bold text-white">{formatBytes(status.mysql.size_mb)}</p>
                  </div>
                  <div className="bg-gray-700/50 rounded-lg p-4">
                    <p className="text-xs text-gray-400">Tables</p>
                    <p className="text-2xl font-bold text-white">{status.mysql.tables}</p>
                  </div>
                  <div className="bg-gray-700/50 rounded-lg p-4">
                    <p className="text-xs text-gray-400">Connections</p>
                    <p className="text-2xl font-bold text-white">{status.mysql.connections}</p>
                  </div>
                  <div className="bg-gray-700/50 rounded-lg p-4">
                    <p className="text-xs text-gray-400">Version</p>
                    <p className="text-sm font-medium text-white">{status.mysql.version.split(' ')[2] || status.mysql.version}</p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <div className="flex items-center gap-2 mb-4">
                  <Wifi className="w-5 h-5 text-indigo-400" />
                  <h2 className="text-lg font-semibold text-white">System Info</h2>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-700/50 rounded-lg p-4">
                    <p className="text-xs text-gray-400">Node.js</p>
                    <p className="text-sm font-medium text-white">{status.nodeVersion}</p>
                  </div>
                  <div className="bg-gray-700/50 rounded-lg p-4">
                    <p className="text-xs text-gray-400">Network RX</p>
                    <p className="text-sm font-medium text-white">{status.network.rx_mb} MB</p>
                  </div>
                  <div className="bg-gray-700/50 rounded-lg p-4">
                    <p className="text-xs text-gray-400">Network TX</p>
                    <p className="text-sm font-medium text-white">{status.network.tx_mb} MB</p>
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
