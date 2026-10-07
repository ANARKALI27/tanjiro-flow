@echo off
setlocal
set LOG=%~dp0doctor.log
echo Tanjiro Flow toolchain report > "%LOG%"
echo generated %DATE% %TIME% >> "%LOG%"
echo. >> "%LOG%"

echo [node] >> "%LOG%"
where node >> "%LOG%" 2>&1
node -v >> "%LOG%" 2>&1
echo. >> "%LOG%"

echo [npm] >> "%LOG%"
where npm >> "%LOG%" 2>&1
call npm -v >> "%LOG%" 2>&1
echo. >> "%LOG%"

echo [rustc] >> "%LOG%"
where rustc >> "%LOG%" 2>&1
rustc -V >> "%LOG%" 2>&1
echo. >> "%LOG%"

echo [cargo] >> "%LOG%"
where cargo >> "%LOG%" 2>&1
cargo -V >> "%LOG%" 2>&1
echo. >> "%LOG%"

echo [rustup default target] >> "%LOG%"
rustup show active-toolchain >> "%LOG%" 2>&1
echo. >> "%LOG%"

echo [MSVC link.exe] >> "%LOG%"
where link >> "%LOG%" 2>&1
echo. >> "%LOG%"

echo [Visual Studio installs] >> "%LOG%"
if exist "%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe" (
  "%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe" -products * -property displayName >> "%LOG%" 2>&1
  "%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe" -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath >> "%LOG%" 2>&1
) else (
  echo vswhere.exe NOT FOUND - Visual Studio Build Tools likely missing >> "%LOG%"
)
echo. >> "%LOG%"

echo [WebView2 runtime] >> "%LOG%"
reg query "HKLM\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" /v pv >> "%LOG%" 2>&1
echo. >> "%LOG%"

echo [git] >> "%LOG%"
where git >> "%LOG%" 2>&1
git --version >> "%LOG%" 2>&1
echo. >> "%LOG%"

echo [7-Zip] >> "%LOG%"
where 7z >> "%LOG%" 2>&1
if exist "%ProgramFiles%\7-Zip\7z.exe" echo found "%ProgramFiles%\7-Zip\7z.exe" >> "%LOG%"
echo. >> "%LOG%"

echo [drives] >> "%LOG%"
wmic logicaldisk get caption,volumename,size,freespace,drivetype >> "%LOG%" 2>&1
echo. >> "%LOG%"

echo [cpu/mem] >> "%LOG%"
wmic cpu get name >> "%LOG%" 2>&1
wmic os get TotalVisibleMemorySize,Caption,Version >> "%LOG%" 2>&1
echo. >> "%LOG%"

echo DONE >> "%LOG%"
endlocal
