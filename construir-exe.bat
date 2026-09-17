@echo off
setlocal
title NetHub - Construir ejecutable portable
cd /d "%~dp0"

REM === Comprobacion de permisos de Administrador ===
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo No tienes permisos de Administrador.
    echo Intentando elevar automaticamente...
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    if not errorlevel 1 (
        rem Se relanzo como Administrador; esta ventana ya no es necesaria
        exit /b 0
    )
    echo.
    echo ============================================
    echo   ATENCION: se necesitan permisos de
    echo   Administrador para extraer las herramientas
    echo   de compilacion (enlaces simbolicos).
    echo.
    echo   Cierra esta ventana, haz clic derecho sobre
    echo   construir-exe.bat y elige
    echo   "Ejecutar como administrador".
    echo ============================================
    echo.
    pause
    exit /b 1
)

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
echo [3/4] Comprobando los archivos web compilados...
call node scripts\ensure-index-html.mjs
if not exist ".output\public\index.html" (
    if not exist "dist\client\index.html" (
        if not exist "dist\index.html" (
            echo No se ha podido generar index.html. Revisa la compilacion.
            goto error
        )
    )
)

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

:error
echo.
echo Se ha producido un error. Revisa los mensajes anteriores.
echo.
pause
exit /b 1
