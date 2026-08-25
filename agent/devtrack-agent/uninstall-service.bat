@echo off
echo ========================================
echo  DevTrack Agent - Service Uninstaller
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

echo [1/3] Stopping DevTrackAgent service...
sc stop DevTrackAgent >nul 2>&1
timeout /t 3 >nul

echo [2/3] Removing service...
sc delete DevTrackAgent
if %errorLevel% neq 0 (
    echo [WARNING] Could not remove service. It may not exist.
)

echo [3/3] Cleaning up...
taskkill /f /im DevTrackAgent.exe >nul 2>&1

echo.
echo ========================================
echo  Uninstall Complete!
echo ========================================
echo.
echo  The DevTrack Agent service has been removed.
echo  Agent config (agent-config.json) is preserved.
echo.
pause
