import type { Device } from "./devices";

export interface NetworkDef {
  id: string;
  name: string;
  hint: string;
}

export const ALL_NETWORKS = "all";
export const UNKNOWN_NETWORK = "unknown";

/** Devuelve el identificador de subred /24 de una IPv4 (p. ej. "192.168.1"). */
export function subnetIdOf(ip: string): string | null {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip.trim());
  if (!match) return null;
  const parts = match.slice(1, 5).map((n) => Number(n));
  if (parts.some((n) => n < 0 || n > 255)) return null;
  return parts.slice(0, 3).join(".");
}

/** Compatibilidad: la red deducida automáticamente a partir de la IP. */
export function detectNetworkId(ip: string): string | null {
  return subnetIdOf(ip);
}

/** Red efectiva: la asignada a mano o, si no hay, la deducida por subred. */
export function networkOf(device: Device): string | null {
  return device.networkId ?? subnetIdOf(device.ip);
}

export function networkName(id: string | null): string {
  if (!id || id === UNKNOWN_NETWORK) return "Sin clasificar";
  if (id === ALL_NETWORKS) return "Todas las redes";
  return `${id}.x`;
}

/**
 * Detecta dinámicamente las subredes presentes en el inventario, ordenadas por
 * número de equipos. No hay redes ni routers predefinidos.
 */
export function detectNetworks(devices: Device[]): NetworkDef[] {
  const counts = new Map<string, number>();
  for (const device of devices) {
    const id = networkOf(device);
    if (!id || id === UNKNOWN_NETWORK) continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([id]) => ({
      id,
      name: `${id}.x`,
      hint: `subred ${id}.0/24`,
    }));
}

export function countByNetwork(devices: Device[]): Record<string, number> {
  const counts: Record<string, number> = {
    [ALL_NETWORKS]: devices.length,
    [UNKNOWN_NETWORK]: 0,
  };
  for (const device of devices) {
    const id = networkOf(device) ?? UNKNOWN_NETWORK;
    counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
}
