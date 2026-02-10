@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo Cleaning up existing Node processes (Port 5173/5174/etc)...
taskkill /F /IM node.exe >nul 2>&1
echo Done.

echo Starting Paper Reviewer in Browser Mode...
echo This will run 'vite' and open your default browser.
echo Press Ctrl+C to stop.

npm run dev:browser
if %ERRORLEVEL% NEQ 0 (
    echo Error occurred.
    pause
)
