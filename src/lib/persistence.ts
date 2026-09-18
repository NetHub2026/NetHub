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

/**
 * Persistencia unificada: en escritorio guarda en `devices-db.json` dentro del
 * directorio de datos de la app (inventario + personas + ubicaciones) y mantiene
 * una copia en localStorage; en web usa solo localStorage.
 */

/** Último estado conocido, para poder reescribir el archivo completo. */
let lastDevices: Device[] = [];
let lastDirectory: Directory = emptyDirectory;

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
  if (isDesktop()) {
    await writeDbFile({
      devices: lastDevices,
      people: lastDirectory.people,
      locations: lastDirectory.locations,
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
