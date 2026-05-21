@echo off
cd /d "%~dp0"
set PORT=5001
powershell.exe -NoExit -ExecutionPolicy Bypass -File "C:\tmp\mahjooz-static-server.ps1"
