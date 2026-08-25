@echo off
echo ========================================
echo  DevTrack Agent - Service Installer
echo ========================================
echo.

:: Check for admin rights
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] This script requires Administrator privileges!
    echo Right-click and select "Run as administrator"
    echo.
    pause
    exit /b 1
)

echo [1/3] Stopping existing agent if running...
taskkill /f /im DevTrackAgent.exe >nul 2>&1

echo [2/3] Installing DevTrackAgent as Windows Service...
sc create DevTrackAgent binPath= "%~dp0DevTrackAgent.exe --service" start= auto DisplayName= "DevTrack Remote Agent"
if %errorLevel% neq 0 (
    echo [ERROR] Failed to install service!
    pause
    exit /b 1
)

echo [3/3] Starting service...
sc start DevTrackAgent
if %errorLevel% neq 0 (
    echo [WARNING] Service installed but could not start automatically.
    echo You can start it manually from Services console or run: sc start DevTrackAgent
)

echo.
echo ========================================
echo  Installation Complete!
echo ========================================
echo.
echo  Device ID: (will be shown on first run)
echo  Service:   DevTrackAgent
echo  Status:    Auto-start on boot
echo.
echo  To check status: sc query DevTrackAgent
echo  To stop:         sc stop DevTrackAgent
echo  To uninstall:    uninstall-service.bat (Run as Admin)
echo.
pause
