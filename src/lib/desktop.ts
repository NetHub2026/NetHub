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
  ping?: (ip: string) => Promise<{ ok: boolean; rtt: number | null }>;
  wol?: (mac: string) => Promise<boolean>;
  traffic?: () => Promise<TrafficSample>;
  checkUpdate?: () => Promise<UpdateInfo>;
  installUpdate?: (onProgress: (p: UpdateProgress) => void) => Promise<InstallResult>;
}

/** Muestra instantánea de tráfico de red en Mbps. */
export interface TrafficSample {
  rxMbps: number;
  txMbps: number;
  totalMbps: number;
}

/** Versión de NetHub que se muestra en la interfaz (coincide con package.json). */
export const APP_VERSION = "1.0.0";

/** Se prueba el nombre nuevo del repositorio y, si no existe, el anterior. */
const GITHUB_REPOS = ["oyogor1985/nethub", "oyogor1985/connected-clan"];


export interface UpdateInfo {
  ok: boolean;
  currentVersion: string;
  latestVersion: string;
  available: boolean;
  notes: string;
  downloadUrl: string | null;
  size: number;
  publishedAt?: string | null;
  error?: string;
}

export interface UpdateProgress {
  received: number;
  total: number;
  percent: number;
}

export interface InstallResult {
  ok: boolean;
  version?: string;
  restarting?: boolean;
  error?: string;
}

function normalizeVersion(value: unknown): string {
  return String(value ?? "").trim().replace(/^v/i, "");
}

