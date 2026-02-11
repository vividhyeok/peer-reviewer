@echo off
echo Setting up environment...
set PATH=%USERPROFILE%\.cargo\bin;%PATH%

echo Building Peer Reviewer executable (EXE)...
echo This process may take a few minutes.
call npm run tauri build
if %ERRORLEVEL% EQU 0 (
    echo.
    echo Build Successful!
    echo The installer is located at: src-tauri\target\release\bundle\nsis\
    explorer "src-tauri\target\release\bundle\nsis"
) else (
    echo.
    echo Build Failed. Please check the error messages above.
)
pause