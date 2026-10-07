@echo off
setlocal
set LOG=%~dp0build-release.log
cd /d "%~dp0.."
echo Tanjiro Flow RELEASE build > "%LOG%"
echo started %DATE% %TIME% >> "%LOG%"
call npm run tauri:build >> "%LOG%" 2>&1
echo tauri build exit=%ERRORLEVEL% >> "%LOG%"
echo BUILD-EXITED %DATE% %TIME% >> "%LOG%"
endlocal
