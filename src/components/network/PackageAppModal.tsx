import { useEffect, useState } from "react";
import { Check, Copy, Package, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface PackageAppModalProps {
  open: boolean;
  onClose: () => void;
  dbPath: string;
  runtimeLabel: string;
}

type Tab = "bat" | "tauri" | "electron";

const buildBat = `@echo off
REM ============================================================
REM  build-portable.bat  ·  crea NetHub.exe con un solo clic
REM  Guarda este fichero en una carpeta vacia y haz doble clic.
REM ============================================================
setlocal enabledelayedexpansion
title NetHub - Crear aplicacion portable
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [!] Falta Node.js. Instalalo desde https://nodejs.org (version LTS) y repite.
  pause & exit /b 1
)

REM 1) Codigo fuente: si no esta, se descarga del repositorio
if not exist "package.json" (
  if not exist "nethub\\package.json" (
    where git >nul 2>nul
    if errorlevel 1 (
      echo [!] Falta Git. Instalalo desde https://git-scm.com y repite.
      pause & exit /b 1
    )
    echo [1/5] Descargando el codigo...
    git clone %NETHUB_REPO% nethub || (echo [!] Define NETHUB_REPO con la URL de tu repositorio. & pause & exit /b 1)
  )
  cd nethub
)

echo [2/5] Instalando dependencias...
call npm install || (pause & exit /b 1)
call npm install --save-dev electron electron-builder || (pause & exit /b 1)

echo [3/5] Compilando la interfaz...
call npm run build || (pause & exit /b 1)

echo [4/5] Generando el ejecutable portable...
call npx electron-builder --win portable || (pause & exit /b 1)

echo [5/5] Copiando NetHub.exe...
for %%F in ("release\\*.exe") do copy /y "%%F" "%~dp0NetHub.exe" >nul

echo.
echo  Listo: %~dp0NetHub.exe
echo  Tus datos se guardaran en devices-db.json junto al .exe
pause`;

const updateBat = `@echo off
REM ============================================================
REM  update-portable.bat  ·  actualiza NetHub sin perder datos
REM  devices-db.json NUNCA se toca: vive junto al .exe
REM ============================================================
setlocal
title NetHub - Actualizar aplicacion portable
cd /d "%~dp0"

if not exist "nethub\\package.json" (
  echo [!] No encuentro el codigo. Ejecuta primero build-portable.bat
  pause & exit /b 1
)

cd nethub
echo [1/4] Descargando la ultima version...
call git pull || (pause & exit /b 1)
echo [2/4] Actualizando dependencias...
call npm install || (pause & exit /b 1)
echo [3/4] Compilando...
call npm run build && call npx electron-builder --win portable || (pause & exit /b 1)

echo [4/4] Reemplazando el ejecutable...
for %%F in ("release\\*.exe") do copy /y "%%F" "%~dp0NetHub.exe" >nul

echo.
echo  Actualizado. devices-db.json se ha conservado intacto.
pause`;

const tauriCommands = `# 1) Dependencias de Tauri (una sola vez)
npm install -D @tauri-apps/cli
npm install @tauri-apps/api @tauri-apps/plugin-fs @tauri-apps/plugin-shell

# 2) Inicializar Tauri (acepta los valores por defecto)
#    Dev server: http://localhost:8080   ·   Carpeta de build: ../dist
npx tauri init

# 3) Compilar el ejecutable portable de Windows (un solo comando)
npm run build
npx tauri build

# Resultado:
#   src-tauri/target/release/nethub.exe                  <- portable, un solo archivo
#   src-tauri/target/release/bundle/msi/*.msi            <- instalador opcional`;

const tauriConfig = `// src-tauri/tauri.conf.json  (fragmento relevante)
{
  "productName": "NetHub",
  "identifier": "app.nethub.local",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:8080",
    "beforeBuildCommand": "npm run build"
  },
  "app": {
    "windows": [{ "title": "NetHub", "width": 1280, "height": 860 }]
  },
  "plugins": {
    "shell": { "open": false, "scope": [{ "name": "arp", "cmd": "arp", "args": true }] },
    "fs": { "scope": ["$APPDATA/*"] }
  }
}`;

const electronCommands = `# 1) Dependencias de Electron (una sola vez)
npm install -D electron electron-builder

# 2) Compilar la web y generar el .exe portable
npm run build
npx electron-builder --win portable

# Resultado:
#   release/NetHub 1.0.0.exe        <- ejecutable portable (no necesita instalación)`;

const electronMain = `// electron/main.cjs
const { app, BrowserWindow, ipcMain } = require("electron");
const { execFile } = require("node:child_process");
const fs = require("node:fs/promises");
const path = require("node:path");

// El fichero de datos vive junto al ejecutable portable:
const dbFile = path.join(path.dirname(app.getPath("exe")), "devices-db.json");

ipcMain.handle("nethub:read", async () => {
  try { return await fs.readFile(dbFile, "utf8"); } catch { return null; }
});
ipcMain.handle("nethub:write", (_e, json) => fs.writeFile(dbFile, json, "utf8"));
ipcMain.handle("nethub:path", () => dbFile);
ipcMain.handle("nethub:scan", () => new Promise((resolve) => {
  execFile("arp", ["-a"], { windowsHide: true }, (_err, stdout = "") => {
    const devices = [];
    const seen = new Set();
    for (const line of stdout.split(/\\r?\\n/)) {
      const ip = line.match(/(\\d{1,3}(?:\\.\\d{1,3}){3})/)?.[1];
      const mac = line.match(/([0-9a-f]{2}(?:[:-][0-9a-f]{2}){5})/i)?.[1];
      if (!ip || !mac) continue;
      const macV = mac.toUpperCase().replace(/-/g, ":");
      if (macV === "FF:FF:FF:FF:FF:FF" || seen.has(macV)) continue;
      seen.add(macV);
      devices.push({ ip, mac: macV, online: true });
    }
    resolve({ devices });
  });
}));

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 1280, height: 860,
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true },
  });
  win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
});`;

const electronPreload = `// electron/preload.cjs
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("nethub", {
  readDevices: () => ipcRenderer.invoke("nethub:read"),
  writeDevices: (json) => ipcRenderer.invoke("nethub:write", json),
  scanNetwork: () => ipcRenderer.invoke("nethub:scan"),
  dbPath: () => ipcRenderer.invoke("nethub:path"),
});`;

const electronPackageJson = `// package.json (fragmentos)
{
  "main": "electron/main.cjs",
  "build": {
    "appId": "app.nethub.local",
    "productName": "NetHub",
    "directories": { "output": "release" },
    "files": ["dist/**", "electron/**"],
    "win": { "target": ["portable"] }
  }
}

// vite.config.ts: para que funcione con file:// añade  base: "./"`;

export function PackageAppModal({
  open,
  onClose,
  dbPath,
  runtimeLabel,
}: PackageAppModalProps) {
  const [tab, setTab] = useState<Tab>("tauri");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!open) return null;

  const copy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      setCopiedKey(null);
    }
  };

  const blocks: Array<{ key: string; title: string; code: string }> =
    tab === "tauri"
      ? [
          { key: "t-cmd", title: "Comandos (PowerShell)", code: tauriCommands },
          { key: "t-conf", title: "src-tauri/tauri.conf.json", code: tauriConfig },
        ]
      : [
          { key: "e-cmd", title: "Comandos (PowerShell)", code: electronCommands },
          { key: "e-main", title: "electron/main.cjs", code: electronMain },
          { key: "e-pre", title: "electron/preload.cjs", code: electronPreload },
          { key: "e-pkg", title: "package.json + vite.config.ts", code: electronPackageJson },
        ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-8">
      <button
        aria-label="Cerrar"
        onClick={onClose}
        className="fixed inset-0 bg-background/75 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Empaquetar App Portable"
        className="relative w-full max-w-3xl rounded-2xl border border-border bg-card p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              <Package className="size-5 text-brand" />
              Empaquetar App Portable
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Genera un <code className="font-mono text-xs">.exe</code> para Windows que
              no necesita instalación. En modo escritorio el escaneo ARP se hace de forma
              nativa y los dispositivos se guardan en{" "}
              <code className="font-mono text-xs">devices-db.json</code>.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Cerrar"
          >
            <X className="size-4" />
          </button>
        </div>

        <dl className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border p-4">
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">
              Entorno actual
            </dt>
            <dd className="mt-1 text-sm font-medium">{runtimeLabel}</dd>
          </div>
          <div className="min-w-0 rounded-xl border border-border p-4">
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">
              Datos guardados en
            </dt>
            <dd className="mt-1 truncate font-mono text-xs" title={dbPath}>
              {dbPath}
            </dd>
          </div>
        </dl>

        <div className="mt-5 flex gap-2">
          {(["tauri", "electron"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm transition-colors",
                tab === t
                  ? "border-brand bg-brand text-brand-foreground"
                  : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {t === "tauri" ? "Tauri (.exe ~6 MB)" : "Electron Builder"}
            </button>
          ))}
        </div>

        <p className="mt-4 rounded-xl border border-border bg-muted/40 p-4 text-xs text-muted-foreground">
          {tab === "tauri" ? (
            <>
              Requisitos en Windows: Rust (rustup) y «Visual Studio Build Tools» con el
              paquete C++. El ejecutable queda en{" "}
              <code className="font-mono">src-tauri\target\release\nethub.exe</code> y el
              fichero de datos en{" "}
              <code className="font-mono">%APPDATA%\NetHub\devices-db.json</code>.
            </>
          ) : (
            <>
              Requisitos: solo Node.js. El ejecutable portable queda en{" "}
              <code className="font-mono">release\NetHub 1.0.0.exe</code> y el fichero de
              datos se crea junto al propio .exe, así que puedes llevarlo en un pendrive
              con su configuración incluida.
            </>
          )}
        </p>

        <div className="mt-5 space-y-4">
          {blocks.map((block) => (
            <div key={block.key} className="overflow-hidden rounded-xl border border-border">
              <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/40 px-4 py-2">
                <span className="truncate font-mono text-xs text-muted-foreground">
                  {block.title}
                </span>
                <button
                  onClick={() => copy(block.key, block.code)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-brand-foreground transition-opacity hover:opacity-90"
                >
                  {copiedKey === block.key ? (
                    <Check className="size-3.5" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                  {copiedKey === block.key ? "Copiado" : "Copiar"}
                </button>
              </div>
              <pre className="max-h-72 overflow-auto bg-background p-4 font-mono text-xs leading-relaxed">
                {block.code}
              </pre>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
