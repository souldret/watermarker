@echo off
setlocal EnableExtensions
cd /d "%~dp0"

title Watermarker - Web Export
echo ========================================
echo   Watermarker - Web Export / ZIP
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

if not exist "dist\index.html" (
  echo dist yok — build baslatiliyor...
  call npm.cmd run build
  if errorlevel 1 (
    echo [HATA] Build basarisiz.
    pause
    exit /b 1
  )
)

echo Release klasoru olusturuluyor...
call npm.cmd run pack:release
if errorlevel 1 (
  echo [HATA] Export basarisiz.
  pause
  exit /b 1
)

echo.
echo [OK] Cikti:
echo   release\web\
echo   release\Watermarker-*-web.zip
echo.
if exist "release\" explorer "release"
pause
exit /b 0
