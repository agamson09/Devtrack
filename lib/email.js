const nodemailer = require('nodemailer')
const db = require('./db')

let transporter = null

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: process.env.EMAIL_PORT === '465',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    })
  }
  return transporter
}

async function sendEmail(to, subject, html) {
  const transport = getTransporter()

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to,
    subject,
    html
  }

  const info = await transport.sendMail(mailOptions)
  return info
}

async function notifyViaEmail(userId, subject, html) {
  const user = await db.queryOne(
    'SELECT email FROM users WHERE id = ?',
    [userId]
  )

  if (!user || !user.email) {
    return null
  }

  return sendEmail(user.email, subject, html)
}

module.exports = {
  sendEmail,
  notifyViaEmail
}
