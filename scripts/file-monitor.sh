#!/bin/bash
# File Activity Monitor for DevTrack
# Monitors the dev deploy directory for file changes via SFTP
# Logs changes to DevTrack API at http://127.0.0.1:3000/api/deploy/file-activity

DEV_DIR="${DEPLOY_DEV_DIR:-/var/www/html/app-dev}"
API_URL="http://127.0.0.1:3000/api/deploy/file-activity"
LOG_FILE="/var/log/file-monitor.log"
PID_FILE="/var/run/file-monitor.pid"
JWT_SECRET=$(grep JWT_SECRET /var/www/devtrack/.env.local | cut -d= -f2)

# Generate a service JWT token for API auth
generate_token() {
  local payload="{\"id\":1,\"email\":\"system@devtrack.local\",\"role\":\"admin\",\"iat\":$(date +%s),\"exp\":$(($(date +%s)+86400))}"
  local header='{"alg":"HS256","typ":"JWT"}'
  
  local header_b64=$(echo -n "$header" | base64 -w 0 | tr '+/' '-_' | tr -d '=')
  local payload_b64=$(echo -n "$payload" | base64 -w 0 | tr '+/' '-_' | tr -d '=')
  local signature=$(echo -n "${header_b64}.${payload_b64}" | openssl dgst -sha256 -hmac "$JWT_SECRET" -binary | base64 -w 0 | tr '+/' '-_' | tr -d '=')
  
  echo "${header_b64}.${payload_b64}.${signature}"
}

detect_module() {
  local filepath="$1"
  local module="general"
  
  # Controller pattern: CableController.php → cable
  if echo "$filepath" | grep -qiE 'Controller/[A-Za-z]+Controller\.php'; then
    local ctrl=$(echo "$filepath" | grep -oEi '[A-Za-z]+Controller\.php' | head -1)
    module=$(echo "$ctrl" | sed 's/Controller\.php//' | tr '[:upper:]' '[:lower:]')
  
  # Model pattern: CableModel.php → cable
  elif echo "$filepath" | grep -qiE 'Model/[A-Za-z]+Model\.php'; then
    local mdl=$(echo "$filepath" | grep -oEi '[A-Za-z]+Model\.php' | head -1)
    module=$(echo "$mdl" | sed 's/Model\.php//' | tr '[:upper:]' '[:lower:]')
  
  # Model special: InventoryAudit.php → inventory
  elif echo "$filepath" | grep -qiE 'Model/InventoryAudit\.php'; then
    module="inventory"
  
  # View folder: View/cable/* → cable
  elif echo "$filepath" | grep -qiE 'View/([a-z_]+)'; then
    module=$(echo "$filepath" | grep -oEi 'View/[a-z_]+' | head -1 | sed 's|View/||')
  
  # Route file: route_cable.php → cable
  elif echo "$filepath" | grep -qiE 'Main/route_[a-z_]+\.php'; then
    module=$(echo "$filepath" | grep -oEi 'route_[a-z_]+' | head -1 | sed 's/route_//')
  
  # Route main: route.php → general
  elif echo "$filepath" | grep -qiE 'Main/route\.php'; then
    module="general"
  
  # Config files
  elif echo "$filepath" | grep -qiE 'Config/'; then
    module="config"
  
  # Middleware
  elif echo "$filepath" | grep -qiE 'Middleware/'; then
    module="middleware"
  
  # Service
  elif echo "$filepath" | grep -qiE 'Service/'; then
    module="service"
  
  # System/Core
  elif echo "$filepath" | grep -qiE 'System/'; then
    module="system"
  
  # Templates
  elif echo "$filepath" | grep -qiE 'Templates/'; then
    module="templates"
  
  # Assets
  elif echo "$filepath" | grep -qiE 'assets/'; then
    module="assets"
  fi
  
  echo "$module"
}

send_event() {
  local filepath="$1"
  local action="$2"
  local filesize="$3"
  local module
  module=$(detect_module "$filepath")
  local token
  token=$(generate_token)
  
  local payload="{\"file_path\":\"$filepath\",\"action\":\"$action\",\"file_size\":$filesize,\"module\":\"$module\"}"
  
  curl -s -X POST "$API_URL" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $token" \
    -d "$payload" >> "$LOG_FILE" 2>&1
}

# Write PID
echo $$ > "$PID_FILE"

echo "[$(date)] File Monitor started. Watching $DEV_DIR" >> "$LOG_FILE"

# Monitor PHP files for changes
inotifywait -m -r -e modify,create,delete,move \
  --include '\.(php|js|css|html|json|sql)$' \
  --timefmt '%Y-%m-%d %H:%M:%S' \
  --format '%T %w%f %e' \
  "$DEV_DIR" 2>/dev/null | while read timestamp filepath event; do
  
  # Skip temp/cache files
  if echo "$filepath" | grep -qE '(Temp/|\.git/|node_modules/|vendor/)'; then
    continue
  fi
  
  # Get relative path from dev dir
  rel_path="${filepath#$DEV_DIR/}"
  
  # Determine action
  action="modified"
  if echo "$event" | grep -q "CREATE"; then
    action="created"
  elif echo "$event" | grep -q "DELETE"; then
    action="deleted"
  fi
  
  # Get file size (0 if deleted)
  filesize=0
  if [ -f "$filepath" ]; then
    filesize=$(stat -c%s "$filepath" 2>/dev/null || echo 0)
  fi
  
  # Debounce: wait 1 second for rapid saves
  sleep 1
  
  echo "[$timestamp] $action $rel_path ($filesize bytes, module=$(detect_module $rel_path))" >> "$LOG_FILE"
  send_event "$rel_path" "$action" "$filesize" &
  
done &

echo "[$(date)] Monitoring started with PID $!" >> "$LOG_FILE"
wait
