@echo off
title DevTrack Remote Agent
cd /d "%~dp0"
echo ========================================
echo   DevTrack Remote Desktop Agent
echo ========================================
where node >nul 2>nul || (
    echo [ERROR] Node.js not found!
    echo Download from: https://nodejs.org
    pause
    exit /b 1
)
if not exist node_modules (
    echo [INFO] Installing dependencies...
    call npm install
)
echo [INFO] Starting agent...
node agent.js --server http://localhost:3000
pause
