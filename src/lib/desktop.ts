/**
 * Capa de abstracción para ejecutar NetHub tanto en el navegador (preview/web)
 * como empaquetado en escritorio con Tauri o Electron.
 *
 * - Tauri: usa los plugins oficiales @tauri-apps/plugin-fs y plugin-shell.
 * - Electron: espera un `preload` que exponga `window.nethub`.
 * - Web: no hay acceso al sistema; se usan los fallbacks (localStorage + import manual).
 */

import type { Device } from "./devices";
import { parseArpOutput, parseHostsJson } from "./scanner";

export type Runtime = "web" | "tauri" | "electron";

/** API que debe exponer el preload de Electron (ver modal de empaquetado). */
interface ElectronBridge {
  readDevices?: () => Promise<string | null>;
  writeDevices?: (json: string) => Promise<void>;
  scanNetwork?: () => Promise<unknown>;
  dbPath?: () => Promise<string>;
}

declare global {
  interface Window {
    nethub?: ElectronBridge;
    __TAURI_INTERNALS__?: unknown;
    __TAURI__?: unknown;
  }
}

export const DB_FILE = "devices-db.json";

export function getRuntime(): Runtime {
  if (typeof window === "undefined") return "web";
  if (window.__TAURI_INTERNALS__ || window.__TAURI__) return "tauri";
  if (window.nethub) return "electron";
  return "web";
}

export function isDesktop(): boolean {
  return getRuntime() !== "web";
}

export const runtimeLabels: Record<Runtime, string> = {
  web: "Navegador (preview)",
  tauri: "App portable · Tauri",
  electron: "App portable · Electron",
};

/* ------------------------------------------------------------------ */
/* Persistencia en archivo local (devices-db.json)                     */
/* ------------------------------------------------------------------ */

/** Import dinámico opcional: los paquetes de Tauri solo existen en la app portable. */
async function optionalImport(spec: string): Promise<any> {
  return import(/* @vite-ignore */ spec);
}

export async function readDevicesFile(): Promise<Device[] | null> {
  const runtime = getRuntime();
  try {
    if (runtime === "electron" && window.nethub?.readDevices) {
      const raw = await window.nethub.readDevices();
      return raw ? (JSON.parse(raw) as Device[]) : null;
    }
    if (runtime === "tauri") {
      const fs = await optionalImport("@tauri-apps/plugin-fs");
      const exists = await fs.exists(DB_FILE, { baseDir: fs.BaseDirectory.AppData });
      if (!exists) return null;
      const raw = await fs.readTextFile(DB_FILE, { baseDir: fs.BaseDirectory.AppData });
      return JSON.parse(raw) as Device[];
    }
  } catch {
    return null;
  }
  return null;
}

export async function writeDevicesFile(devices: Device[]): Promise<boolean> {
  const runtime = getRuntime();
  const json = JSON.stringify(devices, null, 2);
  try {
    if (runtime === "electron" && window.nethub?.writeDevices) {
      await window.nethub.writeDevices(json);
      return true;
    }
    if (runtime === "tauri") {
      const fs = await optionalImport("@tauri-apps/plugin-fs");
      await fs.writeTextFile(DB_FILE, json, { baseDir: fs.BaseDirectory.AppData });
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

/* ------------------------------------------------------------------ */
/* Escaneo nativo (ARP / ping) cuando corre en escritorio              */
/* ------------------------------------------------------------------ */

export async function nativeScan(): Promise<Device[] | null> {
  const runtime = getRuntime();
  try {
    if (runtime === "electron" && window.nethub?.scanNetwork) {
      return parseHostsJson(await window.nethub.scanNetwork());
    }
    if (runtime === "tauri") {
      const shell = await optionalImport("@tauri-apps/plugin-shell");
      const output = await shell.Command.create("arp", ["-a"]).execute();
      const devices = parseArpOutput(output.stdout);
      return devices.length > 0 ? devices : null;
    }
  } catch {
    return null;
  }
  return null;
}

/** Ruta informativa del fichero de datos para mostrar en la interfaz. */
export async function getDbPath(): Promise<string> {
  const runtime = getRuntime();
  try {
    if (runtime === "electron" && window.nethub?.dbPath) return await window.nethub.dbPath();
    if (runtime === "tauri") {
      const path = await optionalImport("@tauri-apps/api/path");
      return `${await path.appDataDir()}${DB_FILE}`;
    }
  } catch {
    /* sin acceso */
  }
  return "Almacenamiento del navegador (localStorage)";
}

/* ------------------------------------------------------------------ */
/* Exportar / importar copia manual                                    */
/* ------------------------------------------------------------------ */

export function downloadDevicesJson(devices: Device[]) {
  if (typeof window === "undefined") return;
  const blob = new Blob([JSON.stringify(devices, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = DB_FILE;
  a.click();
  URL.revokeObjectURL(url);
}
