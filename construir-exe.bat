@echo off
setlocal
title NetHub - Construir ejecutable portable
cd /d "%~dp0"

echo ============================================
echo   NetHub - Generando NetHub.exe portable
echo ============================================
echo.

echo [1/3] Instalando dependencias...
call npm install
if errorlevel 1 goto error

echo.
echo [2/3] Compilando la aplicacion...
call npm run build
if errorlevel 1 goto error

echo.
echo [3/3] Empaquetando el ejecutable portable...
call npx electron-builder --win portable
if errorlevel 1 goto error

echo.
echo ============================================
echo   Listo. Tu ejecutable esta en: dist-electron
echo   Copia NetHub.exe a cualquier PC o pendrive
echo   y abrelo con doble clic.
echo ============================================
echo.
pause
exit /b 0

:error
echo.
echo Se ha producido un error. Revisa los mensajes anteriores.
echo.
pause
exit /b 1
