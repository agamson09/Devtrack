import { query, insert } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import fs from 'fs'
import path from 'path'

const DEV_DIR = process.env.DEPLOY_DEV_DIR || '/var/www/html/app-dev'
const PROD_DIR = process.env.DEPLOY_PROD_DIR || '/var/www/html/app'
const BACKUP_DIR = '/var/www/backups'
const RETENTION_DAYS = 30

export default async function handler(req, res) {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Not authenticated' })

  if (req.method === 'POST') {
    try {
      const { files, deploy_log_id } = req.body
      if (!files || !Array.isArray(files) || files.length === 0) {
        return res.status(400).json({ error: 'files array required' })
      }

      const today = new Date().toISOString().split('T')[0]
      const backupSubDir = path.join(BACKUP_DIR, today)
      if (!fs.existsSync(backupSubDir)) fs.mkdirSync(backupSubDir, { recursive: true })

      const backups = []
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + RETENTION_DAYS)

      for (const filePath of files) {
        const prodFile = path.join(PROD_DIR, filePath)
        if (!fs.existsSync(prodFile)) continue

        const stat = fs.statSync(prodFile)
        const safePath = filePath.replace(/\//g, '_')
        const backupFileName = `${safePath}.${today}.bak`
        const backupPath = path.join(backupSubDir, backupFileName)

        fs.copyFileSync(prodFile, backupPath)

        await insert(
          'INSERT INTO deploy_backups (deploy_log_id, file_path, backup_path, original_size, expires_at) VALUES (?, ?, ?, ?, ?)',
          [deploy_log_id || null, filePath, backupPath, stat.size, expiresAt]
        )

        backups.push({
          file: filePath,
          backup_path: backupPath,
          size: stat.size,
          expires_at: expiresAt
        })
      }

      return res.status(200).json({ success: true, backups })
    } catch (err) {
      console.error('Backup error:', err)
      return res.status(500).json({ error: 'Backup failed' })
    }
  }

  if (req.method === 'GET') {
    try {
      const stats = await query(`
        SELECT COUNT(*) as total_files, 
               COALESCE(SUM(original_size), 0) as total_size,
               MIN(expires_at) as next_expiry,
               SUM(CASE WHEN expires_at <= DATE_ADD(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) as expiring_soon
        FROM deploy_backups
      `)
      return res.status(200).json({ stats: stats[0] || {} })
    } catch (err) {
      console.error('Backup stats error:', err)
      return res.status(500).json({ error: 'Failed to fetch stats' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
