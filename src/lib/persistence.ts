import type { Device } from "./devices";
import { loadStoredDevices, sanitizeDevices, saveDevices as saveToLocalStorage } from "./scanner";
import { isDesktop, readDbFile, writeDbFile } from "./desktop";
import {
  directoryFromDevices,
  emptyDirectory,
  loadStoredDirectory,
  sanitizeDirectory,
  saveStoredDirectory,
  type Directory,
} from "./directory";
import { loadStoredAlerts, saveStoredAlerts, sanitizeAlerts, type SentinelAlert } from "./sentinel";
import { loadStoredHealth, saveStoredHealth, sanitizeHealth, type HealthSample } from "./health";
import { loadStoredEvents, saveStoredEvents, sanitizeEvents, type ActivityEvent } from "./activity";
import {
  emptyUsageState,
  loadStoredUsage,
  sanitizeUsage,
  saveStoredUsage,
  type UsageState,
} from "./usage";
import {
  emptyAwayState,
  loadStoredAway,
  sanitizeAway,
  saveStoredAway,
  type AwayState,
} from "./away";
import { loadStoredPatterns, sanitizePatterns, saveStoredPatterns, type PatternState, emptyPatternState } from "./patterns";
import { loadStoredSla, sanitizeSla, saveStoredSla, type SlaSample } from "./sla";
import type { SpeedResult } from "./speedtest";
import { loadStoredSpeedHistory, loadStoredSpeedHistoryLimit, saveStoredSpeedHistory, sanitizeSpeedHistory, speedHistoryLimit, SPEED_HISTORY_CHANGED } from "./speed-history";

/**
 * Persistencia unificada: en escritorio guarda en `devices-db.json` dentro del
 * directorio de datos de la app (inventario + personas + ubicaciones) y mantiene
 * una copia en localStorage; en web usa solo localStorage.
 */

/** Último estado conocido, para poder reescribir el archivo completo. */
let lastDevices: Device[] = [];
let lastDirectory: Directory = emptyDirectory;
let lastEvents: ActivityEvent[] = [];
let lastAlerts: SentinelAlert[] = [];
let lastHealth: HealthSample[] = [];
let lastUsage: UsageState = emptyUsageState();
let lastAway: AwayState = emptyAwayState();
let lastSla: SlaSample[] = [];
let lastPatterns: PatternState = emptyPatternState();
let lastSpeedHistory: SpeedResult[] = [];
let lastSpeedHistoryLimit = 10;
let speedHistoryReady: Promise<void> | null = null;
let speedHistorySaveError: string | null = null;

function ensureSpeedHistory(): Promise<void> {
  return speedHistoryReady ??= (async () => {
    lastSpeedHistory = loadStoredSpeedHistory();
    lastSpeedHistoryLimit = loadStoredSpeedHistoryLimit();
    let legacy = loadStoredSla();
    let unified = false;
    try { unified = window.localStorage.getItem("nethub.speedtest.unified") === "true"; } catch {}
    if (isDesktop()) {
      const payload = await readDbFile();
      legacy = sanitizeSla(payload?.sla ?? legacy);
      if (payload) unified = payload.speedHistoryUnified === true;
      if (payload?.speedHistory !== undefined) lastSpeedHistory = sanitizeSpeedHistory(payload.speedHistory);
      if (payload?.speedHistoryLimit !== undefined) lastSpeedHistoryLimit = speedHistoryLimit(payload.speedHistoryLimit);
    }
    if (!unified) lastSpeedHistory = sanitizeSpeedHistory([...lastSpeedHistory, ...legacy.map(r => ({ ...r, jitter: 0, peakDownload: r.download, peakUpload: r.upload, migratedSla: true }))]);
  })();
}
export async function loadSpeedHistoryAnywhere() {
  await ensureSpeedHistory();
  return { history: [...lastSpeedHistory], limit: lastSpeedHistoryLimit, error: speedHistorySaveError };
}
function notifySpeedHistory() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SPEED_HISTORY_CHANGED));
}
export async function saveSpeedHistoryAnywhere(history: SpeedResult[]): Promise<void> {
  await ensureSpeedHistory();
  lastSpeedHistory = sanitizeSpeedHistory(history);
  await persistSpeedHistory();
}
async function persistSpeedHistory(): Promise<void> {
  const saved = await flush();
  speedHistorySaveError = saved ? null : "El test está en la copia local, pero no se pudo guardar en el JSON. Comprueba que la carpeta de datos permita escribir.";
  notifySpeedHistory();
}
export async function appendSpeedHistoryAnywhere(result: SpeedResult): Promise<void> {
  await ensureSpeedHistory();
  lastSpeedHistory = sanitizeSpeedHistory([result, ...lastSpeedHistory]);
  await persistSpeedHistory();
}
export async function saveSpeedHistoryLimitAnywhere(limit: number): Promise<void> {
  await ensureSpeedHistory();
  lastSpeedHistoryLimit = speedHistoryLimit(limit);
  const saved = await flush();
  speedHistorySaveError = saved ? null : "No se pudo guardar la preferencia del historial en el JSON.";
  notifySpeedHistory();
}

