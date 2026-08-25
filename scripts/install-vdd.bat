@echo off
:: ============================================
:: VDD Quick Install for Headless RDP
:: Run as Administrator on target PC
:: ============================================

echo.
echo  Virtual Display Driver Installer
echo  For Headless Remote Desktop
echo ============================================
echo.

:: Check admin
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] Run this as Administrator!
    echo Right-click and select "Run as administrator"
    pause
    exit /b 1
)

:: Check if VDD already installed
echo [1/5] Checking existing installation...
pnputil /enum-drivers 2>nul | findstr /i "IddSampleDriver" >nul
if %errorLevel% equ 0 (
    echo [!] VDD already installed
    goto :configure
)

:: Download VDD
echo [2/5] Downloading Virtual Display Driver...
set "VDD_URL=https://github.com/roshkins/IddSampleDriver/releases/download/v1.2.1/IddSampleDriver.zip"
set "VDD_ZIP=%TEMP%\IddSampleDriver.zip"
set "VDD_DIR=%TEMP%\IddSampleDriver"

if exist "%VDD_ZIP%" del "%VDD_ZIP%"
if exist "%VDD_DIR%" rmdir /s /q "%VDD_DIR%"

powershell -Command "try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%VDD_URL%' -OutFile '%VDD_ZIP%' -UseBasicParsing; Write-Host 'Downloaded OK' } catch { Write-Host 'Download failed: ' + $_.Exception.Message; exit 1 }"
if %errorLevel% neq 0 (
    echo [ERROR] Download failed!
    echo Please download manually from: %VDD_URL%
    pause
    exit /b 1
)

:: Extract
echo [3/5] Extracting files...
powershell -Command "Expand-Archive -Path '%VDD_ZIP%' -DestinationPath '%VDD_DIR%' -Force"

:: Find INF file
for /r "%VDD_DIR%" %%f in (*.inf) do (
    set "INF_PATH=%%f"
    goto :install
)

echo [ERROR] No .inf file found!
pause
exit /b 1

:install
:: Install driver
echo [4/5] Installing driver...
pnputil /add-driver "%INF_PATH%" /install
if %errorLevel% neq 0 (
    echo [WARNING] PnPUtil failed, trying alternative method...
    rundll32.exe setupapi.dll,InstallHinfSection DefaultInstall 132 "%INF_PATH%"
)

:configure
:: Configure resolution
echo [5/5] Configuring display...

echo.
echo ============================================
echo  Installation Complete!
echo ============================================
echo.
echo  Virtual display should now be active.
echo.
echo  Next steps:
echo  1. Restart computer (recommended)
echo  2. Or restart DevTrack Agent
echo  3. Remote desktop should work
echo.

:: Show current displays
echo Current displays:
powershell -Command "Get-CimInstance Win32_VideoController | ForEach-Object { Write-Host ('  - ' + $_.Name + ' (' + $_.CurrentHorizontalResolution + 'x' + $_.CurrentVerticalResolution + ')') }"

echo.
pause
