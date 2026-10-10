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
  listBackups?: () => Promise<import("../components/network/BackupManager").BackupEntry[]>;
  readBackup?: (id: string) => Promise<unknown>;
  restoreBackup?: (id: string) => Promise<{ ok: boolean }>;
  internetProvider?: () => Promise<unknown>;
  readDevices?: () => Promise<string | null>;
  writeDevices?: (json: string) => Promise<boolean | void>;
  scanNetwork?: () => Promise<unknown>;
  dbPath?: () => Promise<string>;
  ping?: (ip: string) => Promise<{ ok: boolean; rtt: number | null }>;
  dnsCheck?: (gatewayIp: string, domain: string) => Promise<Record<string, unknown>>;
  scanPorts?: (
    ip: string,
    ports: number[],
    timeout?: number,
  ) => Promise<Array<{ port: number; open: boolean; rtt: number | null }>>;
  wol?: (mac: string) => Promise<boolean>;
  traffic?: () => Promise<TrafficSample>;
  checkUpdate?: () => Promise<UpdateInfo>;
  installUpdate?: (onProgress: (p: UpdateProgress) => void) => Promise<InstallResult>;
  onScanNow?: (callback: () => void) => () => void;
  applySettings?: (settings: unknown) => Promise<{ ok: boolean }>;
  readSettings?: () => Promise<string | null>;
  writeSettings?: (json: string) => Promise<{ ok: boolean; path?: string; error?: string }>;
  openDataFolder?: () => Promise<{ ok: boolean; path?: string; error?: string }>;
  notify?: (payload: { title: string; body: string }) => Promise<{ ok: boolean }>;
  backupDb?: () => Promise<{ ok: boolean; path?: string; error?: string }>;
  openExternal?: (url: string) => Promise<{ ok: boolean; error?: string }>;
}

export async function readInternetProvider(): Promise<unknown> {
  try {
    if (typeof window !== "undefined" && window.nethub?.internetProvider) return await window.nethub.internetProvider();
    const response = await fetch("https://ipwho.is/?fields=success,ip,connection,city,region,country,timezone.id", { signal: AbortSignal.timeout(8000), credentials: "omit", referrerPolicy: "no-referrer" });
    return response.ok ? await response.json() : null;
  } catch { return null; }
}

/** Aplica al sistema las preferencias nativas (autoinicio, cierre, bandeja). */
export async function applyNativeSettings(settings: {
  startWithWindows: boolean;
  startMinimized: boolean;
  closeAction: "tray" | "quit";
  minimizeToTray: boolean;
  wolPort: number;
  wolBroadcast: string;
}): Promise<boolean> {
  try {
    if (typeof window !== "undefined" && window.nethub?.applySettings) {
      const result = await window.nethub.applySettings(settings);
      return Boolean(result?.ok);
    }
  } catch {
    return false;
  }
  return false;
}

