const webPush = require('web-push')
const db = require('./db')

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@devtrack.local'

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
}

function getVAPIDPublicKey() {
  return VAPID_PUBLIC_KEY || null
}

async function saveSubscription(userId, subscription, userAgent = null) {
  const { endpoint, keys } = subscription
  if (!endpoint || !keys || !keys.p256dh || !keys.auth) return null

  const existing = await db.queryOne(
    'SELECT id FROM push_subscriptions WHERE endpoint = ?',
    [endpoint]
  )

  if (existing) {
    await db.update(
      'UPDATE push_subscriptions SET user_id = ?, p256dh = ?, auth = ?, user_agent = ?, is_active = 1 WHERE endpoint = ?',
      [userId, keys.p256dh, keys.auth, userAgent, endpoint]
    )
    return existing.id
  }

  const result = await db.insert(
    'INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent, is_active) VALUES (?, ?, ?, ?, ?, 1)',
    [userId, endpoint, keys.p256dh, keys.auth, userAgent]
  )
  return result.insertId
}

async function removeSubscription(endpoint) {
  return db.remove(
    'DELETE FROM push_subscriptions WHERE endpoint = ?',
    [endpoint]
  )
}

async function sendPushNotification(userId, { title, body, url, tag, actions }) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return

  const subscriptions = await db.query(
    'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ? AND is_active = 1',
    [userId]
  )

  if (!subscriptions.length) return

  const payload = JSON.stringify({
    title: title || 'DevTrack',
    body: body || '',
    url: url || '/dashboard',
    tag: tag || 'devtrack-notification',
    actions: actions || [{ action: 'open', title: 'Open' }],
  })

  const results = []
  for (const sub of subscriptions) {
    try {
      await webPush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      )
      results.push({ endpoint: sub.endpoint, success: true })
    } catch (err) {
      console.error('Push send error:', err.statusCode, sub.endpoint)
      if (err.statusCode === 404 || err.statusCode === 410) {
        await removeSubscription(sub.endpoint)
        console.log('Removed expired subscription:', sub.endpoint)
      }
      results.push({ endpoint: sub.endpoint, success: false, error: err.statusCode })
    }
  }

  return results
}

async function sendPushToMultipleUsers(userIds, notification) {
  const results = []
  for (const userId of userIds) {
    if (!userId) continue
    try {
      const res = await sendPushNotification(userId, notification)
      results.push({ userId, results: res })
    } catch (err) {
      console.error('Push to user error:', userId, err.message)
    }
  }
  return results
}

module.exports = {
  getVAPIDPublicKey,
  saveSubscription,
  removeSubscription,
  sendPushNotification,
  sendPushToMultipleUsers,
}
