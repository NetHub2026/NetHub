/**
 * Preferencias de NetHub: se guardan en el navegador (localStorage) y las
 * opciones nativas (autoinicio, cierre a la bandeja, carpeta de datos y
 * notificaciones de Windows) se aplican a través del puente de Electron.
 */

import { readSettingsFile, writeSettingsFile } from "./desktop";

export type ThemeMode = "light" | "dark" | "auto";
export type CloseAction = "tray" | "quit";
export type ScanMode = "fast" | "deep";

export interface Settings {
  /* Sistema y arranque */
  startWithWindows: boolean;
  closeAction: CloseAction;
  minimizeToTray: boolean;
  /* Apariencia */
  theme: ThemeMode;
  /* Red y telemetría */
  linkSpeedMbps: number;
  scanIntervalSeconds: number;
  scanMode: ScanMode;
  wolPort: number;
  wolBroadcast: string;
  /* Alertas y monitorización */
  notifyNewDevices: boolean;
  alertCriticalOffline: boolean;
  skipRandomMac: boolean;
  /* Mantenimiento */
  checkUpdatesOnStart: boolean;
}

export const defaultSettings: Settings = {
  startWithWindows: false,
  closeAction: "tray",
  minimizeToTray: true,
  theme: "dark",
  linkSpeedMbps: 600,
  scanIntervalSeconds: 120,
  scanMode: "fast",
  wolPort: 9,
  wolBroadcast: "255.255.255.255",
  notifyNewDevices: true,
  alertCriticalOffline: true,
  skipRandomMac: false,
  checkUpdatesOnStart: true,
};

export const linkSpeedOptions = [100, 300, 600, 1000];
export const scanIntervalOptions: Array<{ value: number; label: string }> = [
  { value: 0, label: "Desactivado" },
  { value: 120, label: "Cada 2 minutos" },
  { value: 300, label: "Cada 5 minutos" },
  { value: 600, label: "Cada 10 minutos" },
];

const SETTINGS_KEY = "nethub.settings.v1";

export function loadSettings(): Settings {
  if (typeof window === "undefined") return defaultSettings;
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return sanitizeSettings(parsed);
  } catch {
    return defaultSettings;
  }
}

export function sanitizeSettings(value: Partial<Settings>): Settings {
  const number = (input: unknown, fallback: number) => {
    const n = Number(input);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };
  return {
    startWithWindows: Boolean(value.startWithWindows),
    closeAction: value.closeAction === "quit" ? "quit" : "tray",
    minimizeToTray: value.minimizeToTray !== false,
    theme:
      value.theme === "light" || value.theme === "auto" ? value.theme : "dark",
    linkSpeedMbps: number(value.linkSpeedMbps, defaultSettings.linkSpeedMbps),
    scanIntervalSeconds: scanIntervalOptions.some(
      (o) => o.value === Number(value.scanIntervalSeconds),
    )
      ? Number(value.scanIntervalSeconds)
      : defaultSettings.scanIntervalSeconds,
    scanMode: value.scanMode === "deep" ? "deep" : "fast",
    wolPort: number(value.wolPort, defaultSettings.wolPort),
    wolBroadcast: String(value.wolBroadcast || defaultSettings.wolBroadcast),
    notifyNewDevices: value.notifyNewDevices !== false,
    alertCriticalOffline: value.alertCriticalOffline !== false,
    skipRandomMac: Boolean(value.skipRandomMac),
    checkUpdatesOnStart: value.checkUpdatesOnStart !== false,
  };
}

export function saveSettings(settings: Settings) {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* sin almacenamiento */
  }
}

/**
 * Carga las preferencias dando prioridad al archivo `settings.json` del disco
 * (app de escritorio) y usando localStorage como respaldo (o en web).
 */
export async function loadSettingsAnywhere(): Promise<Settings> {
  const fromDisk = await readSettingsFile();
  if (fromDisk && typeof fromDisk === "object") {
    const raw = fromDisk as Record<string, unknown>;
    const inner = raw["settings"];
    const payload = (inner && typeof inner === "object" ? inner : raw) as Partial<Settings>;
    const merged = sanitizeSettings({ ...loadSettings(), ...payload });
    saveSettings(merged);
    return merged;
  }
  const local = loadSettings();
  // Primer arranque en escritorio: se crea settings.json con lo que haya.
  void writeSettingsFile(local);
  return local;
}

/** Guarda al instante en localStorage y en `settings.json` junto al ejecutable. */
export async function saveSettingsAnywhere(settings: Settings): Promise<void> {
  saveSettings(settings);
  await writeSettingsFile(settings);
}

/** Resuelve el tema efectivo: en «automático» sigue la preferencia de Windows. */
export function resolveDark(theme: ThemeMode): boolean {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  if (typeof window === "undefined" || !window.matchMedia) return true;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}
