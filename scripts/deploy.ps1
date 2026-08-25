# ============================================
# DevTrack Deploy Manager
# Run: .\scripts\deploy.ps1
# ============================================

param(
    [string]$Server = $env:DEPLOY_HOST,
    [string]$User = $env:DEPLOY_USER,
    [string]$Password = $env:DEPLOY_PASS,
    [string]$RemotePath = "/var/www/devtrack",
    [switch]$SkipBuild,
    [switch]$SkipUpload,
    [switch]$SkipRestart
)

$ErrorActionPreference = "Stop"

if (-not $Server -or -not $User -or -not $Password) {
    Write-Host "[!] Set DEPLOY_HOST / DEPLOY_USER / DEPLOY_PASS env vars (or pass -Server/-User/-Password)." -ForegroundColor Red
    exit 1
}

# Colors
$Green = "`e[32m"
$Yellow = "`e[33m"
$Red = "`e[31m"
$Cyan = "`e[36m"
$Reset = "`e[0m"

function Write-Status($msg) { Write-Host "${Green}[✓]${Reset} $msg" }
function Write-Warning($msg) { Write-Host "${Yellow}[!]${Reset} $msg" }
function Write-Error($msg) { Write-Host "${Red}[✗]${Reset} $msg" }
function Write-Info($msg) { Write-Host "${Cyan}[i]${Reset} $msg" }

# ============================================
# 1. BUILD
# ============================================

if (-not $SkipBuild) {
    Write-Info "Building project..."
    
    # Check if package.json exists
    if (-not (Test-Path "package.json")) {
        Write-Error "package.json not found. Run this script from the project root."
        exit 1
    }
    
    # Run build
    Write-Info "Running npm run build..."
    $env:NODE_ENV = "production"
    npm run build
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Build failed!"
        exit 1
    }
    
    Write-Status "Build completed successfully"
}

# ============================================
# 2. FILES TO UPLOAD
# ============================================

$filesToUpload = @(
    # Core files
    "server.js",
    "package.json",
    "package-lock.json",
    
    # Lib files
    "lib\auth.js",
    "lib\db.js",
    "lib\logger.js",
    "lib\middleware.js",
    "lib\notifications.js",
    "lib\push.js",
    "lib\rateLimit.js",
    "lib\session.js",
    "lib\validation.js",
    
    # API routes - Auth
    "pages\api\auth\login.js",
    "pages\api\auth\register.js",
    "pages\api\auth\me.js",
    "pages\api\auth\logout.js",
    
    # API routes - Tasks
    "pages\api\tasks\index.js",
    "pages\api\tasks\[id]\index.js",
    
    # API routes - Chat
    "pages\api\chat\index.js",
    
    # API routes - Remote
    "pages\api\remote\devices.js",
    "pages\api\remote\sessions.js",
    
    # API routes - System
    "pages\api\system\database.js",
    "pages\api\system\status.js",
    
    # Components - Remote
    "components\remote\DeviceList.js",
    "components\remote\Viewer.js",
    "components\remote\Controls.js",
    
    # Pages
    "pages\dashboard\remote.js",
    
    # .env.local (if changed)
    # ".env.local"  # Uncomment if you want to deploy env changes
)

# ============================================
# 3. UPLOAD FILES
# ============================================

if (-not $SkipUpload) {
    Write-Info "Uploading files to $Server..."
    
    $plinkPath = "C:\Program Files\PuTTY\plink.exe"
    $pscpPath = "C:\Program Files\PuTTY\pscp.exe"
    
    # Check if plink exists
    if (-not (Test-Path $plinkPath)) {
        Write-Error "plink.exe not found at $plinkPath"
        Write-Info "Please install PuTTY or update the path in this script."
        exit 1
    }
    
    $uploaded = 0
    $failed = 0
    
    foreach ($file in $filesToUpload) {
        if (Test-Path $file) {
            $remoteDir = "$RemotePath\$($file -replace '\\', '/')".Replace("\", "/")
            $remoteDir = $remoteDir.Substring(0, $remoteDir.LastIndexOf("/"))
            
            # Create remote directory if needed
            $createDirCmd = "mkdir -p $remoteDir"
            & $plinkPath -batch -pw $Password "$User@$Server" $createDirCmd 2>$null
            
            # Upload file
            $result = & $pscpPath -batch -pw $Password $file "$User@$Server`:$RemotePath/$($file -replace '\\', '/')" 2>&1
            
            if ($LASTEXITCODE -eq 0) {
                Write-Status "Uploaded: $file"
                $uploaded++
            } else {
                Write-Warning "Failed: $file"
                $failed++
            }
        } else {
            Write-Warning "File not found: $file"
            $failed++
        }
    }
    
    Write-Info "Upload complete: $uploaded uploaded, $failed failed"
}

# ============================================
# 4. INSTALL DEPENDENCIES & BUILD ON SERVER
# ============================================

if (-not $SkipUpload) {
    Write-Info "Installing dependencies and building on server..."
    
    $buildCmd = @"
cd $RemotePath && 
npm install --legacy-peer-deps 2>&1 | tail -5 &&
NODE_ENV=production npm run build 2>&1 | tail -10
"@
    
    & $plinkPath -batch -pw $Password "$User@$Server" $buildCmd
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Remote build failed!"
        exit 1
    }
    
    Write-Status "Remote build completed"
}

# ============================================
# 5. RESTART PM2
# ============================================

if (-not $SkipRestart) {
    Write-Info "Restarting PM2..."
    
    $restartCmd = "pm2 restart devtrack && sleep 2 && pm2 status devtrack"
    & $plinkPath -batch -pw $Password "$User@$Server" $restartCmd
    
    Write-Status "PM2 restarted"
}

# ============================================
# 6. VERIFY
# ============================================

Write-Info "Verifying deployment..."

$verifyCmd = "curl -sk https://127.0.0.1:3000/api/hello 2>&1"
$result = & $plinkPath -batch -pw $Password "$User@$Server" $verifyCmd 2>&1

if ($result -match "John Doe") {
    Write-Status "Deployment verified successfully!"
    Write-Info "App is running at: https://$Server`:3000"
} else {
    Write-Warning "Could not verify deployment. Check manually."
}

Write-Host ""
Write-Status "Deploy completed!"
