@echo off
setlocal
set LOG=%~dp0check2.log
echo Tanjiro Flow check2 > "%LOG%"
cd /d "%~dp0.."
echo ===== npm install (new deps) ===== >> "%LOG%"
call npm install --no-audit --no-fund >> "%LOG%" 2>&1
echo npm exit=%ERRORLEVEL% >> "%LOG%"
echo ===== tsc ===== >> "%LOG%"
call npm run typecheck >> "%LOG%" 2>&1
echo tsc exit=%ERRORLEVEL% >> "%LOG%"
echo ===== cargo check ===== >> "%LOG%"
cd /d "%~dp0..\src-tauri"
cargo check --message-format short >> "%LOG%" 2>&1
echo cargo exit=%ERRORLEVEL% >> "%LOG%"
echo CHECK2-DONE %DATE% %TIME% >> "%LOG%"
endlocal
