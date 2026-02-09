@echo off
echo Cleaning up existing Node processes (Port 5173/5174/etc)...
taskkill /F /IM node.exe >nul 2>&1
echo Done.

echo Starting Immersive Reader in Browser Mode...
echo This will run 'vite' and open your default browser.
echo Press Ctrl+C to stop.

npm run dev -- --open
