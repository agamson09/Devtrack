import { getAuthUser } from '@/lib/auth';
import db from '@/lib/db';
import { getStatusRemote } from '@/lib/sshMonitor';
import { getLocalStatus } from '@/lib/systemStatus';
import { checkAlerts } from '@/lib/serverAlerts';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    // ---- Remote target (saved SSH server) ----
    const connId = req.query.connection_id;
    if (connId && connId !== 'local') {
      const config = await db.queryOne('SELECT * FROM remote_deploy_configs WHERE id = ?', [connId]);
      if (!config) return res.status(404).json({ error: 'Server not found' });
      const status = await getStatusRemote(config);
      checkAlerts(status).catch(() => {});
      return res.status(200).json(status);
    }

    // ---- Local server (cross-platform: Linux/macOS/Windows) ----
    const status = await getLocalStatus();
    checkAlerts(status).catch(() => {});
    return res.status(200).json(status);
  } catch (err) {
    console.error('System status error:', err);
    return res.status(500).json({ error: 'Failed to fetch system status' });
  }
}
