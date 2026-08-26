const fs = require('fs')
const path = require('path')

// NOTE: process.cwd() instead of __dirname — Turbopack rewrites __dirname to a
// synthetic root in server bundles, which breaks fs paths at runtime.
const CONFIG_PATH = path.join(process.cwd(), 'workspace.config.json')

function loadConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return { defaultWorkspace: 'default', workspaces: {} }
  }
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', 'utf-8')
}

function getWorkspaceConfig(slug) {
  const config = loadConfig()
  return config.workspaces[slug] || null
}

function getDefaultWorkspace() {
  const config = loadConfig()
  return config.workspaces[config.defaultWorkspace] || null
}

function addWorkspaceConfig(slug, data) {
  const config = loadConfig()
  config.workspaces[slug] = {
    name: data.name,
    slug,
    database: data.database,
    url: data.url || '',
  }
  saveConfig(config)
  return config.workspaces[slug]
}

function removeWorkspaceConfig(slug) {
  const config = loadConfig()
  delete config.workspaces[slug]
  saveConfig(config)
}

module.exports = {
  loadConfig,
  saveConfig,
  getWorkspaceConfig,
  getDefaultWorkspace,
  addWorkspaceConfig,
  removeWorkspaceConfig,
}
