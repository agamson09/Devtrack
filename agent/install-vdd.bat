@echo off
title DevTrack Agent - VDD Setup (Admin)
cd /d "%~dp0"
echo ==========================================
echo   Virtual Display Driver Setup
echo ==========================================
echo.

:: Check admin
net session >nul 2>&1
if errorlevel 1 (
    echo [!] This script needs Administrator rights.
    echo     Right-click install-vdd.bat - Run as Administrator
    echo.
    pause
    exit /b 1
)

echo [1/3] Setting up VDD directory...
if not exist "C:\DevTrackVDD" mkdir "C:\DevTrackVDD"

:: Extract VDD
if exist "VDD.Control.25.7.23.zip" (
    echo   Extracting VDD.Control...
    powershell -NoProfile -Command "Expand-Archive -Path '%~dp0VDD.Control.25.7.23.zip' -DestinationPath 'C:\DevTrackVDD' -Force" 2>&1
    echo   Extracted to C:\DevTrackVDD
) else (
    echo   [!] VDD.Control.25.7.23.zip not found in this folder.
    echo   Download from: https://github.com/VirtualDrivers/Virtual-Display-Driver/releases
    echo.
    pause
    exit /b 1
)
echo.

echo [2/3] Installing VDD...
if exist "C:\DevTrackVDD\VDD Control.exe" (
    echo   Starting VDD Control...
    echo   A window will open. Click "Install" or "Add Display".
    echo.
    start "" "C:\DevTrackVDD\VDD Control.exe"
    echo   Waiting 20 seconds for VDD to initialize...
    timeout /t 20 /nobreak >nul
) else (
    echo   [!] VDD Control.exe not found.
    echo   Check: C:\DevTrackVDD\
)
echo.

echo [3/3] Checking result...
set "DISPLAY_COUNT=0"
for /f "tokens=*" %%i in ('powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; Write-Output ([System.Windows.Forms.Screen]::AllScreens.Length)"') do set "DISPLAY_COUNT=%%i"

if "%DISPLAY_COUNT%"=="0" (
    echo   [!] Display still not detected.
    echo.
    echo   Try:
    echo   1. Open C:\DevTrackVDD\VDD Control.exe manually
    echo   2. Click "Install" then "Add Display"
    echo   3. Restart this computer if needed
) else (
    echo   [OK] Display detected: %DISPLAY_COUNT% monitor(s)
)
echo.

echo ==========================================
echo   Done! Now run start.bat to start agent.
echo ==========================================
echo.
pause
