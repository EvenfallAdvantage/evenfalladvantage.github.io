@echo off
title SDR Companion - Overwatch
echo Starting SDR Companion service...
start /min "" "%~dp0dist\sdr-companion.exe"
timeout /t 2 /nobreak >nul
echo Opening Overwatch...
start "" "https://evenfalladvantage.github.io/overwatch"
echo.
echo SDR Companion is running in the background.
echo Close this window or press Ctrl+C to stop.
echo.
pause
