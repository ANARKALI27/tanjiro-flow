@echo off
echo Stopping Tanjiro Flow dev processes... > stop.log
taskkill /F /IM tanjiro-flow.exe >> stop.log 2>&1
taskkill /F /IM cargo.exe >> stop.log 2>&1
taskkill /F /IM node.exe >> stop.log 2>&1
echo Done >> stop.log
