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
  if (isDesktop()) {
    await writeDbFile({
      devices: lastDevices,
      people: lastDirectory.people,
      locations: lastDirectory.locations,
      events: lastEvents,
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
