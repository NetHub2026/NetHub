import type { Device } from "./devices";
import { loadStoredDevices, saveDevices as saveToLocalStorage } from "./scanner";
import { isDesktop, readDevicesFile, writeDevicesFile } from "./desktop";

/**
 * Persistencia unificada: en escritorio guarda en `devices-db.json` dentro del
 * directorio de datos de la app y mantiene una copia en localStorage; en web
 * usa solo localStorage.
 */
export async function loadDevicesAnywhere(): Promise<Device[] | null> {
  if (isDesktop()) {
    const fromFile = await readDevicesFile();
    if (fromFile && fromFile.length > 0) return fromFile;
  }
  return loadStoredDevices();
}

export async function saveDevicesAnywhere(devices: Device[]): Promise<void> {
  saveToLocalStorage(devices);
  if (isDesktop()) await writeDevicesFile(devices);
}
