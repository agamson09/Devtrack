import { getAuthUser } from '@/lib/auth'
import { IncomingForm } from 'formidable'
import fs from 'fs'
import path from 'path'

const UPLOAD_DIR = '/tmp/devtrack-transfer'

export const config = {
  api: { bodyParser: false }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Not authenticated' })
  if (user.role !== 'admin') return res.status(403).json({ error: 'Admin only' })

  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true })

  try {
    const { files } = await new Promise((resolve, reject) => {
      const form = new IncomingForm({
        uploadDir: UPLOAD_DIR,
        keepExtensions: true,
        maxFileSize: 100 * 1024 * 1024, // 100MB
      })
      form.parse(req, (err, fields, files) => {
        if (err) reject(err)
        else resolve({ files })
      })
    })

    const file = files.file?.[0] || files.file
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    const filename = file.originalFilename || file.newFilename
    const fileData = fs.readFileSync(file.filepath)
    const base64 = fileData.toString('base64')

    // Clean up temp file
    fs.unlinkSync(file.filepath)

    return res.status(200).json({
      success: true,
      filename,
      size: fileData.length,
      data: base64
    })
  } catch (error) {
    console.error('Transfer API error:', error)
    return res.status(500).json({ error: 'File transfer failed: ' + error.message })
  }
}
