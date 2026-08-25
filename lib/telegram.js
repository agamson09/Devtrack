const db = require('./db')

async function sendTelegramMessage(chatId, message) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) {
    throw new Error('TELEGRAM_BOT_TOKEN not configured')
  }

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML'
    })
  })

  const data = await response.json()
  if (!data.ok) {
    throw new Error(`Telegram API error: ${data.description}`)
  }
  return data
}

async function notifyViaTelegram(userId, message) {
  const user = await db.queryOne(
    'SELECT telegram_chat_id FROM users WHERE id = ?',
    [userId]
  )

  if (!user || !user.telegram_chat_id) {
    return null
  }

  return sendTelegramMessage(user.telegram_chat_id, message)
}

module.exports = {
  sendTelegramMessage,
  notifyViaTelegram
}
