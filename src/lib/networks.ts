import type { Device } from "./devices";

export interface NetworkDef {
  id: string;
  name: string;
  hint: string;
  /** Prefijos de IP que pertenecen a esta red. */
  subnets: string[];
}

export const ALL_NETWORKS = "all";

export const networks: NetworkDef[] = [];

export function detectNetworkId(ip: string): string | null {
  for (const net of networks) {
    if (net.subnets.some((prefix) => ip.startsWith(prefix))) return net.id;
  }
  return null;
}

/** Red efectiva: la asignada a mano o, si no hay, la deducida por subred. */
export function networkOf(device: Device): string | null {
  return device.networkId ?? detectNetworkId(device.ip);
}

export function networkName(id: string | null): string {
  if (!id) return "Sin clasificar";
  return networks.find((n) => n.id === id)?.name ?? "Sin clasificar";
}

export function countByNetwork(devices: Device[]): Record<string, number> {
  const counts: Record<string, number> = { [ALL_NETWORKS]: devices.length, unknown: 0 };
  for (const net of networks) counts[net.id] = 0;
  for (const device of devices) {
    const id = networkOf(device) ?? "unknown";
    counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
}
