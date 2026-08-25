import { getAuthUser } from '@/lib/auth'
import { IncomingForm } from 'formidable'
import fs from 'fs'
import path from 'path'

export const config = {
  api: { bodyParser: false },
}

export default async function handler(req, res) {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'chat')
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true })
  }

  const form = new IncomingForm({
    uploadDir,
    keepExtensions: true,
    maxFileSize: 10 * 1024 * 1024,
    filter: ({ mimetype }) => {
      return mimetype && (mimetype.startsWith('audio/') || mimetype === 'video/webm')
    },
  })

  try {
    const { files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err)
        else resolve({ files })
      })
    })

    const file = files.audio
    if (!file) {
      return res.status(400).json({ error: 'No audio file provided' })
    }

    const fileObj = Array.isArray(file) ? file[0] : file
    const ext = path.extname(fileObj.originalFilename || fileObj.filepath) || '.webm'
    const filename = `voice_${Date.now()}-${user.id}${ext}`
    const newPath = path.join(uploadDir, filename)

    fs.renameSync(fileObj.filepath, newPath)

    return res.status(200).json({
      url: `/uploads/chat/${filename}`,
      filename,
    })
  } catch (err) {
    console.error('Voice upload error:', err)
    return res.status(500).json({ error: 'Upload failed' })
  }
}
