@echo off
setlocal EnableExtensions
cd /d "%~dp0"

title Watermarker - Electron Package
echo ========================================
echo   Watermarker - Electron Paketleme
echo   (NSIS kurulum + portable EXE)
echo ========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [HATA] Node.js bulunamadi.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo Bagimliliklar yukleniyor...
  call npm.cmd install
  if errorlevel 1 (
    echo [HATA] npm install basarisiz.
    pause
    exit /b 1
  )
)

REM electron-builder yoksa kur
if not exist "node_modules\electron-builder\" (
  echo electron-builder yukleniyor...
  call npm.cmd install electron-builder --save-dev
  if errorlevel 1 (
    echo [HATA] electron-builder kurulamadi.
    pause
    exit /b 1
  )
)

echo.
echo 1/2 Web build...
call npm.cmd run build
if errorlevel 1 (
  echo [HATA] Build basarisiz.
  pause
  exit /b 1
)

echo.
echo 2/2 Electron builder (Windows x64)...
echo Bu islem ilk seferde uzun surebilir ( indirme ).
echo.
call npx.cmd electron-builder --win
if errorlevel 1 (
  echo.
  echo [HATA] Electron paketleme basarisiz.
  echo Ipuclari:
  echo   - Internet baglantisi gerekli (ilk sefer)
  echo   - Antivirus engelliyorsa gecici kapatin
  echo   - package-electron-dir.bat ile klasor ciktisi deneyin
  pause
  exit /b 1
)

echo.
echo [OK] Paketler:
echo   release\electron\
echo.
if exist "release\electron\" explorer "release\electron"
pause
exit /b 0
