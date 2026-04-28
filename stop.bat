@echo off
title VizrtControlHub - Stop

echo Stopping VizrtControlHub...

taskkill /FI "WINDOWTITLE eq VizrtControlHub - Backend" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq VizrtControlHub - Frontend" /T /F >nul 2>&1

echo Done.
timeout /t 2 /nobreak >nul
