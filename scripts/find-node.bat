@echo off
rem ------------------------------------------------------------------
rem  Makes sure Node.js (>= 20) and npm are on PATH for this window.
rem  Use with:  call scripts\find-node.bat
rem  Returns errorlevel 0 when OK, 1 when Node.js is missing/too old.
rem ------------------------------------------------------------------

where node >nul 2>&1 && goto :check

rem Not on PATH: look in the usual install folders.
for %%D in ("%ProgramFiles%\nodejs" "%ProgramW6432%\nodejs" "%LOCALAPPDATA%\Programs\nodejs" "%NVM_SYMLINK%") do (
  if exist "%%~D\node.exe" (
    echo [node] Node.js ditemukan di %%~D, ditambahkan ke PATH sementara.
    set "PATH=%%~D;%PATH%"
    goto :check
  )
)
echo [node] Node.js tidak ditemukan.
exit /b 1

:check
where npm >nul 2>&1 || (
  echo [node] node ada tapi npm tidak ditemukan. Install ulang Node.js LTS.
  exit /b 1
)
set "NODE_MAJOR="
for /f "tokens=1 delims=v." %%M in ('node -v') do set "NODE_MAJOR=%%M"
if not defined NODE_MAJOR (
  echo [node] Tidak bisa membaca versi Node.js.
  exit /b 1
)
if %NODE_MAJOR% LSS 20 (
  echo [node] Node.js terlalu lama, butuh versi 20 atau lebih baru.
  node -v
  exit /b 1
)
exit /b 0
