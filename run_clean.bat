@echo off
echo Cleaning up Node processes (Port Cleanup)...
taskkill /F /IM node.exe >nul 2>&1
echo Done.

echo Starting Immersive Reader...
cd c:\Users\user\Desktop\논문리뷰어\immersive-reader-tauri
npm run dev
