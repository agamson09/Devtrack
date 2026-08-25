import { verifyToken } from '@/lib/auth'
import { IncomingForm } from 'formidable'
import fs from 'fs'
import path from 'path'

export const config = {
  api: {
    bodyParser: false,
  },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const token = req.cookies.devtrack_token || req.cookies.token || req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  try {
    const user = verifyToken(token)
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin only' })
    }

    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'tenant')
    fs.mkdirSync(uploadDir, { recursive: true })

    const form = new IncomingForm({
      multiples: false,
      uploadDir,
      keepExtensions: true,
      maxFileSize: 5 * 1024 * 1024,
      filter: ({ mimetype }) => {
        return mimetype && mimetype.startsWith('image/')
      },
    })

    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err)
        else resolve([fields, files])
      })
    })

    const file = files.logo?.[0] || files.file?.[0]
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    const ext = path.extname(file.originalFilename || file.newFilename || '.png')
    const type = (fields.type?.[0] || 'logo') === 'icon' ? 'icon' : 'logo'
    const filename = `${type}_${Date.now()}${ext}`
    const newPath = path.join(uploadDir, filename)

    fs.renameSync(file.filepath, newPath)

    const url = `/uploads/tenant/${filename}`
    return res.status(200).json({ success: true, url })
  } catch (error) {
    console.error('[tenant/logo] Error:', error)
    return res.status(500).json({ error: 'Upload failed' })
  }
}
