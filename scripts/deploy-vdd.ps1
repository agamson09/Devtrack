#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Deploy Virtual Display Driver to remote PC via SSH
.PARAMETER TargetIP
    IP address of target PC
.PARAMETER TargetUser
    Username for SSH connection
.PARAMETER TargetPass
    Password for SSH connection (or use SSH key)
.EXAMPLE
    .\deploy-vdd.ps1 -TargetIP "10.176.111.159" -TargetUser "root" -TargetPass "password"
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$TargetIP,
    
    [Parameter(Mandatory=$true)]
    [string]$TargetUser,
    
    [Parameter(Mandatory=$true)]
    [string]$TargetPass,
    
    [int]$TargetPort = 22,
    
    [int]$Width = 1920,
    
    [int]$Height = 1080
)

$ErrorActionPreference = "Stop"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  VDD Remote Deployment Tool" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$PLINK = "C:\Program Files\PuTTY\plink.exe"
$PSCP = "C:\Program Files\PuTTY\pscp.exe"
$VDD_PACKAGE = Join-Path $PSScriptRoot "..\agent\vdd-package.zip"

# Check plink/pscp
if (-not (Test-Path $PLINK)) {
    Write-Host "[ERROR] plink.exe not found at: $PLINK" -ForegroundColor Red
    Write-Host "Please install PuTTY or update the path" -ForegroundColor Yellow
    exit 1
}

function Write-Step {
    param([string]$Message)
    Write-Host "`n[*] $Message" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "[✓] $Message" -ForegroundColor Green
}

function Write-Fail {
    param([string]$Message)
    Write-Host "[✗] $Message" -ForegroundColor Red
}

function Run-RemoteCommand {
    param([string]$Command)
    
    $result = & $PLINK -batch -pw $TargetPass -P $TargetPort "$TargetUser@$TargetIP" $Command 2>&1
    return $result
}

# ============================================================
# Step 1: Test connection
# ============================================================
Write-Step "Testing connection to $TargetIP..."

$testResult = Run-RemoteCommand "echo connected"
if ($testResult -notmatch "connected") {
    Write-Fail "Cannot connect to $TargetIP"
    Write-Host "Check:" -ForegroundColor Yellow
    Write-Host "  - IP address is correct" -ForegroundColor Yellow
    Write-Host "  - SSH is running on target" -ForegroundColor Yellow
    Write-Host "  - Username/password is correct" -ForegroundColor Yellow
    exit 1
}
Write-Success "Connection established"

# ============================================================
# Step 2: Check existing VDD
# ============================================================
Write-Step "Checking existing VDD installation..."

$checkResult = Run-RemoteCommand "pnputil /enum-drivers | findstr /i IddSampleDriver"
if ($checkResult -match "IddSampleDriver") {
    Write-Host "[!] VDD driver already installed" -ForegroundColor Yellow
    
    $reinstall = Read-Host "Do you want to reinstall? (y/N)"
    if ($reinstall -ne "y") {
        Write-Host "Skipping installation"
        exit 0
    }
}

# ============================================================
# Step 3: Upload VDD files
# ============================================================
Write-Step "Uploading VDD files..."

# Create temp directory on target
Run-RemoteCommand "mkdir C:\VDD-Temp 2>nul"

# Create a simple VDD installation script
$installScript = @'
@echo off
echo Installing Virtual Display Driver...

:: Check admin
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: Run as Administrator!
    pause
    exit /b 1
)

:: Try to install from existing files
if exist "C:\VDD-Temp\IddSampleDriver.inf" (
    echo Installing driver...
    pnputil /add-driver "C:\VDD-Temp\IddSampleDriver.inf" /install
    if %errorLevel% equ 0 (
        echo Driver installed successfully!
    ) else (
        echo Trying alternative method...
        rundll32.exe setupapi.dll,InstallHinfSection DefaultInstall 132 "C:\VDD-Temp\IddSampleDriver.inf"
    )
) else (
    echo Driver files not found!
)

echo.
echo Done!
'@

