@echo off
setlocal EnableExtensions
cd /d "%~dp0"

title Watermarker - Electron (dir, hizli)
echo ========================================
echo   Watermarker - Electron unpacked
echo   (installer yok, hizli test)
echo ========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [HATA] Node.js bulunamadi.
  pause
  exit /b 1
)

if not exist "node_modules\" call npm.cmd install
if not exist "node_modules\electron-builder\" call npm.cmd install electron-builder --save-dev

call npm.cmd run build
if errorlevel 1 (
  echo [HATA] Build basarisiz.
  pause
  exit /b 1
)

call npx.cmd electron-builder --win --dir
if errorlevel 1 (
  echo [HATA] Paketleme basarisiz.
  pause
  exit /b 1
)

echo.
echo [OK] Unpacked uygulama:
echo   release\electron\win-unpacked\Watermarker.exe
echo.
if exist "release\electron\win-unpacked\" explorer "release\electron\win-unpacked"
pause
exit /b 0
