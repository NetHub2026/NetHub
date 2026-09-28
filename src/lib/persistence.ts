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

async function flush() {
  saveToLocalStorage(lastDevices);
  saveStoredDirectory(lastDirectory);
  saveStoredEvents(lastEvents);
  saveStoredAlerts(lastAlerts);
  saveStoredHealth(lastHealth);
  if (isDesktop()) {
    await writeDbFile({
      devices: lastDevices,
      people: lastDirectory.people,
      locations: lastDirectory.locations,
      events: lastEvents,
      alerts: lastAlerts,
      health: lastHealth,
    });
  }
}

export async function saveDevicesAnywhere(devices: Device[]): Promise<void> {
  lastDevices = sanitizeDevices(devices);
  await flush();
}

export async function saveDirectoryAnywhere(directory: Directory): Promise<void> {
  lastDirectory = sanitizeDirectory(directory);
  await flush();
}
