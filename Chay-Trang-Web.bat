@echo off
title Khoi dong Landing Page NCTTX
echo --------------------------------------------------
echo   Dang kiem tra va khoi dong website cua ban...
echo --------------------------------------------------
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File .\open-chrome.ps1
echo --------------------------------------------------
echo   Hoan thanh! Da mo tren Google Chrome.
echo --------------------------------------------------
pause
