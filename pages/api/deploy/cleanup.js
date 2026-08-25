import { query } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import fs from 'fs'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Not authenticated' })
  if (user.role !== 'admin') return res.status(403).json({ error: 'Admin only' })

  try {
    const expired = await query('SELECT * FROM deploy_backups WHERE expires_at < NOW()')
    let deleted = 0

    for (const backup of expired) {
      try {
        if (fs.existsSync(backup.backup_path)) {
          fs.unlinkSync(backup.backup_path)
        }
        deleted++
      } catch (e) {}
    }

    await query('DELETE FROM deploy_backups WHERE expires_at < NOW()')

    return res.status(200).json({ success: true, deleted_files: deleted })
  } catch (err) {
    console.error('Cleanup error:', err)
    return res.status(500).json({ error: 'Cleanup failed' })
  }
}
