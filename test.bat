@echo off
setlocal EnableExtensions
cd /d "%~dp0"

title Watermarker - Test
echo ========================================
echo   Watermarker - Typecheck + Test
echo ========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [HATA] Node.js bulunamadi.
  pause
  exit /b 1
)

if not exist "node_modules\" call "%~dp0install.bat"

echo [1/2] Typecheck...
call npm.cmd run check
if errorlevel 1 (
  echo [HATA] Typecheck basarisiz.
  pause
  exit /b 1
)

echo.
echo [2/2] Unit testler...
call npm.cmd test
if errorlevel 1 (
  echo [HATA] Testler basarisiz.
  pause
  exit /b 1
)

echo.
echo [OK] Tum kontroller gecti.
pause
exit /b 0
