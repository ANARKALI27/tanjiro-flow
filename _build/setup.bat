@echo off
setlocal
set LOG=%~dp0build.log
cd /d "%~dp0.."
echo Tanjiro Flow bootstrap > "%LOG%"
echo started %DATE% %TIME% >> "%LOG%"
echo. >> "%LOG%"
echo ===== npm install ===== >> "%LOG%"
call npm install --no-audit --no-fund >> "%LOG%" 2>&1
echo npm exit=%ERRORLEVEL% >> "%LOG%"
echo. >> "%LOG%"
echo ===== cargo check ===== >> "%LOG%"
cd /d "%~dp0..\src-tauri"
cargo check --message-format short >> "%LOG%" 2>&1
echo cargo exit=%ERRORLEVEL% >> "%LOG%"
echo. >> "%LOG%"
echo BOOTSTRAP-DONE %DATE% %TIME% >> "%LOG%"
endlocal
