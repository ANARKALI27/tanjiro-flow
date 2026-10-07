@echo off
setlocal
set LOG=%~dp0check.log
echo Tanjiro Flow check > "%LOG%"
echo started %DATE% %TIME% >> "%LOG%"
echo ===== tsc ===== >> "%LOG%"
cd /d "%~dp0.."
call npm run typecheck >> "%LOG%" 2>&1
echo tsc exit=%ERRORLEVEL% >> "%LOG%"
echo ===== cargo check ===== >> "%LOG%"
cd /d "%~dp0..\src-tauri"
cargo check --message-format short >> "%LOG%" 2>&1
echo cargo exit=%ERRORLEVEL% >> "%LOG%"
echo CHECK-DONE %DATE% %TIME% >> "%LOG%"
endlocal