function compareVersions(a: string, b: string): number {
  const pa = normalizeVersion(a).split(/[.\-+]/).map((n) => Number(n) || 0);
  const pb = normalizeVersion(b).split(/[.\-+]/).map((n) => Number(n) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * Comprueba si hay una versión más reciente publicada en GitHub.
 * En la app de escritorio lo hace el proceso principal; en el navegador
 * se consulta la API pública solo para informar (sin poder instalar).
 */
export async function checkUpdate(): Promise<UpdateInfo> {
  if (typeof window !== "undefined" && window.nethub?.checkUpdate) {
    return window.nethub.checkUpdate();
  }
  const base: UpdateInfo = {
    ok: false,
    currentVersion: APP_VERSION,
    latestVersion: APP_VERSION,
    available: false,
    notes: "",
    downloadUrl: null,
    size: 0,
  };
  try {
    let response: Response | null = null;
    for (const repo of GITHUB_REPOS) {
      const attempt = await fetch(`https://api.github.com/repos/${repo}/releases/latest`);
      if (attempt.ok) {
        response = attempt;
        break;
      }
      response = attempt;
    }
    if (!response || !response.ok) {
      return { ...base, error: `GitHub respondió ${response?.status ?? "sin respuesta"}` };
    }
    const release = (await response.json()) as {
      tag_name?: string;
      name?: string;
      body?: string;
      published_at?: string;
      assets?: Array<{ name?: string; browser_download_url?: string; size?: number }>;
    };

    const latest = normalizeVersion(release.tag_name || release.name);
    const asset = (release.assets || []).find((a) => a.name?.toLowerCase() === "nethub.exe");
    return {
      ok: true,
      currentVersion: APP_VERSION,
      latestVersion: latest || APP_VERSION,
      available: Boolean(latest) && compareVersions(latest, APP_VERSION) > 0,
      notes: release.body || "",
      downloadUrl: asset?.browser_download_url || null,
      size: asset?.size || 0,
      publishedAt: release.published_at || null,
    };
  } catch (error) {
    return { ...base, error: String(error) };
  }
}

/** Descarga e instala la nueva versión (solo en la app de escritorio). */
export async function installUpdate(
  onProgress: (progress: UpdateProgress) => void,
): Promise<InstallResult> {
  if (typeof window !== "undefined" && window.nethub?.installUpdate) {
    return window.nethub.installUpdate(onProgress);
  }
  return {
    ok: false,
    error: "La actualización automática solo está disponible en la app de escritorio de NetHub.",
  };
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

/** Contenido de devices-db.json: inventario + listas de personas y ubicaciones. */
export interface DbPayload {
  devices: Device[];
  people: string[];
  locations: string[];
}

async function readDbRaw(): Promise<string | null> {
  const runtime = getRuntime();
  if (runtime === "electron" && window.nethub?.readDevices) {
    return (await window.nethub.readDevices()) ?? null;
  }
  if (runtime === "tauri") {
    const fs = await optionalImport("@tauri-apps/plugin-fs");
    const exists = await fs.exists(DB_FILE, { baseDir: fs.BaseDirectory.AppData });
    if (!exists) return null;
    return (await fs.readTextFile(DB_FILE, { baseDir: fs.BaseDirectory.AppData })) as string;
  }
  return null;
}

/** Lee el archivo local aceptando el formato antiguo (solo array de dispositivos). */
export async function readDbFile(): Promise<DbPayload | null> {
  try {
    const raw = await readDbRaw();
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return { devices: parsed as Device[], people: [], locations: [] };
    }
    const obj = (parsed ?? {}) as Partial<DbPayload>;
    return {
      devices: Array.isArray(obj.devices) ? obj.devices : [],
      people: Array.isArray(obj.people) ? obj.people : [],
      locations: Array.isArray(obj.locations) ? obj.locations : [],
    };
  } catch {
    return null;
  }
}

export async function writeDbFile(payload: DbPayload): Promise<boolean> {
  const runtime = getRuntime();
  const json = JSON.stringify({ app: "NetHub", savedAt: new Date().toISOString(), ...payload }, null, 2);
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

export async function readDevicesFile(): Promise<Device[] | null> {
  const payload = await readDbFile();
  return payload ? payload.devices : null;
}

export async function writeDevicesFile(devices: Device[]): Promise<boolean> {
  return writeDbFile({ devices, people: [], locations: [] });
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

/* ------------------------------------------------------------------ */
/* Ping ICMP y Wake-on-LAN nativos                                     */
/* ------------------------------------------------------------------ */

function parsePingOutput(output: string): { ok: boolean; rtt: number | null } {
  const match = output.match(/(?:tiempo|time)[=<]\s*(\d+(?:[.,]\d+)?)\s*ms/i);
  if (match?.[1]) {
    return { ok: true, rtt: Math.round(Number(match[1].replace(",", "."))) };
  }
  return { ok: false, rtt: null };
}

export async function nativePing(
  ip: string,
): Promise<{ reachable: boolean; rtt: number | null } | null> {
  const runtime = getRuntime();
  try {
    if (runtime === "electron" && window.nethub?.ping) {
      const result = await window.nethub.ping(ip);
      return { reachable: result.ok, rtt: result.rtt };
    }
    if (runtime === "tauri") {
      const shell = await optionalImport("@tauri-apps/plugin-shell");
      const isWindows = navigator.userAgent.includes("Windows");
      const args = isWindows ? ["-n", "1", "-w", "1000", ip] : ["-c", "1", "-W", "1", ip];
      const output = await shell.Command.create("ping", args).execute();
      const parsed = parsePingOutput(`${output.stdout}\n${output.stderr}`);
      return { reachable: parsed.ok, rtt: parsed.rtt };
    }
  } catch {
    return null;
  }
  return null;
}

export async function nativeWol(mac: string): Promise<boolean> {
  const runtime = getRuntime();
  try {
    if (runtime === "electron" && window.nethub?.wol) {
      return await window.nethub.wol(mac);
    }
    if (runtime === "tauri") {
      // Requiere el agente o un comando del sistema; en Tauri usamos PowerShell.
      const shell = await optionalImport("@tauri-apps/plugin-shell");
      const clean = mac.replace(/[^0-9a-fA-F]/g, "");
      const script = `$m=[byte[]]::new(6);for($i=0;$i -lt 6;$i++){$m[$i]=[Convert]::ToByte('${clean}'.Substring($i*2,2),16)};$p=,[byte]0xFF*6;for($i=0;$i -lt 16;$i++){$p+=$m};$u=New-Object System.Net.Sockets.UdpClient;$u.EnableBroadcast=$true;$u.Connect(([System.Net.IPAddress]::Broadcast),9);$u.Send($p,$p.Length)|Out-Null;$u.Close()`;
      await shell.Command.create("powershell", ["-NoProfile", "-Command", script]).execute();
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

/* ------------------------------------------------------------------ */
/* Tráfico de red en vivo                                              */
/* ------------------------------------------------------------------ */

const AGENT_TRAFFIC_URL = "http://localhost:8765/traffic";

function toSample(value: unknown): TrafficSample | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const rx = Number(raw["rxMbps"]);
  const tx = Number(raw["txMbps"]);
  if (!Number.isFinite(rx) || !Number.isFinite(tx)) return null;
  return { rxMbps: Math.max(0, rx), txMbps: Math.max(0, tx), totalMbps: rx + tx };
}

/** Simulación suave para el navegador: varía a partir de la muestra anterior. */
function simulateTraffic(previous?: TrafficSample): TrafficSample {
  const drift = (base: number, spread: number) => {
    const next = base + (Math.random() - 0.45) * spread;
    return Math.max(0.2, Math.min(600, next));
  };
  const rx = drift(previous?.rxMbps || 24, 18);
  const tx = drift(previous?.txMbps || 6, 5);
  return { rxMbps: rx, txMbps: tx, totalMbps: rx + tx };
}

/**
 * Lee el tráfico actual: proceso nativo → agente local → simulación.
 * Nunca lanza: siempre devuelve una muestra para que la gráfica avance.
 */
export async function readLiveTraffic(previous?: TrafficSample): Promise<TrafficSample> {
  try {
    if (window.nethub?.traffic) {
      const sample = toSample(await window.nethub.traffic());
      if (sample) return sample;
    }
  } catch {
    /* seguimos con el agente */
  }
  try {
    const response = await fetch(AGENT_TRAFFIC_URL, {
      signal: AbortSignal.timeout(900),
    });
    if (response.ok) {
      const sample = toSample(await response.json());
      if (sample) return sample;
    }
  } catch {
    /* sin agente: simulamos */
  }
  return simulateTraffic(previous);
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
