import { getAuthUser } from '@/lib/auth';
import db from '@/lib/db';
const { tenantQuery, tenantQueryOne } = db;
import { getTenantFromRequest } from '@/lib/tenant';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const tenantId = await getTenantFromRequest(req);

  try {
    const totalTasksResult = await tenantQueryOne(tenantId, 'SELECT COUNT(*) as total FROM tasks');
    const todoResult = await tenantQueryOne(tenantId, "SELECT COUNT(*) as total FROM tasks WHERE status = 'todo'");
    const inProgressResult = await tenantQueryOne(tenantId, "SELECT COUNT(*) as total FROM tasks WHERE status = 'in_progress'");
    const reviewResult = await tenantQueryOne(tenantId, "SELECT COUNT(*) as total FROM tasks WHERE status = 'review'");
    const doneResult = await tenantQueryOne(tenantId, "SELECT COUNT(*) as total FROM tasks WHERE status = 'done'");
    const overdueResult = await tenantQueryOne(
      tenantId,
      "SELECT COUNT(*) as total FROM tasks WHERE deadline < NOW() AND status != 'done'"
    );
    const totalProjectsResult = await tenantQueryOne(tenantId, 'SELECT COUNT(*) as total FROM projects');

    const memberStats = await tenantQuery(tenantId, `
      SELECT 
        u.name,
        COUNT(CASE WHEN t.status = 'todo' THEN 1 END) as todo,
        COUNT(CASE WHEN t.status = 'in_progress' THEN 1 END) as in_progress,
        COUNT(CASE WHEN t.status = 'review' THEN 1 END) as review,
        COUNT(CASE WHEN t.status = 'done' THEN 1 END) as done
      FROM users u
      LEFT JOIN tasks t ON t.assigned_to = u.id
      GROUP BY u.id, u.name
      ORDER BY u.name
    `);

    const formattedMemberStats = memberStats.map((m) => ({
      name: m.name,
      todo: Number(m.todo) || 0,
      in_progress: Number(m.in_progress) || 0,
      review: Number(m.review) || 0,
      done: Number(m.done) || 0,
    }));

    const weeklyVelocity = await tenantQuery(tenantId, `
      SELECT 
        YEAR(updated_at) AS year,
        WEEK(updated_at) AS week,
        COUNT(*) AS completed
      FROM tasks
      WHERE status = 'done' AND updated_at >= DATE_SUB(NOW(), INTERVAL 12 WEEK)
      GROUP BY YEAR(updated_at), WEEK(updated_at)
      ORDER BY year, week
    `);

    const overdueTasks = await tenantQuery(tenantId, `
      SELECT t.id, t.title, t.deadline, t.status, u.name AS assignee_name, p.name AS project_name
      FROM tasks t
      LEFT JOIN users u ON t.assigned_to = u.id
      LEFT JOIN projects p ON t.project_id = p.id
      WHERE t.deadline < CURDATE() AND t.status != 'done'
      ORDER BY t.deadline ASC
      LIMIT 10
    `);

    return res.status(200).json({
      totalTasks: Number(totalTasksResult?.total || 0),
      todo: Number(todoResult?.total || 0),
      inProgress: Number(inProgressResult?.total || 0),
      review: Number(reviewResult?.total || 0),
      done: Number(doneResult?.total || 0),
      overdue: Number(overdueResult?.total || 0),
      totalProjects: Number(totalProjectsResult?.total || 0),
      memberStats: formattedMemberStats,
      weeklyVelocity: weeklyVelocity.map(v => ({
        week: `W${v.week}`,
        completed: Number(v.completed)
      })),
      overdueTasks,
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
