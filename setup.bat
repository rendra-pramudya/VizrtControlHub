@echo off
rem ------------------------------------------------------------------
rem  VizrtControlHub - setup
rem  1. Cek Node.js (tawarkan install via winget kalau belum ada)
rem  2. npm install di backend, frontend, mcp-server
rem  3. Buat .env dari .env.example kalau belum ada
rem  Jalankan sekali setelah clone / setelah package.json berubah.
rem  "setup.bat nopause" = tanpa pause di akhir (dipakai start.bat).
rem ------------------------------------------------------------------
setlocal
title VizrtControlHub - Setup
cd /d "%~dp0"

echo.
echo === VizrtControlHub setup ===
echo.

call "%~dp0scripts\find-node.bat"
if not errorlevel 1 goto :node_ok

where winget >nul 2>&1 || goto :node_manual
echo.
choice /c YN /m "Install Node.js LTS sekarang lewat winget"
if errorlevel 2 goto :node_manual
winget install -e --id OpenJS.NodeJS.LTS
call "%~dp0scripts\find-node.bat"
if not errorlevel 1 goto :node_ok

:node_manual
echo.
echo Node.js 20+ belum terpasang. Install versi LTS dari https://nodejs.org
echo lalu tutup jendela ini dan jalankan setup.bat lagi.
goto :failed

:node_ok
for /f %%V in ('node -v') do echo [ok] Node.js %%V
for /f %%V in ('npm -v') do echo [ok] npm %%V

for %%P in (backend frontend mcp-server) do (
  echo.
  echo --- npm install: %%P ---
  pushd "%~dp0%%P"
  call npm install
  if errorlevel 1 (
    popd
    echo [gagal] npm install di %%P gagal. Cek pesan error di atas.
    goto :failed
  )
  popd
)

if not exist "%~dp0backend\node_modules\.bin\nodemon.cmd" (
  echo [gagal] nodemon tidak terpasang di backend.
  goto :failed
)
if not exist "%~dp0frontend\node_modules\.bin\vite.cmd" (
  echo [gagal] vite tidak terpasang di frontend.
  goto :failed
)

if not exist "%~dp0.env" (
  copy "%~dp0.env.example" "%~dp0.env" >nul
  echo.
  echo [info] File .env dibuat dari .env.example.
  echo        Isi VIZ_HUB_PASSWORD di .env untuk akses Graphics Hub.
)

echo.
echo === Setup selesai. Jalankan start.bat ===
if /i not "%~1"=="nopause" pause
exit /b 0

:failed
echo.
echo === Setup GAGAL ===
if /i not "%~1"=="nopause" pause
exit /b 1
