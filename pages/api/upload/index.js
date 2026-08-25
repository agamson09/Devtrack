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
      return mimetype && mimetype.startsWith('image/')
    },
  })

  try {
    const { files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err)
        else resolve({ files })
      })
    })

    const file = files.image
    if (!file) {
      return res.status(400).json({ error: 'No image file provided' })
    }

    const fileObj = Array.isArray(file) ? file[0] : file
    const ext = path.extname(fileObj.originalFilename || fileObj.filepath).toLowerCase() || '.jpg'
    const filename = `${Date.now()}-${user.id}${ext}`
    const newPath = path.join(uploadDir, filename)

    fs.renameSync(fileObj.filepath, newPath)

    let sharp
    try {
      sharp = (await import('sharp')).default
    } catch {
      sharp = null
    }

    if (sharp) {
      try {
        const metadata = await sharp(newPath).metadata()
        let pipeline = sharp(newPath)

        if (metadata.width > 1200) {
          pipeline = pipeline.resize({ width: 1200, withoutEnlargement: true })
        }

        if (ext === '.png') {
          pipeline = pipeline.jpeg({ quality: 80 })
        } else {
          pipeline = pipeline.jpeg({ quality: 80 })
        }

        const compressedPath = path.join(uploadDir, `c_${filename}.jpg`)
        await pipeline.toFile(compressedPath)
        fs.unlinkSync(newPath)
        const finalFilename = `c_${filename}.jpg`

        return res.status(200).json({
          url: `/uploads/chat/${finalFilename}`,
          filename: finalFilename,
        })
      } catch (compressErr) {
        // keep original
      }
    }

    return res.status(200).json({
      url: `/uploads/chat/${filename}`,
      filename,
    })
  } catch (err) {
    console.error('Upload error:', err)
    return res.status(500).json({ error: 'Upload failed' })
  }
}