/** Alertas del guardián Sentinel. */
export async function loadAlertsAnywhere(): Promise<SentinelAlert[]> {
  let alerts = loadStoredAlerts();
  if (isDesktop()) {
    const payload = await readDbFile();
    if (payload?.alerts && payload.alerts.length > 0) alerts = sanitizeAlerts(payload.alerts);
  }
  lastAlerts = alerts;
  return alerts;
}

export async function saveAlertsAnywhere(alerts: SentinelAlert[]): Promise<void> {
  lastAlerts = sanitizeAlerts(alerts);
  await flush();
}

/** Historial del Health Radar. */
export async function loadHealthAnywhere(): Promise<HealthSample[]> {
  let samples = loadStoredHealth();
  if (isDesktop()) {
    const payload = await readDbFile();
    if (payload?.health && payload.health.length > 0) samples = sanitizeHealth(payload.health);
  }
  lastHealth = samples;
  return samples;
}

export async function saveHealthAnywhere(samples: HealthSample[]): Promise<void> {
  lastHealth = sanitizeHealth(samples);
  await flush();
}

/** Historial de actividad (archivo local en escritorio, localStorage en web). */
export async function loadEventsAnywhere(): Promise<ActivityEvent[]> {
  let events = loadStoredEvents();
  if (isDesktop()) {
    const payload = await readDbFile();
    if (payload?.events && payload.events.length > 0) events = sanitizeEvents(payload.events);
  }
  lastEvents = events;
  return events;
}

export async function saveEventsAnywhere(events: ActivityEvent[]): Promise<void> {
  lastEvents = sanitizeEvents(events);
  await flush();
}

export async function loadDevicesAnywhere(): Promise<Device[] | null> {
  if (isDesktop()) {
    const payload = await readDbFile();
    if (payload && payload.devices.length > 0) {
      lastDevices = sanitizeDevices(payload.devices);
      return lastDevices;
    }
  }
  const stored = loadStoredDevices();
  if (stored) lastDevices = stored;
  return stored;
}

/** Estadísticas de uso por equipo (archivo local + navegador). */
export async function loadUsageAnywhere(): Promise<UsageState> {
  let usage = loadStoredUsage();
  if (isDesktop()) {
    const payload = await readDbFile();
    if (payload?.usage) usage = sanitizeUsage(payload.usage);
  }
  lastUsage = usage;
  return usage;
}

export async function saveUsageAnywhere(usage: UsageState): Promise<void> {
  lastUsage = sanitizeUsage(usage);
  await flush();
}

