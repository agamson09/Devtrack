const db = require('./db')
const { notifyViaEmail } = require('./email')
const { notifyViaTelegram } = require('./telegram')
const { sendPushNotification } = require('./push')

let io = null

function setSocketIO(socketIO) {
  io = socketIO
}

function emitToUser(userId, event, data) {
  if (io) {
    io.to(`user-${userId}`).emit(event, data)
  }
}

async function getNotificationPreferences(userId) {
  let prefs = await db.queryOne(
    'SELECT * FROM notification_preferences WHERE user_id = ?',
    [userId]
  )
  if (!prefs) {
    await db.insert('notification_preferences', { user_id: userId })
    prefs = await db.queryOne(
      'SELECT * FROM notification_preferences WHERE user_id = ?',
      [userId]
    )
  }
  return prefs
}

async function shouldNotify(userId, type, channel) {
  const prefs = await getNotificationPreferences(userId)
  const key = `${type}_${channel}`
  return prefs[key] === 1 || prefs[key] === true
}

async function logDelivery(notificationId, channel, status, errorMessage = null) {
  try {
    await db.insert('notification_logs', {
      notification_id: notificationId,
      channel,
      status,
      error_message: errorMessage,
      attempts: 1,
    })
  } catch (e) {
    console.error('[notif] Failed to log delivery:', e.message)
  }
}

async function retryDelivery(notificationId, channel, retryFn) {
  const MAX_RETRIES = 2
  const RETRY_DELAY = 5000

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      await retryFn()
      await logDelivery(notificationId, channel, 'sent')
      return true
    } catch (e) {
      if (attempt < MAX_RETRIES) {
        try {
          await db.update(
            'UPDATE notification_logs SET status = ?, attempts = ?, error_message = ? WHERE notification_id = ? AND channel = ?',
            ['retrying', attempt + 2, e.message, notificationId, channel]
          )
        } catch {}
        await new Promise(r => setTimeout(r, RETRY_DELAY * (attempt + 1)))
      } else {
        await logDelivery(notificationId, channel, 'failed', e.message)
        return false
      }
    }
  }
  return false
}

async function createNotification(userId, type, title, message, options = {}) {
  const {
    link = null,
    sourceType = null,
    sourceId = null,
    actorId = null,
    groupCount = null,
    tenantId = null,
  } = options

  const result = await db.insert(
    'INSERT INTO notifications (user_id, type, title, message, link, source_type, source_id, actor_id, group_count, tenant_id, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NOW())',
    [userId, type, title, message, link, sourceType, sourceId, actorId, groupCount, tenantId]
  )

  const notifId = result.insertId

  emitToUser(userId, 'notification:new', {
    id: notifId,
    user_id: userId,
    type,
    title,
    message,
    link,
    source_type: sourceType,
    source_id: sourceId,
    actor_id: actorId,
    group_count: groupCount,
    is_read: 0,
    created_at: new Date().toISOString(),
  })

  dispatchChannels(userId, type, title, message, link, notifId)

  return notifId
}

