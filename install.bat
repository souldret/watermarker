@echo off
setlocal EnableExtensions
cd /d "%~dp0"

title Watermarker - Kurulum
echo ========================================
echo   Watermarker - Bagimlilik Kurulumu
echo ========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [HATA] Node.js bulunamadi.
  echo Lutfen https://nodejs.org adresinden Node.js yukleyin.
  echo.
  pause
  exit /b 1
)

where npm.cmd >nul 2>&1
if errorlevel 1 (
  echo [HATA] npm bulunamadi. Node.js kurulumunu kontrol edin.
  echo.
  pause
  exit /b 1
)

echo Node.js surumu:
node -v
echo npm surumu:
call npm.cmd -v
echo.
echo Bagimliliklar yukleniyor...
echo.

call npm.cmd install
if errorlevel 1 (
  echo.
  echo [HATA] Kurulum basarisiz oldu.
  pause
  exit /b 1
)

echo.
echo [OK] Kurulum tamamlandi.
echo.
echo Kullanilabilir bat dosyalari:
echo   run.bat                 Gelistirme sunucusu
echo   build.bat               Production build (dist)
echo   preview.bat             dist onizleme
echo   export-web.bat          Web ZIP / release
echo   package-electron.bat    Windows kurulum + portable
echo   package-electron-dir.bat Hizli unpacked Electron
echo   electron-run.bat        Electron ile ac
echo   export-all.bat          Web + Electron tam paket
echo   test.bat                Typecheck + test
echo   clean.bat               dist/release temizle
echo.
pause
exit /b 0
