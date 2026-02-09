@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo Cleaning up Node processes (Port Cleanup)...
taskkill /F /IM node.exe >nul 2>&1
echo Done.

echo Starting Immersive Reader...
npm run dev
if %ERRORLEVEL% NEQ 0 (
    echo Error occurred.
    pause
)
