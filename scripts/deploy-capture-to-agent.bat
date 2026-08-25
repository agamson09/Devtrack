@echo off
echo ============================================
echo  Deploy capture.js to DevTrack Agent
echo ============================================
echo.

set SERVER=%DEPLOY_HOST%
set TARGET=%TARGET_IP%
set USER=%DEPLOY_USER%
set PASS=%DEPLOY_PASS%

echo [1/3] Downloading capture.js from server...
"C:\Program Files\PuTTY\pscp" -pw %PASS% -batch %USER%@%SERVER%:/var/www/devtrack/agent/capture.js C:\temp\capture.js
if %errorlevel% neq 0 (
    echo ERROR: Failed to download from server
    pause
    exit /b 1
)

echo [2/3] Copying to target PC...
echo.
echo ============================================
echo  MANUAL STEP REQUIRED:
echo ============================================
echo.
echo  Copy C:\temp\capture.js to the agent folder:
echo.
echo  Option A: If agent is in C:\Agent\
echo    copy C:\temp\capture.js C:\Agent\capture.js
echo.
echo  Option B: If agent is in app folder
echo    copy C:\temp\capture.js "C:\Users\ADMINI~1\AppData\Local\...\agent\capture.js"
echo.
echo  Option C: Use file share or USB
echo.
echo ============================================
echo.

echo [3/3] Done! Restart the DevTrack Agent on target PC.
echo.
pause
