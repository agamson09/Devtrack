import { getAuthUser } from '@/lib/auth';
import db from '@/lib/db';

// Whitelist of customizable widget ids (must match dashboard page registry)
const VALID_IDS = new Set([
  'stat-cards',
  'status-chart',
  'member-workload',
  'projects-overview',
  'recent-activity',
  'overdue-tasks',
  'weekly-velocity',
  'file-activity',
  'module-progress',
  'deploy-status',
  'security-overview',
]);

export default async function handler(req, res) {
  const user = await getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    const row = await db.queryOne('SELECT dashboard_layout FROM users WHERE id = ?', [user.id]);
    let layout = null;
    try {
      layout = row?.dashboard_layout ? JSON.parse(row.dashboard_layout) : null;
    } catch {
      layout = null;
    }
    return res.status(200).json({ layout });
  }

  if (req.method === 'PUT') {
    const { hidden, orders } = req.body || {};

    // Validate: hidden must be an array of known ids
    const cleanHidden = Array.isArray(hidden)
      ? [...new Set(hidden.filter((id) => VALID_IDS.has(id)))]
      : [];

    // Validate: orders maps known id -> array of known ids
    const cleanOrders = {};
    if (orders && typeof orders === 'object' && !Array.isArray(orders)) {
      for (const [key, list] of Object.entries(orders)) {
        if (Array.isArray(list)) {
          const cleanList = list.filter((id) => VALID_IDS.has(id));
          if (cleanList.length > 0) cleanOrders[key] = cleanList;
        }
      }
    }

    // Nothing customized -> clear the column back to default
    const isEmpty = cleanHidden.length === 0 && Object.keys(cleanOrders).length === 0;
    const value = isEmpty ? null : JSON.stringify({ hidden: cleanHidden, orders: cleanOrders });

    await db.query('UPDATE users SET dashboard_layout = ? WHERE id = ?', [value, user.id]);
    return res.status(200).json({ ok: true, layout: isEmpty ? null : { hidden: cleanHidden, orders: cleanOrders } });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
