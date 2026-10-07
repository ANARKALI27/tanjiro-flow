@echo off
setlocal
set LOG=%~dp0tsc.log
echo Tanjiro Flow tsc > "%LOG%"
cd /d "%~dp0.."
call npm run typecheck >> "%LOG%" 2>&1
echo tsc exit=%ERRORLEVEL% >> "%LOG%"
echo TSC-DONE %DATE% %TIME% >> "%LOG%"
endlocal
