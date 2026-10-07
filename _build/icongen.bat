@echo off
set LOG=%~dp0icongen.log
cd /d "%~dp0.."
echo Generating icons > "%LOG%"
call npx tauri icon "_build\icongen\icon-source.png" >> "%LOG%" 2>&1
echo exit=%ERRORLEVEL% >> "%LOG%"
