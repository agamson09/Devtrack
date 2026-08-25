import { query, update } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import fs from 'fs'
import path from 'path'

const PROD_DIR = process.env.DEPLOY_PROD_DIR || '/var/www/html/app'

export default async function handler(req, res) {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Not authenticated' })
  if (user.role !== 'admin') return res.status(403).json({ error: 'Admin only' })

  if (req.method === 'POST') {
    try {
      const { deploy_log_id, files } = req.body
      if (!deploy_log_id) return res.status(400).json({ error: 'deploy_log_id required' })

      const deployLog = await query('SELECT * FROM deploy_logs WHERE id = ?', [deploy_log_id])
      if (!deployLog.length) return res.status(404).json({ error: 'Deploy log not found' })

      let sql = 'SELECT * FROM deploy_backups WHERE deploy_log_id = ?'
      const params = [deploy_log_id]

      if (files && Array.isArray(files) && files.length > 0) {
        const placeholders = files.map(() => '?').join(',')
        sql += ` AND file_path IN (${placeholders})`
        params.push(...files)
      }

      sql += ' ORDER BY id DESC'
      const backups = await query(sql, params)

      if (!backups.length) return res.status(404).json({ error: 'No backups found for this deploy' })

      let restored = 0
      const restoredFiles = []
      for (const backup of backups) {
        if (fs.existsSync(backup.backup_path)) {
          const prodFile = path.join(PROD_DIR, backup.file_path)
          const prodDir = path.dirname(prodFile)
          if (!fs.existsSync(prodDir)) fs.mkdirSync(prodDir, { recursive: true })
          fs.copyFileSync(backup.backup_path, prodFile)
          restored++
          restoredFiles.push(backup.file_path)
        }
      }

      if (!files || !Array.isArray(files) || files.length === 0) {
        await update(
          'UPDATE deploy_logs SET status = "rolled_back" WHERE id = ?',
          [deploy_log_id]
        )
      }

      return res.status(200).json({
        success: true,
        restored_files: restored,
        restored_file_list: restoredFiles,
        total_backups: backups.length
      })
    } catch (err) {
      console.error('Rollback error:', err)
      return res.status(500).json({ error: 'Rollback failed' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
