import { getAuthUser } from '@/lib/auth';
import fs from 'fs';
import path from 'path';

const ENV_PATH = '/var/www/devtrack/.env.local';

export default async function handler(req, res) {
  const user = await getAuthUser(req);
  if (!user || user.id !== 1) {
    return res.status(403).json({ error: 'System Admin access required' });
  }

  if (req.method === 'GET') {
    try {
      if (!fs.existsSync(ENV_PATH)) {
        return res.status(200).json({ content: '', exists: false });
      }
      const content = fs.readFileSync(ENV_PATH, 'utf-8');
      const lines = content.split('\n').map(line => {
        if (line.startsWith('#') || line.trim() === '') {
          return { type: 'comment', raw: line };
        }
        const eqIndex = line.indexOf('=');
        if (eqIndex === -1) return { type: 'comment', raw: line };
        const key = line.substring(0, eqIndex).trim();
        const value = line.substring(eqIndex + 1).trim();
        const isSensitive = /password|secret|token|key|pass/i.test(key);
        return { type: 'variable', key, value, isSensitive, raw: line };
      });
      return res.status(200).json({ content, lines, exists: true });
    } catch (error) {
      console.error('Read .env error:', error);
      return res.status(500).json({ error: 'Failed to read .env file' });
    }
  }

  if (req.method === 'POST') {
    const { action, content, key, value } = req.body;

    if (action === 'save') {
      try {
        if (!content || typeof content !== 'string') {
          return res.status(400).json({ error: 'Content required' });
        }
        const backupPath = ENV_PATH + '.backup';
        if (fs.existsSync(ENV_PATH)) {
          fs.copyFileSync(ENV_PATH, backupPath);
        }
        fs.writeFileSync(ENV_PATH, content, 'utf-8');
        return res.status(200).json({ success: true, message: 'Saved. Restart server to apply.' });
      } catch (error) {
        console.error('Save .env error:', error);
        return res.status(500).json({ error: 'Failed to save .env file' });
      }
    }

    if (action === 'update_var') {
      try {
        if (!key || value === undefined) {
          return res.status(400).json({ error: 'Key and value required' });
        }
        const safeKey = key.replace(/[^a-zA-Z0-9_]/g, '');
        if (!safeKey) {
          return res.status(400).json({ error: 'Invalid key' });
        }
        let fileContent = fs.readFileSync(ENV_PATH, 'utf-8');
        const regex = new RegExp(`^${safeKey}=.*$`, 'm');
        if (regex.test(fileContent)) {
          fileContent = fileContent.replace(regex, `${safeKey}=${value}`);
        } else {
          fileContent += `\n${safeKey}=${value}`;
        }
        const backupPath = ENV_PATH + '.backup';
        if (fs.existsSync(ENV_PATH)) {
          fs.copyFileSync(ENV_PATH, backupPath);
        }
        fs.writeFileSync(ENV_PATH, fileContent, 'utf-8');
        return res.status(200).json({ success: true, message: `Updated ${safeKey}. Restart server to apply.` });
      } catch (error) {
        console.error('Update .env var error:', error);
        return res.status(500).json({ error: 'Failed to update variable' });
      }
    }

    if (action === 'restart') {
      try {
        const { execSync } = await import('child_process');
        execSync('pm2 restart devtrack', { timeout: 10000 });
        return res.status(200).json({ success: true, message: 'Server restarting...' });
      } catch (error) {
        return res.status(500).json({ error: 'Restart failed' });
      }
    }

    return res.status(400).json({ error: 'Invalid action' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
