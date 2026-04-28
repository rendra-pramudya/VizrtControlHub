@echo off
title VizrtControlHub

echo Starting VizrtControlHub...
echo.

start "VizrtControlHub - Backend" cmd /k "cd /d %~dp0backend && npm run dev"
timeout /t 2 /nobreak >nul
start "VizrtControlHub - Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo Backend  : http://127.0.0.1:3000
echo Frontend : http://127.0.0.1:5173
echo.
echo Both servers are running. Close their windows to stop.
