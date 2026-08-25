import { getAuthUser } from '@/lib/auth'
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'

const DEV_DIR = process.env.DEPLOY_DEV_DIR || '/var/www/html/app-dev'
const PROD_DIR = process.env.DEPLOY_PROD_DIR || '/var/www/html/app'

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8')
  } catch {
    return null
  }
}

function computeDiff(devContent, prodContent) {
  const devFile = path.join('/tmp', `dev_${Date.now()}.tmp`)
  const prodFile = path.join('/tmp', `prod_${Date.now()}.tmp`)

  try {
    fs.writeFileSync(devFile, devContent || '')
    fs.writeFileSync(prodFile, prodContent || '')

    let diffOutput
    try {
      diffOutput = execSync(
        `diff -u --label "DEV" --label "PROD" "${prodFile}" "${devFile}"`,
        { encoding: 'utf8', timeout: 5000 }
      )
    } catch (e) {
      if (e.status === 1) diffOutput = e.stdout || ''
      else diffOutput = ''
    }

    const lines = diffOutput.split('\n')
    const hunks = []
    let currentHunk = null

    for (const line of lines) {
      if (line.startsWith('@@')) {
        const match = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/)
        if (match) {
          currentHunk = {
            oldStart: parseInt(match[1]),
            oldCount: parseInt(match[2] || '1'),
            newStart: parseInt(match[3]),
            newCount: parseInt(match[4] || '1'),
            lines: []
          }
          hunks.push(currentHunk)
        }
      } else if (currentHunk) {
        currentHunk.lines.push(line)
      }
    }

    return {
      hunks,
      stats: {
        additions: lines.filter(l => l.startsWith('+') && !l.startsWith('+++')).length,
        deletions: lines.filter(l => l.startsWith('-') && !l.startsWith('---')).length,
      },
      raw: diffOutput
    }
  } finally {
    try { fs.unlinkSync(devFile) } catch {}
    try { fs.unlinkSync(prodFile) } catch {}
  }
}

export default async function handler(req, res) {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Not authenticated' })
  if (user.role !== 'admin') return res.status(403).json({ error: 'Admin only' })

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { file } = req.query
    if (!file) return res.status(400).json({ error: 'file parameter required' })

    const devPath = path.join(DEV_DIR, file)
    const prodPath = path.join(PROD_DIR, file)

    if (!fs.existsSync(devPath)) {
      return res.status(404).json({ error: 'File not found in dev' })
    }

    const devContent = readFileSafe(devPath)
    const prodContent = readFileSafe(prodPath)

    const diff = computeDiff(devContent, prodContent)

    const devStat = getFileStat(devPath)
    const prodStat = getFileStat(prodPath)

    return res.status(200).json({
      file,
      dev: { exists: true, ...devStat, content: devContent },
      prod: { exists: prodStat.exists, ...prodStat, content: prodContent },
      diff,
    })
  } catch (err) {
    console.error('File diff error:', err)
    return res.status(500).json({ error: 'Failed to compute file diff' })
  }
}

function getFileStat(filePath) {
  try {
    const stat = fs.statSync(filePath)
    return { modified: stat.mtime.toISOString(), size: stat.size }
  } catch {
    return { modified: null, size: 0 }
  }
}
