@echo off
title VizrtControlHub
cd /d "%~dp0"

echo Starting VizrtControlHub...
echo.

call "%~dp0scripts\find-node.bat"
if errorlevel 1 goto :need_setup

rem Dependencies missing (fresh clone)? Run setup first.
if not exist "%~dp0backend\node_modules\.bin\nodemon.cmd" goto :run_setup
if not exist "%~dp0frontend\node_modules\.bin\vite.cmd" goto :run_setup
if not exist "%~dp0mcp-server\node_modules" goto :run_setup
goto :launch

:run_setup
echo Dependencies belum terpasang, menjalankan setup.bat...
call "%~dp0setup.bat" nopause
if errorlevel 1 goto :need_setup

:launch
rem Child windows inherit this window's PATH (incl. Node.js found above).
start "VizrtControlHub - Backend" cmd /k "cd /d "%~dp0backend" && npm run dev"
timeout /t 2 /nobreak >nul
start "VizrtControlHub - Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo Backend  : http://127.0.0.1:3000
echo Frontend : http://127.0.0.1:5173
echo.
echo Both servers are running. Close their windows (or run stop.bat) to stop.
exit /b 0

:need_setup
echo.
echo Tidak bisa start. Jalankan setup.bat dan perbaiki error-nya dulu.
pause
exit /b 1
