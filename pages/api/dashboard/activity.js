import { getAuthUser } from '@/lib/auth';
import db from '@/lib/db';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const activities = await db.query(`
      SELECT 
        al.*,
        u.name as user_name
      FROM activity_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ORDER BY al.created_at DESC
      LIMIT 20
    `);

    return res.status(200).json({ activities });
  } catch (error) {
    console.error('Dashboard activity error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