/** Estado del Modo Ausente (archivo local + navegador). */
export async function loadAwayAnywhere(): Promise<AwayState> {
  let away = loadStoredAway();
  if (isDesktop()) {
    const payload = await readDbFile();
    if (payload?.away) away = sanitizeAway(payload.away);
  }
  lastAway = away;
  return away;
}

export async function saveAwayAnywhere(away: AwayState): Promise<void> {
  lastAway = sanitizeAway(away);
  await flush();
}

/** Historial del SLA del operador (archivo local + navegador). */
export async function loadSlaAnywhere(): Promise<SlaSample[]> {
  await ensureSpeedHistory();
  return [...lastSpeedHistory].reverse().map(({ at, download, upload, ping }) => ({ at, download, upload, ping }));
}

export async function saveSlaAnywhere(samples: SlaSample[]): Promise<void> {
  await ensureSpeedHistory();
  lastSpeedHistory = sanitizeSpeedHistory(samples.map(r => lastSpeedHistory.find(s => s.at === r.at) ?? { ...r, jitter: 0, peakDownload: r.download, peakUpload: r.upload, migratedSla: true }));
  await persistSpeedHistory();
}

/** Listas de personas y ubicaciones guardadas (archivo local + navegador). */
export async function loadDirectoryAnywhere(devices: Device[] = []): Promise<Directory> {
  let base = loadStoredDirectory();
  if (isDesktop()) {
    const payload = await readDbFile();
    if (payload) {
      base = sanitizeDirectory({
        people: [...base.people, ...payload.people],
        locations: [...base.locations, ...payload.locations],
      });
    }
  }
  lastDirectory = directoryFromDevices(devices, base);
  return lastDirectory;
}

let flushQueue: Promise<unknown> = Promise.resolve();
function flush(): Promise<boolean> {
  const write = flushQueue.then(flushState, flushState);
  flushQueue = write;
  return write;
}
async function flushState(): Promise<boolean> {
  await ensureSpeedHistory();
  saveToLocalStorage(lastDevices);
  saveStoredDirectory(lastDirectory);
  saveStoredEvents(lastEvents);
  saveStoredAlerts(lastAlerts);
  saveStoredHealth(lastHealth);
  saveStoredUsage(lastUsage);
  saveStoredAway(lastAway);
  lastSla = await loadSlaAnywhere();
  saveStoredSla(lastSla);
  try { window.localStorage.setItem("nethub.speedtest.unified", "true"); } catch {}
  saveStoredPatterns(lastPatterns);
  saveStoredSpeedHistory(lastSpeedHistory, lastSpeedHistoryLimit);
  if (isDesktop()) {
    return await writeDbFile({
      devices: lastDevices,
      people: lastDirectory.people,
      locations: lastDirectory.locations,
      events: lastEvents,
      alerts: lastAlerts,
      health: lastHealth,
      usage: lastUsage,
      away: lastAway,
      sla: lastSla,
      patterns: lastPatterns,
      speedHistory: lastSpeedHistory,
      speedHistoryLimit: lastSpeedHistoryLimit,
      speedHistoryUnified: true,
    });
  }
  return true;
}

export async function saveDevicesAnywhere(devices: Device[]): Promise<void> {
  lastDevices = sanitizeDevices(devices);
  await flush();
}

export async function saveDirectoryAnywhere(directory: Directory): Promise<void> {
  lastDirectory = sanitizeDirectory(directory);
  await flush();
}

/** Rutinas aprendidas y anomalías (archivo local + navegador). */
export async function loadPatternsAnywhere(): Promise<PatternState> {
  let st = loadStoredPatterns();
  if (isDesktop()) {
    const payload = await readDbFile();
    if (payload?.patterns) st = sanitizePatterns(payload.patterns);
  }
  lastPatterns = st;
  return st;
}

export async function savePatternsAnywhere(state: PatternState): Promise<void> {
  lastPatterns = sanitizePatterns(state);
  await flush();
}