async function dispatchChannels(userId, type, title, message, link, notifId) {
  try {
    const user = await db.queryOne(
      'SELECT email_notifications, telegram_notifications FROM users WHERE id = ?',
      [userId]
    )
    if (!user) return

    const fullLink = link ? `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}${link}` : ''
    const html = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2 style="color:#4f46e5">${title}</h2><p style="color:#374151;font-size:16px">${message}</p>${fullLink ? `<p style="margin-top:20px"><a href="${fullLink}" style="background:#4f46e5;color:white;padding:10px 20px;border-radius:6px;text-decoration:none">View Details</a></p>` : ''}<p style="color:#9ca3af;font-size:12px;margin-top:20px">DevTrack Notification</p></div>`
    const telegramMsg = `<b>${title}</b>\n\n${message}${fullLink ? `\n\n<a href="${fullLink}">View Details</a>` : ''}`

    if (user.email_notifications && await shouldNotify(userId, type, 'email')) {
      retryDelivery(notifId, 'email', () => notifyViaEmail(userId, title, html))
        .catch(e => console.error('[notif] Email retry exhausted:', e.message))
    }

    if (user.telegram_notifications && await shouldNotify(userId, type, 'telegram')) {
      retryDelivery(notifId, 'telegram', () => notifyViaTelegram(userId, telegramMsg))
        .catch(e => console.error('[notif] Telegram retry exhausted:', e.message))
    }

    if (await shouldNotify(userId, type, 'push')) {
      retryDelivery(notifId, 'push', () => sendPushNotification(userId, {
        title,
        body: message,
        url: link || '/dashboard',
        tag: `notif-${type}`,
      })).catch(e => console.error('[notif] Push retry exhausted:', e.message))
    }
  } catch (e) {
    console.error('[notif] Multi-channel dispatch error:', e.message)
  }
}

async function getUnreadCount(userId) {
  const result = await db.queryOne(
    'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
    [userId]
  )
  return result.count
}

async function getNotifications(userId, limit = 20, offset = 0, filters = {}) {
  let sql = 'SELECT * FROM notifications WHERE user_id = ?'
  const params = [userId]

  if (filters.type) {
    sql += ' AND type = ?'
    params.push(filters.type)
  }
  if (filters.unreadOnly) {
    sql += ' AND is_read = 0'
  }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
  params.push(limit, offset)

  const notifications = await db.query(sql, params)
  const unreadCount = await getUnreadCount(userId)
  return { notifications, unreadCount }
}

async function markAsRead(notificationId) {
  await db.update(
    'UPDATE notifications SET is_read = 1 WHERE id = ?',
    [notificationId]
  )
}

async function markAllAsRead(userId) {
  await db.update(
    'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0',
    [userId]
  )
}

function extractMentions(text) {
  if (!text) return []
  const mentions = text.match(/@(\w+)/g)
  if (!mentions) return []
  return [...new Set(mentions.map(m => m.slice(1).toLowerCase()))]
}

async function findUsersByUsernames(usernames) {
  if (!usernames.length) return []
  const placeholders = usernames.map(() => '?').join(',')
  return db.query(
    `SELECT id, name, email FROM users WHERE LOWER(name) IN (${placeholders})`,
    usernames
  )
}

// ==================== TASK NOTIFICATIONS ====================

async function notifyTaskCreated(task, project, createdBy) {
  const recipients = new Set()
  if (task.assigned_to && task.assigned_to !== createdBy) recipients.add(task.assigned_to)

  const results = []
  for (const userId of recipients) {
    const notifId = await createNotification(
      userId,
      'task_created',
      'Task Created',
      `New task "${task.title}" created in project "${project.name}"`,
      { link: `/dashboard/tasks/${task.id}`, sourceType: 'task', sourceId: task.id, actorId: createdBy }
    )
    results.push(notifId)
  }
  return results
}

async function notifyTaskAssigned(assignedTo, task, project) {
  return createNotification(
    assignedTo,
    'task_assigned',
    'Task Assigned',
    `You have been assigned to task "${task.title}" in project "${project.name}"`,
    { link: `/dashboard/tasks/${task.id}`, sourceType: 'task', sourceId: task.id }
  )
}

async function notifyStatusChanged(task, oldStatus, newStatus, changedBy) {
  const recipients = new Set()
  if (task.assigned_to && task.assigned_to !== changedBy) recipients.add(task.assigned_to)
  if (task.created_by && task.created_by !== changedBy && task.created_by !== task.assigned_to) recipients.add(task.created_by)

  const results = []
  for (const userId of recipients) {
    const notifId = await createNotification(
      userId,
      'status_changed',
      'Task Status Updated',
      `Task "${task.title}" status changed from "${oldStatus}" to "${newStatus}"`,
      { link: `/dashboard/tasks/${task.id}`, sourceType: 'task', sourceId: task.id, actorId: changedBy }
    )
    results.push(notifId)
  }
  return results
}

async function notifyTaskUpdated(task, changedFields, updatedBy) {
  const recipients = new Set()
  if (task.assigned_to && task.assigned_to !== updatedBy) recipients.add(task.assigned_to)
  if (task.created_by && task.created_by !== updatedBy && task.created_by !== task.assigned_to) recipients.add(task.created_by)

  const fieldNames = changedFields.map(f => f.field || f).join(', ')
  const results = []
  for (const userId of recipients) {
    const notifId = await createNotification(
      userId,
      'task_updated',
      'Task Updated',
      `Task "${task.title}" was updated (${fieldNames})`,
      { link: `/dashboard/tasks/${task.id}`, sourceType: 'task', sourceId: task.id, actorId: updatedBy }
    )
    results.push(notifId)
  }
  return results
}

async function notifyTaskDeleted(task, deletedBy) {
  const recipients = new Set()
  if (task.assigned_to && task.assigned_to !== deletedBy) recipients.add(task.assigned_to)
  if (task.created_by && task.created_by !== deletedBy) recipients.add(task.created_by)

  const results = []
  for (const userId of recipients) {
    const notifId = await createNotification(
      userId,
      'task_deleted',
      'Task Deleted',
      `Task "${task.title}" has been deleted`,
      { sourceType: 'task', sourceId: task.id, actorId: deletedBy }
    )
    results.push(notifId)
  }
  return results
}

async function notifyNewComment(task, comment, commentedBy) {
  const recipients = new Set()
  if (task.assigned_to && task.assigned_to !== commentedBy) recipients.add(task.assigned_to)
  if (task.created_by && task.created_by !== commentedBy && task.created_by !== task.assigned_to) recipients.add(task.created_by)

  const mentioned = extractMentions(comment.comment || comment)
  if (mentioned.length) {
    const users = await findUsersByUsernames(mentioned)
    for (const u of users) {
      if (u.id !== commentedBy) recipients.add(u.id)
    }
  }

  const results = []
  for (const userId of recipients) {
    const isMention = mentioned.length > 0
    const notifId = await createNotification(
      userId,
      isMention ? 'mention' : 'new_comment',
      isMention ? 'You were mentioned' : 'New Comment',
      `${comment.user_name || 'Someone'} commented on "${task.title}": ${(comment.comment || comment || '').substring(0, 150)}`,
      { link: `/dashboard/tasks/${task.id}`, sourceType: 'comment', sourceId: comment.id, actorId: commentedBy }
    )
    results.push(notifId)
  }
  return results
}

async function notifyNewCommit(task, commit, committer) {
  const notifications = []
  const recipients = new Set()
  if (task.assigned_to && task.assigned_to !== committer.id) recipients.add(task.assigned_to)
  if (task.created_by && task.created_by !== committer.id && task.created_by !== task.assigned_to) recipients.add(task.created_by)

  for (const userId of recipients) {
    const notifId = await createNotification(
      userId,
      'new_commit',
      'New Commit Linked',
      `New commit linked to task "${task.title}" by ${committer.name}: ${commit.message}`,
      { link: `/dashboard/tasks/${task.id}`, sourceType: 'commit', sourceId: commit.id, actorId: committer.id }
    )
    notifications.push(notifId)
  }
  return notifications
}

async function notifyChecklistChanged(task, action, itemText, changedBy) {
  const recipients = new Set()
  if (task.assigned_to && task.assigned_to !== changedBy) recipients.add(task.assigned_to)
  if (task.created_by && task.created_by !== changedBy && task.created_by !== task.assigned_to) recipients.add(task.created_by)

  const actionText = {
    added: 'added',
    completed: 'completed',
    uncompleted: 'unchecked',
    deleted: 'deleted',
    replied: 'replied to',
  }[action] || action

  const results = []
  for (const userId of recipients) {
    const notifId = await createNotification(
      userId,
      'checklist_changed',
      'Checklist Updated',
      `${actionText} checklist item "${(itemText || '').substring(0, 100)}" on task "${task.title}"`,
      { link: `/dashboard/tasks/${task.id}`, sourceType: 'checklist', sourceId: task.id, actorId: changedBy }
    )
    results.push(notifId)
  }
  return results
}

async function notifyFileUploaded(task, filename, uploadedBy) {
  const recipients = new Set()
  if (task.assigned_to && task.assigned_to !== uploadedBy) recipients.add(task.assigned_to)
  if (task.created_by && task.created_by !== uploadedBy && task.created_by !== task.assigned_to) recipients.add(task.created_by)

  const results = []
  for (const userId of recipients) {
    const notifId = await createNotification(
      userId,
      'file_uploaded',
      'File Uploaded',
      `${filename} was uploaded to task "${task.title}"`,
      { link: `/dashboard/tasks/${task.id}`, sourceType: 'attachment', sourceId: task.id, actorId: uploadedBy }
    )
    results.push(notifId)
  }
  return results
}

async function notifyLabelsChanged(task, labels, changedBy) {
  const recipients = new Set()
  if (task.assigned_to && task.assigned_to !== changedBy) recipients.add(task.assigned_to)
  if (task.created_by && task.created_by !== changedBy && task.created_by !== task.assigned_to) recipients.add(task.created_by)

  const labelNames = (Array.isArray(labels) ? labels : []).map(l => l.name || l).join(', ')
  const results = []
  for (const userId of recipients) {
    const notifId = await createNotification(
      userId,
      'labels_changed',
      'Labels Changed',
      `Labels on task "${task.title}" updated to: ${labelNames}`,
      { link: `/dashboard/tasks/${task.id}`, sourceType: 'task', sourceId: task.id, actorId: changedBy }
    )
    results.push(notifId)
  }
  return results
}

async function notifyDeadlineApproaching(task) {
  if (!task.deadline) return null
  const deadline = new Date(task.deadline + 'T00:00:00')
  const now = new Date()
  const hoursUntilDeadline = (deadline - now) / (1000 * 60 * 60)

  if (hoursUntilDeadline <= 24 && hoursUntilDeadline > 0 && task.assigned_to) {
    return createNotification(
      task.assigned_to,
      'deadline_approaching',
      'Deadline Approaching',
      `Task "${task.title}" deadline is in ${Math.round(hoursUntilDeadline)} hours`,
      { link: `/dashboard/tasks/${task.id}`, sourceType: 'task', sourceId: task.id }
    )
  }
  return null
}

// ==================== CHAT NOTIFICATIONS ====================

async function notifyChatMention(senderId, senderName, message, chatType, chatId) {
  const mentioned = extractMentions(message)
  if (!mentioned.length) return []

  const users = await findUsersByUsernames(mentioned)
  const results = []

  for (const user of users) {
    if (user.id === senderId) continue
    const notifId = await createNotification(
      user.id,
      chatType === 'group' ? 'group_mention' : 'chat_mention',
      'You were mentioned',
      `${senderName} mentioned you: "${message.substring(0, 150)}"`,
      {
        link: chatType === 'group' ? `/dashboard/chat?group=${chatId}` : '/dashboard/chat',
        sourceType: 'chat',
        sourceId: chatId,
        actorId: senderId,
      }
    )
    results.push(notifId)
  }
  return results
}

async function notifyChatMessageOffline(receiverId, senderId, senderName, message) {
  return createNotification(
    receiverId,
    'chat_message',
    senderName,
    message.substring(0, 200),
    { link: '/dashboard/chat', sourceType: 'chat', actorId: senderId }
  )
}

async function notifyGroupMessageOffline(memberIds, senderId, senderName, message, groupId) {
  const results = []
  for (const userId of memberIds) {
    if (userId === senderId) continue
    const notifId = await createNotification(
      userId,
      'group_message',
      `${senderName} in group`,
      message.substring(0, 200),
      { link: `/dashboard/chat?group=${groupId}`, sourceType: 'group', sourceId: groupId, actorId: senderId }
    )
    results.push(notifId)
  }
  return results
}

async function notifyReaction(targetUserId, reactorName, reaction, itemType, itemTitle) {
  if (!targetUserId) return null
  return createNotification(
    targetUserId,
    'reaction',
    'New Reaction',
    `${reactorName} reacted ${reaction} to your ${itemType} "${(itemTitle || '').substring(0, 100)}"`,
    { sourceType: itemType, actorId: targetUserId }
  )
}

async function notifyGroupMemberAdded(userIds, addedBy, groupName, groupId) {
  const results = []
  for (const userId of userIds) {
    if (userId === addedBy) continue
    const notifId = await createNotification(
      userId,
      'group_joined',
      'Added to Group',
      `You were added to group "${groupName}"`,
      { link: `/dashboard/chat?group=${groupId}`, sourceType: 'group', sourceId: groupId, actorId: addedBy }
    )
    results.push(notifId)
  }
  return results
}

async function notifyGroupMemberRemoved(userId, removedBy, groupName) {
  return createNotification(
    userId,
    'group_removed',
    'Removed from Group',
    `You were removed from group "${groupName}"`,
    { sourceType: 'group', actorId: removedBy }
  )
}

async function notifyCallMissed(userId, callerName, callType) {
  return createNotification(
    userId,
    'call_missed',
    'Missed Call',
    `You missed a ${callType} call from ${callerName}`,
    { link: '/dashboard/chat', sourceType: 'call' }
  )
}

// ==================== PROJECT NOTIFICATIONS ====================

async function notifyProjectCreated(project, createdBy) {
  const admins = await db.query("SELECT id FROM users WHERE role = 'admin' AND id != ?", [createdBy])
  const results = []
  for (const admin of admins) {
    const notifId = await createNotification(
      admin.id,
      'project_created',
      'Project Created',
      `New project "${project.name}" created`,
      { link: `/dashboard/projects/${project.id}`, sourceType: 'project', sourceId: project.id, actorId: createdBy }
    )
    results.push(notifId)
  }
  return results
}

async function notifyProjectUpdated(project, changedFields, updatedBy) {
  const members = await db.query(
    'SELECT DISTINCT assigned_to as id FROM tasks WHERE project_id = ? AND assigned_to IS NOT NULL UNION SELECT owner_id as id FROM projects WHERE id = ?',
    [project.id, project.id]
  )
  const fieldNames = changedFields.map(f => f.field || f).join(', ')
  const results = []
  for (const member of members) {
    if (member.id === updatedBy) continue
    const notifId = await createNotification(
      member.id,
      'project_updated',
      'Project Updated',
      `Project "${project.name}" updated (${fieldNames})`,
      { link: `/dashboard/projects/${project.id}`, sourceType: 'project', sourceId: project.id, actorId: updatedBy }
    )
    results.push(notifId)
  }
  return results
}

async function notifyProjectDeleted(project, deletedBy) {
  const members = await db.query(
    'SELECT DISTINCT assigned_to as id FROM tasks WHERE project_id = ? AND assigned_to IS NOT NULL UNION SELECT owner_id as id FROM projects WHERE id = ?',
    [project.id, project.id]
  )
  const results = []
  for (const member of members) {
    if (member.id === deletedBy) continue
    const notifId = await createNotification(
      member.id,
      'project_deleted',
      'Project Deleted',
      `Project "${project.name}" has been deleted`,
      { sourceType: 'project', sourceId: project.id, actorId: deletedBy }
    )
    results.push(notifId)
  }
  return results
}

// ==================== DEPLOY NOTIFICATIONS ====================

async function notifyDeployExecuted(deploy, executedBy) {
  const admins = await db.query("SELECT id FROM users WHERE role = 'admin'")
  const results = []
  for (const admin of admins) {
    const notifId = await createNotification(
      admin.id,
      'deploy_executed',
      'Deployment Executed',
      `Deployment executed for project "${deploy.projectName || 'Unknown'}"`,
      { link: '/dashboard/deploy', sourceType: 'deploy', sourceId: deploy.id, actorId: executedBy }
    )
    results.push(notifId)
  }
  return results
}

async function notifyDeployFailed(deploy, error) {
  const admins = await db.query("SELECT id FROM users WHERE role = 'admin'")
  const results = []
  for (const admin of admins) {
    const notifId = await createNotification(
      admin.id,
      'deploy_failed',
      'Deployment Failed',
      `Deployment failed for "${deploy.projectName || 'Unknown'}": ${error}`,
      { link: '/dashboard/deploy', sourceType: 'deploy', sourceId: deploy.id }
    )
    results.push(notifId)
  }
  return results
}

// ==================== IT SUPPORT NOTIFICATIONS ====================

async function notifyPurchaseCreated(request, createdBy) {
  const admins = await db.query("SELECT id FROM users WHERE role = 'admin' AND id != ?", [createdBy])
  const results = []
  for (const admin of admins) {
    const notifId = await createNotification(
      admin.id,
      'purchase_created',
      'New Purchase Request',
      `New purchase request: "${request.title}" by ${request.requesterName || 'Someone'}`,
      { link: '/dashboard/it-support/purchases', sourceType: 'purchase', sourceId: request.id, actorId: createdBy }
    )
    results.push(notifId)
  }
  return results
}

async function notifyPurchaseApproved(request, approverName) {
  if (!request.requester_id) return null
  return createNotification(
    request.requester_id,
    'purchase_approved',
    'Purchase Request Approved',
    `Your purchase request "${request.title}" has been approved by ${approverName}`,
    { link: '/dashboard/it-support/purchases', sourceType: 'purchase', sourceId: request.id }
  )
}

async function notifyPurchaseRejected(request, rejectorName, reason) {
  if (!request.requester_id) return null
  return createNotification(
    request.requester_id,
    'purchase_rejected',
    'Purchase Request Rejected',
    `Your purchase request "${request.title}" has been rejected by ${rejectorName}${reason ? ': ' + reason : ''}`,
    { link: '/dashboard/it-support/purchases', sourceType: 'purchase', sourceId: request.id }
  )
}

async function notifyInventoryAssigned(item, assignedTo, assignedBy) {
  return createNotification(
    assignedTo,
    'inventory_assigned',
    'Item Assigned',
    `You have been assigned "${item.name}" from IT inventory`,
    { link: '/dashboard/it-support/inventory', sourceType: 'inventory', sourceId: item.id, actorId: assignedBy }
  )
}

// ==================== USER MANAGEMENT NOTIFICATIONS ====================

async function notifyUserCreated(user, createdBy) {
  return createNotification(
    user.id,
    'user_created',
    'Welcome to DevTrack',
    `Your account has been created. Welcome, ${user.name}!`,
    { link: '/dashboard', sourceType: 'user', sourceId: user.id, actorId: createdBy }
  )
}

async function notifyRoleChanged(userId, oldRole, newRole, changedBy) {
  return createNotification(
    userId,
    'role_changed',
    'Role Changed',
    `Your role has been changed from "${oldRole}" to "${newRole}"`,
    { link: '/dashboard/settings', sourceType: 'user', sourceId: userId, actorId: changedBy }
  )
}

async function notifyPasswordChanged(userId) {
  return createNotification(
    userId,
    'password_changed',
    'Password Changed',
    'Your password has been changed. If this was not you, contact admin immediately.',
    { link: '/dashboard/settings', sourceType: 'user', sourceId: userId }
  )
}

// ==================== SECURITY NOTIFICATIONS ====================

async function notifyLoginNewDevice(userId, deviceInfo) {
  return createNotification(
    userId,
    'login_new_device',
    'Login from New Device',
    `New login detected from ${deviceInfo.ip || 'unknown IP'} (${deviceInfo.browser || 'unknown browser'})`,
    { link: '/dashboard/settings', sourceType: 'security' }
  )
}

async function notifyBruteForceAttempt(ip, attempts) {
  const admins = await db.query("SELECT id FROM users WHERE role = 'admin'")
  const results = []
  for (const admin of admins) {
    const notifId = await createNotification(
      admin.id,
      'brute_force',
      'Brute Force Detected',
      `Multiple failed login attempts from IP ${ip} (${attempts} attempts)`,
      { link: '/dashboard/settings', sourceType: 'security' }
    )
    results.push(notifId)
  }
  return results
}

// ==================== SYSTEM NOTIFICATIONS ====================

async function notifySystemConfigChanged(adminId, action) {
  const admins = await db.query("SELECT id FROM users WHERE role = 'admin' AND id != ?", [adminId])
  const results = []
  for (const admin of admins) {
    const notifId = await createNotification(
      admin.id,
      'system_config',
      'System Configuration Changed',
      `System configuration was modified by an admin`,
      { link: '/dashboard/settings', sourceType: 'system', actorId: adminId }
    )
    results.push(notifId)
  }
  return results
}

async function notifyAgentOffline(agentName) {
  const admins = await db.query("SELECT id FROM users WHERE role = 'admin'")
  const results = []
  for (const admin of admins) {
    const notifId = await createNotification(
      admin.id,
      'agent_offline',
      'Agent Offline',
      `Remote agent "${agentName}" has gone offline`,
      { link: '/dashboard/remote', sourceType: 'remote' }
    )
    results.push(notifId)
  }
  return results
}

module.exports = {
  setSocketIO,
  emitToUser,
  getNotificationPreferences,
  createNotification,
  getUnreadCount,
  getNotifications,
  markAsRead,
  markAllAsRead,
  extractMentions,
  findUsersByUsernames,
  notifyTaskCreated,
  notifyTaskAssigned,
  notifyStatusChanged,
  notifyTaskUpdated,
  notifyTaskDeleted,
  notifyNewComment,
  notifyNewCommit,
  notifyChecklistChanged,
  notifyFileUploaded,
  notifyLabelsChanged,
  notifyDeadlineApproaching,
  notifyChatMention,
  notifyChatMessageOffline,
  notifyGroupMessageOffline,
  notifyReaction,
  notifyGroupMemberAdded,
  notifyGroupMemberRemoved,
  notifyCallMissed,
  notifyProjectCreated,
  notifyProjectUpdated,
  notifyProjectDeleted,
  notifyDeployExecuted,
  notifyDeployFailed,
  notifyPurchaseCreated,
  notifyPurchaseApproved,
  notifyPurchaseRejected,
  notifyInventoryAssigned,
  notifyUserCreated,
  notifyRoleChanged,
  notifyPasswordChanged,
  notifyLoginNewDevice,
  notifyBruteForceAttempt,
  notifySystemConfigChanged,
  notifyAgentOffline,
}
