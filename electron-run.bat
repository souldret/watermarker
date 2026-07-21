@echo off
setlocal EnableExtensions
cd /d "%~dp0"

title Watermarker - Electron
echo ========================================
echo   Watermarker - Electron baslat
echo ========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [HATA] Node.js bulunamadi.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  call "%~dp0install.bat"
  if errorlevel 1 exit /b 1
)

if not exist "node_modules\electron\" (
  echo electron yukleniyor...
  call npm.cmd install electron --save-dev
)

if not exist "dist\index.html" (
  echo dist yok — build yapiliyor...
  call npm.cmd run build
  if errorlevel 1 (
    echo [HATA] Build basarisiz.
    pause
    exit /b 1
  )
)

echo Electron baslatiliyor...
call npx.cmd electron .
set "EXITCODE=%ERRORLEVEL%"
if not "%EXITCODE%"=="0" (
  echo [HATA] Electron kapandi. Kod: %EXITCODE%
  pause
)
exit /b %EXITCODE%
