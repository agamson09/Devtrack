#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Install Virtual Display Driver (VDD) for headless remote desktop
.DESCRIPTION
    Installs a virtual display driver so Windows can capture screen output
    even when no physical monitor is connected. This fixes black screen
    issues in remote desktop agents.
.PARAMETER Width
    Virtual display width (default: 1920)
.PARAMETER Height
    Virtual display height (default: 1080)
.PARAMETER Frequency
    Refresh rate in Hz (default: 60)
.PARAMETER Uninstall
    Remove the virtual display driver
.EXAMPLE
    .\install-vdd.ps1
    .\install-vdd.ps1 -Width 2560 -Height 1440
    .\install-vdd.ps1 -Uninstall
#>

param(
    [int]$Width = 1920,
    [int]$Height = 1080,
    [int]$Frequency = 60,
    [switch]$Uninstall
)

$ErrorActionPreference = "Stop"

# ============================================================
# Configuration
# ============================================================
$VDD_URL = "https://github.com/roshkins/IddSampleDriver/releases/download/v1.2.1/IddSampleDriver.zip"
$VDD_ZIP = "$env:TEMP\VddSampleDriver.zip"
$VDD_EXTRACT = "$env:TEMP\VddSampleDriver"
$VDD_INF = "IddSampleDriver.inf"
$DRIVER_NAME = "IddSampleDriver"

# Alternative VDD sources if primary fails
$ALTERNATIVE_URLS = @(
    "https://github.com/roshkins/IddSampleDriver/releases/download/v1.2.1/IddSampleDriver.zip",
    "https://github.com/ge9/IddSampleDriver/releases/download/v1.2.1/IddSampleDriver.zip"
)

# ============================================================
# Functions
# ============================================================

function Write-Step {
    param([string]$Message)
    Write-Host "`n[*] $Message" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "[✓] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[!] $Message" -ForegroundColor Yellow
}

function Write-Fail {
    param([string]$Message)
    Write-Host "[✗] $Message" -ForegroundColor Red
}

function Test-Administrator {
    $currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    return $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Download-VDD {
    Write-Step "Downloading Virtual Display Driver..."
    
    foreach ($url in $ALTERNATIVE_URLS) {
        try {
            Write-Host "  Trying: $url"
            $ProgressPreference = 'SilentlyContinue'
            Invoke-WebRequest -Uri $url -OutFile $VDD_ZIP -UseBasicParsing -TimeoutSec 60
            Write-Success "Downloaded successfully"
            return $true
        } catch {
            Write-Warning "Failed: $($_.Exception.Message)"
            continue
        }
    }
    
    Write-Fail "Failed to download VDD from all sources"
    return $false
}

function Extract-VDD {
    Write-Step "Extracting VDD files..."
    
    if (Test-Path $VDD_EXTRACT) {
        Remove-Item -Recurse -Force $VDD_EXTRACT
    }
    
    Expand-Archive -Path $VDD_ZIP -DestinationPath $VDD_EXTRACT -Force
    
    $infFile = Get-ChildItem -Path $VDD_EXTRACT -Filter "*.inf" -Recurse | Select-Object -First 1
    if ($infFile) {
        Write-Success "Extracted to: $($infFile.DirectoryName)"
        return $infFile.DirectoryName
    }
    
    Write-Fail "No .inf file found in extracted files"
    return $null
}

function Install-Driver {
    param([string]$DriverPath)
    
    Write-Step "Installing Virtual Display Driver..."
    
    $infFile = Join-Path $DriverPath $VDD_INF
    if (-not (Test-Path $infFile)) {
        # Try to find any .inf file
        $infFile = Get-ChildItem -Path $DriverPath -Filter "*.inf" | Select-Object -First 1
        if ($infFile) {
            $infFile = $infFile.FullName
        } else {
            Write-Fail "No .inf file found"
            return $false
        }
    }
    
    Write-Host "  Using INF: $infFile"
    
    # Method 1: PnPUtil (recommended)
    try {
        Write-Host "  Installing via PnPUtil..."
        $result = & pnputil /add-driver $infFile /install 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Driver installed via PnPUtil"
            return $true
        }
        Write-Warning "PnPUtil returned: $result"
    } catch {
        Write-Warning "PnPUtil failed: $($_.Exception.Message)"
    }
    
    # Method 2: DevCon (if available)
    $devcon = Get-Command "devcon" -ErrorAction SilentlyContinue
    if ($devcon) {
        try {
            Write-Host "  Installing via DevCon..."
            & devcon install $infFile "*IddSampleDriver*" 2>&1
            Write-Success "Driver installed via DevCon"
            return $true
        } catch {
            Write-Warning "DevCon failed: $($_.Exception.Message)"
        }
    }
    
    # Method 3: RUNDLL32 setupapi
    try {
        Write-Host "  Installing via SetupAPI..."
        & rundll32.exe setupapi.dll,InstallHinfSection DefaultInstall 132 $infFile
        Write-Success "Driver installed via SetupAPI"
        return $true
    } catch {
        Write-Warning "SetupAPI failed: $($_.Exception.Message)"
    }
    
    Write-Fail "All installation methods failed"
    return $false
}