/** Abre un panel web del dispositivo en el navegador predeterminado. */
export async function openExternalUrl(url: string): Promise<boolean> {
  try {
    if (typeof window !== "undefined" && window.nethub?.openExternal) {
      const result = await window.nethub.openExternal(url);
      return Boolean(result?.ok);
    }
    if (typeof window !== "undefined") {
      window.open(url, "_blank", "noopener,noreferrer");
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

/** Nombre del archivo de preferencias, junto al ejecutable. */
export const SETTINGS_FILE = "settings.json";

/** Lee settings.json del disco (escritorio). Devuelve null en web o si no existe. */
export async function readSettingsFile(): Promise<unknown | null> {
  try {
    const runtime = getRuntime();
    let raw: string | null = null;
    if (runtime === "electron" && window.nethub?.readSettings) {
      raw = (await window.nethub.readSettings()) ?? null;
    } else if (runtime === "tauri") {
      const fs = await optionalImport("@tauri-apps/plugin-fs");
      const exists = await fs.exists(SETTINGS_FILE, { baseDir: fs.BaseDirectory.AppData });
      raw = exists
        ? ((await fs.readTextFile(SETTINGS_FILE, { baseDir: fs.BaseDirectory.AppData })) as string)
        : null;
    }
    if (!raw) return null;
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

/** Guarda settings.json junto al ejecutable, creándolo si no existe. */
export async function writeSettingsFile(settings: unknown): Promise<boolean> {
  const json = JSON.stringify(
    { app: "NetHub", savedAt: new Date().toISOString(), settings },
    null,
    2,
  );
  try {
    const runtime = getRuntime();
    if (runtime === "electron" && window.nethub?.writeSettings) {
      const result = await window.nethub.writeSettings(json);
      return Boolean(result?.ok);
    }
    if (runtime === "tauri") {
      const fs = await optionalImport("@tauri-apps/plugin-fs");
      await fs.writeTextFile(SETTINGS_FILE, json, { baseDir: fs.BaseDirectory.AppData });
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

/** Abre en el Explorador la carpeta donde viven devices-db.json y settings.json. */
export async function openDataFolder(): Promise<{ ok: boolean; path?: string; error?: string }> {
  if (typeof window !== "undefined" && window.nethub?.openDataFolder) {
    return window.nethub.openDataFolder();
  }
  return { ok: false, error: "Solo disponible en la app de escritorio de NetHub." };
}

/** Copia de seguridad manual de devices-db.json junto al ejecutable. */
export async function backupDataFile(): Promise<{ ok: boolean; path?: string; error?: string }> {
  if (typeof window !== "undefined" && window.nethub?.backupDb) {
    return window.nethub.backupDb();
  }
  return { ok: false, error: "Solo disponible en la app de escritorio de NetHub." };
}

/** Notificación nativa de Windows (si la app corre en escritorio). */
export async function notifyNative(title: string, body: string): Promise<boolean> {
  try {
    if (typeof window !== "undefined" && window.nethub?.notify) {
      const result = await window.nethub.notify({ title, body });
      return Boolean(result?.ok);
    }
  } catch {
    return false;
  }
  return false;
}

/** Escucha la orden «Escanear ahora» del icono de la bandeja del sistema. */
export function onDesktopScanRequest(callback: () => void): () => void {
  if (typeof window === "undefined" || !window.nethub?.onScanNow) return () => {};
  return window.nethub.onScanNow(callback);
}

/** Muestra instantánea de tráfico de red en Mbps. */
export interface TrafficSample {
  rxMbps: number;
  txMbps: number;
  totalMbps: number;
  available?: boolean;
  at?: number;
}

/** Versión de NetHub que se muestra en la interfaz (coincide con package.json). */
export const APP_VERSION = "1.4.22";

/** Repositorio oficial; el antiguo solo como respaldo (GitHub redirige el repo transferido). */
const GITHUB_REPOS = ["NetHub2026/NetHub", "oyogor1985/nethub"];


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
      const attempt = await fetch(`https://api.github.com/repos/${repo}/releases?per_page=50`);
      if (attempt.ok) {
        response = attempt;
        break;
      }
      response = attempt;
    }
    if (!response || !response.ok) {
      return { ...base, error: `GitHub respondió ${response?.status ?? "sin respuesta"}` };
    }
    type Release = {
      tag_name?: string;
      body?: string;
      draft?: boolean;
      prerelease?: boolean;
      published_at?: string;
      assets?: Array<{ name?: string; browser_download_url?: string; size?: number }>;
    };
    // Solo releases con tag semver estricto (vX.Y.Z) y asset NetHub.exe; se ignoran tags tipo "v15".
    const findAsset = (r: Release) => (r.assets || []).find((a) => a.name === "NetHub.exe");
    const list = ((await response.json()) as Release[]).filter(
      (r) => !r.draft && !r.prerelease && /^v\d+\.\d+\.\d+$/.test(r.tag_name || "") && findAsset(r),
    );
    list.sort((a, b) => compareVersions(b.tag_name || "", a.tag_name || ""));
    const release: Release = list[0] ?? {};
    const latest = release.tag_name ? normalizeVersion(release.tag_name) : "";
    const asset = release.tag_name ? findAsset(release) : undefined;
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
  /** Historial de actividad (máx. 300 eventos) */
  events?: unknown[];
  /** Alertas del guardián Sentinel */
  alerts?: unknown[];
  /** Historial del Health Radar */
  health?: unknown[];
  /** Estadísticas de uso por equipo */
  usage?: unknown;
  /** Estado del Modo Ausente */
  away?: unknown;
  /** Historial del SLA del operador */
  sla?: unknown[];
  /** Rutinas aprendidas y anomalías */
  patterns?: unknown;
  speedHistory?: unknown[];
  speedHistoryLimit?: number;
  speedHistoryUnified?: boolean;
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
      events: Array.isArray(obj.events) ? obj.events : [],
      alerts: Array.isArray(obj.alerts) ? obj.alerts : [],
      health: Array.isArray(obj.health) ? obj.health : [],
      usage: obj.usage ?? null,
      away: obj.away ?? null,
      sla: Array.isArray(obj.sla) ? obj.sla : [],
      patterns: obj.patterns ?? null,
      speedHistoryUnified: obj.speedHistoryUnified === true,
      ...(Array.isArray(obj.speedHistory) ? { speedHistory: obj.speedHistory } : {}),
      ...(typeof obj.speedHistoryLimit === "number" ? { speedHistoryLimit: obj.speedHistoryLimit } : {}),
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
      return (await window.nethub.writeDevices(json)) !== false;
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

/* ------------------------------------------------------------------ */
/* Comprobación de integridad del DNS (solo escritorio)                 */
/* ------------------------------------------------------------------ */

export interface DnsCheckResult {
  available: boolean;
  ok: boolean;
  /** IP consultada como DNS local (el router) */
  gateway: string | null;
  /** Respuestas del DNS local */
  gatewayIps: string[];
  /** Respuestas del DNS público (8.8.8.8) */
  publicIps: string[];
  hijacked: boolean;
  gatewayRtt: number | null;
  domain: string;
  error?: string | undefined;
}

/**
 * Compara la respuesta DNS del router con la de 8.8.8.8 para un dominio
 * conocido: si difieren, alguien está manipulando el DNS de la red.
 */
export async function checkDns(
  gatewayIp: string | null,
  domain = "www.google.com",
): Promise<DnsCheckResult> {
  if (typeof window === "undefined" || !window.nethub?.dnsCheck) {
    return {
      available: false,
      ok: false,
      gateway: gatewayIp,
      gatewayIps: [],
      publicIps: [],
      hijacked: false,
      gatewayRtt: null,
      domain,
      error:
        "La comprobación de DNS se hace desde la app de escritorio (NetHub.exe). En el navegador no se puede consultar al router.",
    };
  }
  try {
    const raw = await window.nethub.dnsCheck(gatewayIp ?? "", domain);
    return {
      available: true,
      ok: Boolean(raw["ok"]),
      gateway: (raw["gateway"] as string) ?? gatewayIp,
      gatewayIps: Array.isArray(raw["gatewayIps"]) ? (raw["gatewayIps"] as string[]) : [],
      publicIps: Array.isArray(raw["publicIps"]) ? (raw["publicIps"] as string[]) : [],
      hijacked: Boolean(raw["hijacked"]),
      gatewayRtt: typeof raw["gatewayRtt"] === "number" ? raw["gatewayRtt"] : null,
      domain: (raw["domain"] as string) ?? domain,
      error: typeof raw["error"] === "string" ? raw["error"] : undefined,
    };
  } catch (error) {
    return {
      available: true,
      ok: false,
      gateway: gatewayIp,
      gatewayIps: [],
      publicIps: [],
      hijacked: false,
      gatewayRtt: null,
      domain,
      error: String(error),
    };
  }
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
  return { rxMbps: Math.max(0, rx), txMbps: Math.max(0, tx), totalMbps: Math.max(0, rx) + Math.max(0, tx), available: raw["available"] !== false, at: Date.now() };
}

/** Reads real native/agent traffic; unavailable readings never become simulated values. */
export async function readLiveTraffic(): Promise<TrafficSample> {
  if (typeof window !== "undefined" && window.nethub?.traffic) {
    try { return toSample(await window.nethub.traffic()) ?? unavailableTraffic(); }
    catch { return unavailableTraffic(); }
  }
  try {
    const response = await fetch(AGENT_TRAFFIC_URL, { signal: AbortSignal.timeout(900) });
    if (response.ok) return toSample(await response.json()) ?? unavailableTraffic();
  } catch { /* no real source available */ }
  return unavailableTraffic();
}
function unavailableTraffic(): TrafficSample {
  return { rxMbps: 0, txMbps: 0, totalMbps: 0, available: false, at: Date.now() };
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

/** Escaneo TCP nativo (Electron). Devuelve null si no está disponible. */
export async function nativeScanPorts(
  ip: string,
  ports: number[],
  timeout = 900,
): Promise<Array<{ port: number; open: boolean; rtt: number | null }> | null> {
  if (typeof window === "undefined" || !window.nethub?.scanPorts) return null;
  try {
    return await window.nethub.scanPorts(ip, ports, timeout);
  } catch {
    return null;
  }
}

export const desktopBackups: import("../components/network/BackupManager").BackupAdapter = {
  async list() { return window.nethub?.listBackups ? window.nethub.listBackups() : []; },
  async create() { const result = await backupDataFile(); if (!result.ok) throw new Error(result.error ?? "No se pudo crear la copia."); },
  async read(id) { if (!window.nethub?.readBackup) throw new Error("Disponible en la aplicación Windows."); return window.nethub.readBackup(id); },
  async restore(id) {
    if (!window.nethub?.restoreBackup) throw new Error("Disponible en la aplicación Windows.");
    await window.nethub.restoreBackup(id);
    for (const key of ["nethub.devices.v1", "nethub.activity.v1", "nethub.sentinel.v1", "nethub.health.v1", "nethub.usage.v1", "nethub.away.v1", "nethub.patterns.v1", "nethub.sla.v1", "nethub.directory.v1", "nethub.scan-meta.v1", "nethub.speedtest.v1", "nethub.speedtest.limit", "nethub.speedtest.unified"]) {
      try { window.localStorage.removeItem(key); } catch {}
    }
    window.location.reload();
  },
};
