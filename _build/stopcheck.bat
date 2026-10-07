@echo off
set LOG=%~dp0stopcheck.log
tasklist /FI "IMAGENAME eq tanjiro-flow.exe" > "%LOG%"
tasklist /FI "IMAGENAME eq node.exe" >> "%LOG%"
tasklist /FI "IMAGENAME eq cargo.exe" >> "%LOG%"
