@echo off
setlocal EnableExtensions
cd /d "%~dp0"

title Watermarker - Full Export
echo ========================================
echo   Watermarker - Tam paketleme
echo   Web ZIP + Electron installer/portable
echo ========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [HATA] Node.js bulunamadi.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  call npm.cmd install
  if errorlevel 1 exit /b 1
)

echo === WEB BUILD ===
call npm.cmd run build
if errorlevel 1 (
  echo [HATA] Build basarisiz.
  pause
  exit /b 1
)

echo.
echo === WEB EXPORT ZIP ===
call npm.cmd run pack:release
if errorlevel 1 (
  echo [HATA] Web export basarisiz.
  pause
  exit /b 1
)

echo.
echo === ELECTRON PACKAGE ===
if not exist "node_modules\electron-builder\" (
  call npm.cmd install electron-builder --save-dev
)
call npx.cmd electron-builder --win
if errorlevel 1 (
  echo [UYARI] Electron paketleme basarisiz — web export yine de hazir.
  echo release\web ve ZIP dosyasina bakin.
  pause
  exit /b 1
)

echo.
echo [OK] Her sey hazir:
echo   release\web\
echo   release\Watermarker-*-web.zip
echo   release\electron\
echo.
if exist "release\" explorer "release"
pause
exit /b 0
