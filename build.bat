@echo off
setlocal EnableExtensions
cd /d "%~dp0"

title Watermarker - Build
echo ========================================
echo   Watermarker - Production Build
echo ========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [HATA] Node.js bulunamadi.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo [UYARI] Bagimliliklar yok. install.bat calistiriliyor...
  call "%~dp0install.bat"
  if errorlevel 1 exit /b 1
)

echo Eski dist temizleniyor...
if exist "dist\" rmdir /s /q "dist"

echo Typecheck + Vite build basliyor...
echo.
call npm.cmd run build
if errorlevel 1 (
  echo [HATA] Build basarisiz.
  pause
  exit /b 1
)

echo.
echo [OK] Build tamamlandi: dist\
echo Sonraki adimlar:
echo   - preview.bat          ^> dist onizleme
echo   - export-web.bat       ^> release ZIP
echo   - package-electron.bat ^> Windows kurulum/portable
echo.
pause
exit /b 0