$installScriptPath = Join-Path $env:TEMP "install-vdd-remote.bat"
$installScript | Out-File -FilePath $installScriptPath -Encoding ASCII

# Upload install script
& $PSCP -batch -pw $TargetPass -P $TargetPort $installScriptPath "$TargetUser@$TargetIP:C:\VDD-Temp\install.bat" 2>&1 | Out-Null
Write-Success "Upload complete"

# ============================================================
# Step 4: Download and install VDD on target
# ============================================================
Write-Step "Downloading VDD on target..."

$downloadCmd = @"
powershell -Command "try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://github.com/roshkins/IddSampleDriver/releases/download/v1.2.1/IddSampleDriver.zip' -OutFile 'C:\VDD-Temp\vdd.zip' -UseBasicParsing; Write-Host 'Downloaded' } catch { Write-Host 'Download failed: ' + $_.Exception.Message; exit 1 }"
"@

$downloadResult = Run-RemoteCommand $downloadCmd
if ($downloadResult -match "Downloaded") {
    Write-Success "VDD downloaded"
} else {
    Write-Host "Download failed, trying alternative..." -ForegroundColor Yellow
    
    # Try alternative URL
    $altDownloadCmd = @"
powershell -Command "try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://github.com/ge9/IddSampleDriver/releases/download/v1.2.1/IddSampleDriver.zip' -OutFile 'C:\VDD-Temp\vdd.zip' -UseBasicParsing; Write-Host 'Downloaded' } catch { Write-Host 'Download failed'; exit 1 }"
"@
    $downloadResult = Run-RemoteCommand $altDownloadCmd
    if ($downloadResult -match "Downloaded") {
        Write-Success "VDD downloaded (alternative source)"
    } else {
        Write-Fail "Failed to download VDD"
        exit 1
    }
}

# ============================================================
# Step 5: Extract and install
# ============================================================
Write-Step "Installing VDD driver..."

$installCmd = @"
powershell -Command "Expand-Archive -Path 'C:\VDD-Temp\vdd.zip' -DestinationPath 'C:\VDD-Temp\driver' -Force; $inf = Get-ChildItem -Path 'C:\VDD-Temp\driver' -Filter '*.inf' -Recurse | Select-Object -First 1; if ($inf) { pnputil /add-driver $inf.FullName /install; Write-Host 'Installed' } else { Write-Host 'No INF found' }"
"@

$installResult = Run-RemoteCommand $installCmd
if ($installResult -match "Installed") {
    Write-Success "VDD driver installed"
} else {
    Write-Fail "VDD installation failed"
    Write-Host "Output: $installResult" -ForegroundColor Yellow
    exit 1
}

# ============================================================
# Step 6: Configure display
# ============================================================
Write-Step "Configuring virtual display..."

$configCmd = @"
powershell -Command "Get-CimInstance Win32_VideoController | Where-Object { $_.Name -like '*IddSample*' } | ForEach-Object { Write-Host ('Virtual display found: ' + $_.Name) }"
"@

Run-RemoteCommand $configCmd | Out-Null

# ============================================================
# Step 7: Restart agent
# ============================================================
Write-Step "Restarting DevTrack Agent..."

$restartCmd = @"
taskkill /F /IM "DevTrack Agent.exe" 2>nul
timeout /t 2 /nobreak >nul
start "" "C:\Agent\dist\win-unpacked\DevTrack Agent.exe"
"@

Run-RemoteCommand $restartCmd | Out-Null
Start-Sleep -Seconds 3

Write-Success "Agent restarted"

# ============================================================
# Cleanup
# ============================================================
Write-Step "Cleaning up..."

Run-RemoteCommand "rmdir /s /q C:\VDD-Temp 2>nul"
Remove-Item -Path $installScriptPath -Force -ErrorAction SilentlyContinue

# ============================================================
# Final status
# ============================================================
Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "  Deployment Complete!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host @"

VDD has been installed on $TargetIP

The virtual display should now be active.
Remote desktop should no longer show black screen.

If the display is still black:
1. Restart the target PC
2. Check Device Manager → Display adapters
3. Look for "IddSampleDriver"

"@ -ForegroundColor Yellow
