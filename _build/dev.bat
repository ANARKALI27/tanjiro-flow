@echo off
setlocal
set LOG=%~dp0dev.log
cd /d "%~dp0.."
echo Tanjiro Flow tauri dev > "%LOG%"
echo started %DATE% %TIME% >> "%LOG%"
call npm run tauri:dev >> "%LOG%" 2>&1
echo tauri exit=%ERRORLEVEL% >> "%LOG%"
echo DEV-EXITED %DATE% %TIME% >> "%LOG%"
endlocal
