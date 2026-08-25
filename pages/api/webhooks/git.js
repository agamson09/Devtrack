import crypto from 'crypto'
import db from '@/lib/db'
import { autoDeployForPush } from '@/lib/gitDeploy'

const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET
const GITLAB_WEBHOOK_TOKEN = process.env.GITLAB_WEBHOOK_TOKEN

function verifyGitHubSignature(payload, signature) {
  if (!GITHUB_WEBHOOK_SECRET || !signature) return true
  const expected = 'sha256=' + crypto
    .createHmac('sha256', GITHUB_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  } catch {
    return false
  }
}

function verifyGitlabToken(token) {
  if (!GITLAB_WEBHOOK_TOKEN) return true
  return token === GITLAB_WEBHOOK_TOKEN
}

function extractTaskIds(message) {
  const regex = /#(\d+)/g
  const taskIds = []
  let match
  while ((match = regex.exec(message)) !== null) {
    taskIds.push(parseInt(match[1]))
  }
  return [...new Set(taskIds)]
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    let payload = req.body
    let source = null

    const githubSignature = req.headers['x-hub-signature-256']
    const gitlabToken = req.headers['x-gitlab-token']
    const eventType = req.headers['x-github-event'] || req.headers['x-gitlab-event']

    if (githubSignature) {
      const rawBody = JSON.stringify(req.body)
      if (!verifyGitHubSignature(rawBody, githubSignature)) {
        return res.status(401).json({ error: 'Invalid signature' })
      }
      source = 'github'
    } else if (gitlabToken) {
      if (!verifyGitlabToken(gitlabToken)) {
        return res.status(401).json({ error: 'Invalid token' })
      }
      source = 'gitlab'
    } else {
      source = 'unknown'
    }

    if (eventType === 'push' || eventType === 'Push Events') {
      let commits = []

      if (source === 'github' || source === 'unknown') {
        commits = (payload.commits || []).map(commit => ({
          sha: commit.id,
          message: commit.message,
          author: commit.author.name,
          email: commit.author.email,
          url: commit.url
        }))
      } else if (source === 'gitlab') {
        commits = (payload.commits || []).map(commit => ({
          sha: commit.id,
          message: commit.message,
          author: commit.author.name,
          email: commit.author.email,
          url: commit.url
        }))
      }

      for (const commit of commits) {
        const taskIds = extractTaskIds(commit.message)

        for (const taskId of taskIds) {
          const existingTask = await db.queryOne(
            'SELECT id, title, assigned_to, created_by FROM tasks WHERE id = ?',
            [taskId]
          )

          if (!existingTask) continue

          const existingCommit = await db.queryOne(
            'SELECT id FROM task_commits WHERE commit_hash = ? AND task_id = ?',
            [commit.sha, taskId]
          )

          if (existingCommit) continue

          const commitUser = await db.queryOne(
            'SELECT id FROM users WHERE email = ?',
            [commit.email]
          )

          const committerId = commitUser ? commitUser.id : existingTask.created_by

          await db.insert(
            `INSERT INTO task_commits (task_id, commit_hash, commit_message, author, added_lines, deleted_lines, status, created_at) 
            VALUES (?, ?, ?, ?, 0, 0, 'auto', NOW())`,
            [taskId, commit.sha, commit.message, commit.author]
          )

          await db.insert(
            'INSERT INTO activity_logs (user_id, action, target_type, target_id, details, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
            [committerId, 'linked commit to task', 'task', taskId, JSON.stringify({ commit_hash: commit.sha.substring(0, 7), title: existingTask.title })]
          )
        }
      }
    }

    // ---- Auto-deploy: push matching an auto_deploy target ------------------
    if (eventType === 'push' || eventType === 'Push Events') {
      const pushedRepo = payload.repository?.clone_url
        || payload.repository?.html_url
        || payload.project?.git_http_url
        || null
      const pushedBranch = (payload.ref || '').replace('refs/heads/', '')

      if (pushedRepo && pushedBranch) {
        // Respond immediately — deploy runs in the background
        autoDeployForPush(pushedRepo, pushedBranch)
          .then((r) => {
            if (r) console.log(`[webhook] auto-deploy ${r.skipped ? 'skipped' : 'finished'} for ${r.config}`)
          })
          .catch((err) => console.error('[webhook] auto-deploy failed:', err.message))
      }
    }

    return res.status(200).json({ success: true, commitsProcessed: (req.body.commits || []).length })
  } catch (error) {
    console.error('Git webhook error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb'
    }
  }
}
