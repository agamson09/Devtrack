import { query } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

const DEV_DIR = process.env.DEPLOY_DEV_DIR || '/var/www/html/app-dev'
const PROD_DIR = process.env.DEPLOY_PROD_DIR || '/var/www/html/app'

function getModuleFiles(module) {
  return new Promise((resolve) => {
    const files = []
    try {
      const modules = require('child_process').execSync(
        `find "${DEV_DIR}/Application" -name '*.php' -type f 2>/dev/null`,
        { encoding: 'utf8', timeout: 10000 }
      ).trim().split('\n').filter(Boolean)

      for (const f of modules) {
        const rel = f.replace(DEV_DIR + '/', '')
        let fileModule = 'general'

        if (rel.startsWith('Application/Model/')) {
          fileModule = 'model'
        } else if (/Controller\/(\w+)Controller\.php/.test(rel)) {
          fileModule = RegExp.$1.toLowerCase()
        } else if (/View\/([a-z_]+)\//.test(rel)) {
          fileModule = RegExp.$1.toLowerCase()
        } else if (/Main\/route_([a-z_]+)\.php/.test(rel)) {
          fileModule = RegExp.$1.toLowerCase()
        }

        if (!module || module === 'all' || fileModule === module.toLowerCase()) {
          files.push({ path: rel, module: fileModule })
        }
      }
    } catch (e) {}
    resolve(files)
  })
}

function getFileHash(filePath) {
  try {
    const content = fs.readFileSync(filePath)
    return crypto.createHash('md5').update(content).digest('hex')
  } catch {
    return null
  }
}

function getFileStat(filePath) {
  try {
    const stat = fs.statSync(filePath)
    return { modified: stat.mtime.toISOString(), size: stat.size, exists: true }
  } catch {
    return { modified: null, size: 0, exists: false }
  }
}

export default async function handler(req, res) {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Not authenticated' })

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { module = 'all' } = req.query
    const files = await getModuleFiles(module === 'all' ? null : module)

    const changed = []
    let pendingCount = 0
    let deployedCount = 0

    for (const file of files) {
      const devPath = path.join(DEV_DIR, file.path)
      const prodPath = path.join(PROD_DIR, file.path)

      const devStat = getFileStat(devPath)
      const prodStat = getFileStat(prodPath)

      const devHash = devStat.exists ? getFileHash(devPath) : null
      const prodHash = prodStat.exists ? getFileHash(prodPath) : null

      let status = 'identical'
      if (!prodStat.exists && devStat.exists) {
        status = 'new'
      } else if (devStat.exists && prodStat.exists) {
        if (devHash !== prodHash) {
          status = 'pending_deploy'
        } else {
          status = 'deployed'
        }
      }

      if (status === 'pending_deploy' || status === 'new') pendingCount++
      if (status === 'deployed') deployedCount++

      if (status !== 'identical') {
        changed.push({
          file: file.path,
          module: file.module,
          dev_modified: devStat.modified,
          dev_size: devStat.size,
          dev_hash: devHash,
          prod_modified: prodStat.modified,
          prod_size: prodStat.size,
          prod_hash: prodHash,
          status
        })
      }
    }

    return res.status(200).json({
      changed_files: changed,
      summary: {
        total_files: files.length,
        pending_deploy: pendingCount,
        deployed: deployedCount,
        identical: files.length - pendingCount - deployedCount
      }
    })
  } catch (err) {
    console.error('Diff error:', err)
    return res.status(500).json({ error: 'Failed to compute diff' })
  }
}