function Set-DisplayResolution {
    param([int]$Width, [int]$Height, [int]$Frequency)
    
    Write-Step "Configuring display resolution to ${Width}x${Height}@${Frequency}Hz..."
    
    # Check if display is detected
    $displays = Get-CimInstance -ClassName Win32_VideoController
    $virtualDisplay = $displays | Where-Object { $_.Name -like "*IddSample*" -or $_.Name -like "*Virtual*" }
    
    if ($virtualDisplay) {
        Write-Host "  Found virtual display: $($virtualDisplay.Name)"
        
        # Use QRes or native methods to set resolution
        try {
            # Try using WMI to set resolution
            $videoController = Get-CimInstance -ClassName Win32_VideoController | Where-Object { $_.Name -like "*IddSample*" }
            if ($videoController) {
                Write-Success "Virtual display is active"
                Write-Host "  Current mode: $($videoController.CurrentHorizontalResolution)x$($videoController.CurrentVerticalResolution)"
            }
        } catch {
            Write-Warning "Could not query display settings: $($_.Exception.Message)"
        }
    } else {
        Write-Warning "Virtual display not detected yet. Driver may need restart."
    }
}

function Remove-VDD {
    Write-Step "Removing Virtual Display Driver..."
    
    try {
        # Find and remove the driver
        $drivers = & pnputil /enum-drivers 2>&1 | Select-String -Pattern "IddSampleDriver" -Context 0,5
        
        if ($drivers) {
            foreach ($match in $drivers) {
                $oemName = ($match.Line -split ":")[-1].Trim()
                if ($oemName -match "oem\d+\.inf") {
                    & pnputil /delete-driver $oemName /force 2>&1
                    Write-Success "Removed driver: $oemName"
                }
            }
        } else {
            Write-Warning "VDD driver not found in driver store"
        }
        
        # Remove any virtual displays from registry
        $displayPath = "HKLM:\SYSTEM\CurrentControlSet\Enum\ROOT\DISPLAY"
        if (Test-Path $displayPath) {
            Get-ChildItem $displayPath | ForEach-Object {
                $deviceDesc = Get-ItemProperty -Path $_.PSPath -Name "DeviceDesc" -ErrorAction SilentlyContinue
                if ($deviceDesc.DeviceDesc -like "*IddSample*") {
                    Remove-Item -Path $_.PSPath -Recurse -Force
                    Write-Success "Removed virtual display registry entry"
                }
            }
        }
        
        Write-Success "Virtual Display Driver removed"
        return $true
    } catch {
        Write-Fail "Failed to remove driver: $($_.Exception.Message)"
        return $false
    }
}

function Show-Status {
    Write-Step "Checking Virtual Display status..."
    
    $displays = Get-CimInstance -ClassName Win32_VideoController
    $virtualDisplay = $displays | Where-Object { $_.Name -like "*IddSample*" -or $_.Name -like "*Virtual*" }
    
    if ($virtualDisplay) {
        Write-Success "Virtual Display is ACTIVE"
        Write-Host "  Name: $($virtualDisplay.Name)"
        Write-Host "  Resolution: $($virtualDisplay.CurrentHorizontalResolution)x$($virtualDisplay.CurrentVerticalResolution)"
        Write-Host "  Status: $($virtualDisplay.Status)"
    } else {
        Write-Warning "Virtual Display is NOT active"
        Write-Host "  Installed displays:"
        $displays | ForEach-Object {
            Write-Host "    - $($_.Name)"
        }
    }
}

# ============================================================
# Main Execution
# ============================================================

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Virtual Display Driver Installer" -ForegroundColor Cyan
Write-Host "  For Headless Remote Desktop" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

# Check administrator privileges
if (-not (Test-Administrator)) {
    Write-Fail "This script must be run as Administrator!"
    Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    exit 1
}

# Handle uninstall
if ($Uninstall) {
    Remove-VDD
    Show-Status
    exit 0
}

# Check if already installed
Write-Step "Checking existing installation..."
$existingDriver = & pnputil /enum-drivers 2>&1 | Select-String "IddSampleDriver"
if ($existingDriver) {
    Write-Warning "VDD driver already installed"
    Show-Status
    
    $reinstall = Read-Host "Do you want to reinstall? (y/N)"
    if ($reinstall -ne "y") {
        Write-Host "Skipping installation"
        exit 0
    }
}

# Download and install
if (-not (Download-VDD)) {
    exit 1
}

$driverPath = Extract-VDD
if (-not $driverPath) {
    exit 1
}

if (-not (Install-Driver -DriverPath $driverPath)) {
    exit 1
}

# Configure display
Set-DisplayResolution -Width $Width -Height $Height -Frequency $Frequency

# Final status
Show-Status

Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "  Installation Complete!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host @"

Next steps:
1. Restart the computer (recommended)
2. Or restart the DevTrack Agent
3. The remote desktop should now show the virtual display

To uninstall: .\install-vdd.ps1 -Uninstall

"@ -ForegroundColor Yellow
