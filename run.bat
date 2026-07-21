@echo off
setlocal EnableExtensions
cd /d "%~dp0"

title Watermarker
echo ========================================
echo   Watermarker - Gelistirme Sunucusu
echo ========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [HATA] Node.js bulunamadi.
  echo Once Node.js yukleyin, sonra install.bat calistirin.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo [UYARI] node_modules yok. Kurulum baslatiliyor...
  echo.
  call "%~dp0install.bat"
  if errorlevel 1 (
    echo [HATA] Kurulum basarisiz. run.bat durduruldu.
    pause
    exit /b 1
  )
)

if not exist "package.json" (
  echo [HATA] package.json bulunamadi. Yanlis klasorde olabilirsiniz.
  pause
  exit /b 1
)

set "HOST=127.0.0.1"
set "PORT=5173"

echo Sunucu baslatiliyor: http://%HOST%:%PORT%/
echo Durdurmak icin bu pencerede Ctrl+C basin.
echo.

REM Tarayiciyi kisa gecikmeyle ac
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://%HOST%:%PORT%/"

call npm.cmd run dev -- --host %HOST% --port %PORT%
set "EXITCODE=%ERRORLEVEL%"

if not "%EXITCODE%"=="0" (
  echo.
  echo [HATA] Sunucu beklenmedik sekilde kapandi. Kod: %EXITCODE%
  pause
)

exit /b %EXITCODE%
