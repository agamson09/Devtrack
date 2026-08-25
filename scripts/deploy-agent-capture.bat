@echo off
echo ============================================
echo  Deploy DevTrack Agent Capture Update
echo ============================================
echo.

set SERVER=%DEPLOY_HOST%
set PASS=%DEPLOY_PASS%
set TEMP_DIR=C:\temp\devtrack-update

echo [1/4] Creating temp folder...
if not exist "%TEMP_DIR%" mkdir "%TEMP_DIR%"

echo [2/4] Downloading files from server...
"C:\Program Files\PuTTY\pscp" -pw %PASS% -batch root@%SERVER%:/var/www/devtrack/agent/capture.js "%TEMP_DIR%\capture.js"
if %errorlevel% neq 0 (
    echo ERROR: Failed to download capture.js
    pause
    exit /b 1
)

"C:\Program Files\PuTTY\pscp" -pw %PASS% -batch root@%SERVER%:/var/www/devtrack/agent/capture-native/capture.exe "%TEMP_DIR%\capture.exe"
if %errorlevel% neq 0 (
    echo ERROR: Failed to download capture.exe
    pause
    exit /b 1
)

echo [3/4] Files downloaded to: %TEMP_DIR%
echo.
echo ============================================
echo  MANUAL COPY REQUIRED:
echo ============================================
echo.
echo  Copy these files to the agent folder on target PC:
echo.
echo    %TEMP_DIR%\capture.js
echo    %TEMP_DIR%\capture.exe
echo.
echo  Agent folder location (check your setup):
echo    - C:\Agent\
echo    - C:\Users\...\AppData\...\agent\
echo.
echo  Or copy capture-native folder structure:
echo    %TEMP_DIR%\capture.exe -> [agent]\capture-native\capture.exe
echo.
echo ============================================
echo.

echo [4/4] Done! Restart the DevTrack Agent on target PC.
echo.
pause
