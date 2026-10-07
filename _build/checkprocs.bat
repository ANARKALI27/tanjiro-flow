@echo off
tasklist /FI "IMAGENAME eq node.exe" > procs.log
tasklist /FI "IMAGENAME eq ana-flow.exe" >> procs.log
tasklist /FI "IMAGENAME eq cargo.exe" >> procs.log
tasklist /FI "IMAGENAME eq rustc.exe" >> procs.log
tasklist /FI "IMAGENAME eq explorer.exe" >> procs.log
