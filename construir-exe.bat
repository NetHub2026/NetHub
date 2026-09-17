@echo off
setlocal
title NetHub - Construir ejecutable portable
cd /d "%~dp0"

echo ============================================
echo   NetHub - Generando NetHub.exe portable
echo ============================================
echo.

echo Comprobando Node.js y npm...
where node >nul 2>&1
if errorlevel 1 goto nonode
where npm >nul 2>&1
if errorlevel 1 goto nonode
echo Node.js y npm encontrados.
echo.

echo [1/4] Instalando dependencias...
call npm install
if errorlevel 1 goto error

echo.
echo [2/4] Compilando la aplicacion...
call npm run build
if errorlevel 1 goto error

echo.
echo [3/4] Comprobando los archivos web compilados...
call node scripts\ensure-index-html.mjs
if errorlevel 1 goto error

set HAVE_INDEX=0
if exist ".output\public\index.html" set HAVE_INDEX=1
if exist "dist\client\index.html" set HAVE_INDEX=1
if exist "dist\index.html" set HAVE_INDEX=1
if "%HAVE_INDEX%"=="0" goto noindex
echo index.html encontrado.
echo.

echo [4/4] Empaquetando el ejecutable portable...
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

:nonode
echo.
echo ERROR: Node.js o npm no se han encontrado en el sistema.
echo Instala Node.js desde https://nodejs.org y vuelve a intentarlo.
echo.
pause
exit /b 1

:noindex
echo.
echo ERROR: No se ha podido generar index.html. Revisa la compilacion.
echo.
pause
exit /b 1

:error
echo.
echo Se ha producido un error. Revisa los mensajes anteriores.
echo.
pause
exit /b 1
