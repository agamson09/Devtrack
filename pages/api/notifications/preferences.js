import { getAuthUser } from '@/lib/auth'
import { getNotificationPreferences } from '@/lib/notifications'
import db from '@/lib/db'
const { tenantQuery, tenantQueryOne, tenantInsert, tenantUpdate, tenantRemove } = db
import { getTenantFromRequest } from '@/lib/tenant'

export default async function handler(req, res) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const tenantId = await getTenantFromRequest(req)

    if (req.method === 'GET') {
      const prefs = await getNotificationPreferences(user.id)
      return res.status(200).json(prefs)
    }

    if (req.method === 'PUT') {
      const updates = req.body
      if (!updates || typeof updates !== 'object') {
        return res.status(400).json({ error: 'Invalid preferences' })
      }

      const allowedFields = [
        'task_created_email', 'task_created_push', 'task_created_telegram',
        'task_assigned_email', 'task_assigned_push', 'task_assigned_telegram',
        'task_updated_email', 'task_updated_push', 'task_updated_telegram',
        'task_deleted_email', 'task_deleted_push', 'task_deleted_telegram',
        'status_changed_email', 'status_changed_push', 'status_changed_telegram',
        'new_comment_email', 'new_comment_push', 'new_comment_telegram',
        'new_commit_email', 'new_commit_push', 'new_commit_telegram',
        'mention_email', 'mention_push', 'mention_telegram',
        'checklist_changed_email', 'checklist_changed_push', 'checklist_changed_telegram',
        'file_uploaded_email', 'file_uploaded_push', 'file_uploaded_telegram',
        'labels_changed_email', 'labels_changed_push', 'labels_changed_telegram',
        'deadline_email', 'deadline_push', 'deadline_telegram',
        'chat_mention_email', 'chat_mention_push', 'chat_mention_telegram',
        'chat_message_email', 'chat_message_push', 'chat_message_telegram',
        'group_mention_email', 'group_mention_push', 'group_mention_telegram',
        'group_joined_email', 'group_joined_push', 'group_joined_telegram',
        'group_message_email', 'group_message_push', 'group_message_telegram',
        'reaction_email', 'reaction_push', 'reaction_telegram',
        'call_missed_email', 'call_missed_push', 'call_missed_telegram',
        'project_created_email', 'project_created_push', 'project_created_telegram',
        'project_updated_email', 'project_updated_push', 'project_updated_telegram',
        'deploy_executed_email', 'deploy_executed_push', 'deploy_executed_telegram',
        'deploy_failed_email', 'deploy_failed_push', 'deploy_failed_telegram',
        'purchase_created_email', 'purchase_created_push', 'purchase_created_telegram',
        'purchase_approved_email', 'purchase_approved_push', 'purchase_approved_telegram',
        'inventory_assigned_email', 'inventory_assigned_push', 'inventory_assigned_telegram',
        'user_created_email', 'user_created_push', 'user_created_telegram',
        'role_changed_email', 'role_changed_push', 'role_changed_telegram',
        'login_new_device_email', 'login_new_device_push', 'login_new_device_telegram',
        'brute_force_email', 'brute_force_push', 'brute_force_telegram',
        'system_config_email', 'system_config_push', 'system_config_telegram',
        'agent_offline_email', 'agent_offline_push', 'agent_offline_telegram',
        'notification_sound',
      ]

      const setClauses = []
      const values = []
      for (const [key, val] of Object.entries(updates)) {
        if (allowedFields.includes(key)) {
          setClauses.push(`${key} = ?`)
          values.push(val ? 1 : 0)
        }
      }

      if (setClauses.length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' })
      }

      values.push(user.id)
      await tenantUpdate(tenantId,
        `INSERT INTO notification_preferences (user_id) VALUES (?) ON DUPLICATE KEY UPDATE user_id = user_id`,
        [user.id]
      )
      await tenantUpdate(tenantId,
        `UPDATE notification_preferences SET ${setClauses.join(', ')} WHERE user_id = ?`,
        values
      )

      const prefs = await getNotificationPreferences(user.id)
      return res.status(200).json(prefs)
    }

    res.setHeader('Allow', ['GET', 'PUT'])
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('Notification preferences API error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
