import { query, insert, update } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import { notifyDeployExecuted } from '@/lib/notifications'
import fs from 'fs'
import path from 'path'

const DEV_DIR = process.env.DEPLOY_DEV_DIR || '/var/www/html/app-dev'
const PROD_DIR = process.env.DEPLOY_PROD_DIR || '/var/www/html/app'
const BACKUP_DIR = '/var/www/backups'
const RETENTION_DAYS = 30

function backupFile(filePath) {
  const prodFile = path.join(PROD_DIR, filePath)
  if (!fs.existsSync(prodFile)) return null

  const today = new Date().toISOString().split('T')[0]
  const backupSubDir = path.join(BACKUP_DIR, today)
  if (!fs.existsSync(backupSubDir)) fs.mkdirSync(backupSubDir, { recursive: true })

  const stat = fs.statSync(prodFile)
  const safePath = filePath.replace(/\//g, '_')
  const backupFileName = `${safePath}.${today}.bak`
  const backupPath = path.join(backupSubDir, backupFileName)

  fs.copyFileSync(prodFile, backupPath)
  return { backupPath, size: stat.size }
}

export default async function handler(req, res) {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Not authenticated' })
  if (user.role !== 'admin') return res.status(403).json({ error: 'Admin only' })

  if (req.method === 'POST') {
    try {
      const { files, module, task_id, note } = req.body
      if (!files || !Array.isArray(files) || files.length === 0) {
        return res.status(400).json({ error: 'files array required' })
      }

      const filesJson = JSON.stringify(files)

      const deployResult = await insert(
        'INSERT INTO deploy_logs (task_id, module, files_json, deployed_by, status, note) VALUES (?, ?, ?, ?, ?, ?)',
        [task_id || null, module || 'general', filesJson, user.id, 'pending', note || null]
      )
      const deployLogId = deployResult.insertId

      const backups = []
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + RETENTION_DAYS)

      for (const filePath of files) {
        const devFile = path.join(DEV_DIR, filePath)
        const prodFile = path.join(PROD_DIR, filePath)

        if (!fs.existsSync(devFile)) continue

        const backup = backupFile(filePath)
        if (backup) {
          await insert(
            'INSERT INTO deploy_backups (deploy_log_id, file_path, backup_path, original_size, expires_at) VALUES (?, ?, ?, ?, ?)',
            [deployLogId, filePath, backup.backupPath, backup.size, expiresAt]
          )
          backups.push(backup)
        }

        const prodDir = path.dirname(prodFile)
        if (!fs.existsSync(prodDir)) fs.mkdirSync(prodDir, { recursive: true })
        fs.copyFileSync(devFile, prodFile)
      }

      await update(
        'UPDATE deploy_logs SET status = "deployed", deployed_at = NOW() WHERE id = ?',
        [deployLogId]
      )

      if (global.io) {
        global.io.emit('deploy:executed', {
          deployer: user.name,
          fileCount: files.length,
          module: module || 'general',
          note: note || '',
          deployId: deployLogId,
          timestamp: new Date().toISOString()
        })
      }

      try {
        await notifyDeployExecuted({ id: deployLogId, projectName: module || 'general' }, user.id)
      } catch (e) { console.error('Deploy notification error:', e) }

      return res.status(200).json({
        success: true,
        deploy_id: deployLogId,
        deployed_files: files,
        backups_count: backups.length
      })
    } catch (err) {
      console.error('Deploy error:', err)
      return res.status(500).json({ error: 'Deploy failed' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
