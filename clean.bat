@echo off
setlocal EnableExtensions
cd /d "%~dp0"

title Watermarker - Clean
echo ========================================
echo   Watermarker - Temizlik
echo ========================================
echo.
echo Silinecekler: dist, release, (opsiyonel) node_modules
echo.

set /p CONFIRM=dist ve release silinsin mi? [E/H]: 
if /i not "%CONFIRM%"=="E" (
  echo Iptal.
  pause
  exit /b 0
)

if exist "dist\" (
  rmdir /s /q "dist"
  echo [OK] dist silindi
)
if exist "release\" (
  rmdir /s /q "release"
  echo [OK] release silindi
)

set /p NM=node_modules da silinsin mi? [E/H]: 
if /i "%NM%"=="E" (
  if exist "node_modules\" (
    rmdir /s /q "node_modules"
    echo [OK] node_modules silindi — sonra install.bat calistirin
  )
)

echo.
echo Temizlik bitti.
pause
exit /b 0
