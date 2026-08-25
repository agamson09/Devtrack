@echo off
title DevTrack Agent - Setup
cd /d "%~dp0"
echo ==========================================
echo   DevTrack Agent v3.0 - Setup
echo ==========================================
echo.

echo [1/3] Checking Node.js...
set "NODE_EXE="
where node >nul 2>&1
if %errorlevel%==0 (
    set "NODE_EXE=node"
    goto :found_node
)
if exist "C:\Program Files\nodejs\node.exe" (
    set "NODE_EXE=C:\Program Files\nodejs\node.exe"
    goto :found_node
)
if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" (
    set "NODE_EXE=%LOCALAPPDATA%\Programs\nodejs\node.exe"
    goto :found_node
)
echo   [!] Node.js not found.
echo   Download from: https://nodejs.org/
pause
exit /b 1

:found_node
"%NODE_EXE%" --version >nul 2>&1
if %errorlevel% neq 0 (
    echo   [!] Node.js not working.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('"%NODE_EXE%" --version') do echo   OK: Node.js %%i
echo.

echo [2/3] Installing dependencies...
if not exist "node_modules" (
    call npm install --production
    if %errorlevel% neq 0 (
        echo.
        echo   [!] npm install failed.
        pause
        exit /b 1
    )
    echo   Done.
) else (
    echo   Already installed.
)
echo.

echo [3/3] Display check...
set "DISPLAY_COUNT=0"
for /f "tokens=*" %%i in ('powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; Write-Output ([System.Windows.Forms.Screen]::AllScreens.Length)" 2^>nul') do set "DISPLAY_COUNT=%%i"

if "%DISPLAY_COUNT%"=="0" (
    echo   [!] No display - headless server.
    echo.
    echo   Run install-vdd.bat as Administrator to install VDD.
) else (
    echo   OK: Display found.
)
echo.

echo ==========================================
echo   Setup complete!
echo   Run start.bat to start agent.
echo ==========================================
echo.
pause
