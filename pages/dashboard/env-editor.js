import { useState, useEffect } from 'react';
import Layout from '@/components/layout/Layout';
import Loading from '@/components/common/Loading';
import Toast from '@/components/common/Toast';
import { Settings, Save, RefreshCw, Eye, EyeOff, Shield, RotateCcw } from 'lucide-react';

export default function EnvEditorPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [showValues, setShowValues] = useState({});
  const [editMode, setEditMode] = useState(false);
  const [editContent, setEditContent] = useState('');

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    try {
      const res = await fetch('/api/system/env');
      if (res.ok) {
        const d = await res.json();
        setData(d);
        setEditContent(d.content || '');
      }
    } catch (err) {
      console.error('Failed to fetch .env:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/system/env', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', content: editContent })
      });
      const d = await res.json();
      if (d.success) {
        setToast({ type: 'success', message: 'Saved! Restart server to apply changes.' });
        setEditMode(false);
        fetchData();
      } else {
        setToast({ type: 'error', message: d.error });
      }
    } catch {
      setToast({ type: 'error', message: 'Save failed' });
    } finally {
      setSaving(false);
    }
  }

  async function handleRestart() {
    if (!confirm('Restart the server? This will cause a brief downtime.')) return;
    try {
      const res = await fetch('/api/system/env', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restart' })
      });
      const d = await res.json();
      if (d.success) {
        setToast({ type: 'success', message: 'Server restarting... page will reload in 5s' });
        setTimeout(() => window.location.reload(), 5000);
      }
    } catch {
      setToast({ type: 'error', message: 'Restart failed' });
    }
  }

  function toggleShow(key) {
    setShowValues(prev => ({ ...prev, [key]: !prev[key] }));
  }

  if (loading) return <Layout><Loading /></Layout>;

  const variables = data?.lines?.filter(l => l.type === 'variable') || [];
  const sections = {};
  let currentSection = 'General';
  data?.lines?.forEach(line => {
    if (line.type === 'comment') {
      const headerMatch = line.raw.match(/^#\s*(.+)/);
      if (headerMatch) currentSection = headerMatch[1].trim();
    } else {
      if (!sections[currentSection]) sections[currentSection] = [];
      sections[currentSection].push(line);
    }
  });

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings className="w-6 h-6 text-indigo-400" />
            <h1 className="text-2xl font-bold text-white">Environment Config</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditMode(!editMode)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${editMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}
            >
              <Settings className="w-4 h-4" />
              {editMode ? 'Visual Mode' : 'Raw Edit'}
            </button>
            <button
              onClick={handleRestart}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Restart Server
            </button>
          </div>
        </div>

        {editMode ? (
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Raw .env.local</h2>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm transition-colors"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full h-[600px] bg-gray-900 text-green-400 font-mono text-sm p-5 resize-y focus:outline-none border-0"
              spellCheck={false}
            />
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(sections).map(([section, vars]) => (
              <div key={section} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-700">
                  <h2 className="text-sm font-semibold text-white">{section}</h2>
                </div>
                <div className="divide-y divide-gray-700/50">
                  {vars.map((v, i) => (
                    <div key={i} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-700/50">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-indigo-400">{v.key}</span>
                          {v.isSensitive && (
                            <span className="text-[9px] bg-red-600/20 text-red-400 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                              <Shield className="w-2.5 h-2.5" /> SENSITIVE
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          {v.isSensitive && !showValues[v.key] ? (
                            <span className="text-sm text-gray-500 font-mono">{'•'.repeat(Math.min(v.value.length, 30))}</span>
                          ) : (
                            <span className="text-sm text-gray-300 font-mono truncate">{v.value}</span>
                          )}
                        </div>
                      </div>
                      {v.isSensitive && (
                        <button
                          onClick={() => toggleShow(v.key)}
                          className="text-gray-400 hover:text-gray-300 p-1"
                        >
                          {showValues[v.key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
          <h3 className="text-sm font-semibold text-amber-400 mb-2">Important Notes</h3>
          <ul className="text-xs text-gray-400 space-y-1">
            <li>• Changes are saved to the server but require a <strong className="text-white">server restart</strong> to take effect</li>
            <li>• A backup of the previous .env.local is automatically created</li>
            <li>• Sensitive values (passwords, secrets) are masked by default</li>
            <li>• Use "Raw Edit" for advanced editing of the full file</li>
          </ul>
        </div>
      </div>

      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
    </Layout>
  );
}
