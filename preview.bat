@echo off
setlocal EnableExtensions
cd /d "%~dp0"

title Watermarker - Preview
echo ========================================
echo   Watermarker - Production Preview
echo ========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [HATA] Node.js bulunamadi.
  pause
  exit /b 1
)

if not exist "dist\index.html" (
  echo [UYARI] dist yok. Once build yapiliyor...
  call "%~dp0build.bat"
  if errorlevel 1 exit /b 1
)

set "HOST=127.0.0.1"
set "PORT=4173"

echo Onizleme: http://%HOST%:%PORT%/
echo Durdurmak icin Ctrl+C
echo.

start "" cmd /c "timeout /t 2 /nobreak >nul & start http://%HOST%:%PORT%/"
call npm.cmd run preview -- --host %HOST% --port %PORT%
exit /b %ERRORLEVEL%
