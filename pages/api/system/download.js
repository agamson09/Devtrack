import { getAuthUser } from '@/lib/auth';
import fs from 'fs';
import path from 'path';

const BACKUP_DIR = '/var/backups/mysql';

export default async function handler(req, res) {
  const user = await getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  if (req.method === 'GET') {
    const { file } = req.query;
    if (!file) {
      return res.status(400).json({ error: 'Filename required' });
    }

    if (file.includes('..') || file.includes('/')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    const filepath = path.join(BACKUP_DIR, file);
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'Backup not found' });
    }

    const stat = fs.statSync(filepath);
    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Disposition', `attachment; filename="${file}"`);

    fs.createReadStream(filepath).pipe(res);
    return;
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
