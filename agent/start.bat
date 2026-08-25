@echo off
title DevTrack Agent v3.0
cd /d "%~dp0"
echo ==========================================
echo   DevTrack Remote Desktop Agent v3.0
echo ==========================================
echo.

if not exist "node_modules" (
    echo [!] Dependencies not installed. Running install...
    call npm install
    echo.
)

echo Starting agent...
node agent.js %*
echo.
echo Agent exited. Press any key to restart...
pause >nul
goto :eof
