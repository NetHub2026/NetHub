import type { Device } from "./devices";

export function networkEntries(device: Device): Device[] {
  if (device.networkEntries?.length) return device.networkEntries;
  const { networkEntries: _entries, ...record } = device;
  return [record];
}

export function unifiedDevice(primary: Device, entries: Device[]): Device {
  const current = [...entries].sort((a, b) =>
    Number(b.status === "online") - Number(a.status === "online") ||
    b.lastSeen.localeCompare(a.lastSeen))[0] ?? primary;
  const result: Device = { ...primary, ip: current.ip, mac: current.mac, status: current.status,
    lastSeen: current.lastSeen,
    ...(current.lastOnlineAt ? { lastOnlineAt: current.lastOnlineAt } : {}),
    connectionSource: current.connectionSource,
    tags: [...new Set([...primary.tags.filter(t => !/Wi-Fi|Ethernet/.test(t)), ...current.tags.filter(t => /Wi-Fi|Ethernet/.test(t))])],
    downstream: entries.reduce((n, d) => n + (d.downstream || 0), 0),
    upstream: entries.reduce((n, d) => n + (d.upstream || 0), 0),
    networkEntries: entries };
  if (current.networkId) result.networkId = current.networkId;
  else delete result.networkId;
  return result;
}

export function unifyDevices(devices: Device[], primaryId: string, otherId: string): Device[] {
  const primary = devices.find(d => d.id === primaryId);
  const other = devices.find(d => d.id === otherId);
  if (!primary || !other || primaryId === otherId) return devices;
  const entries = [...new Map([...networkEntries(primary), ...networkEntries(other)].map(d => [d.id, d])).values()];
  return devices.filter(d => d.id !== otherId).map(d => d.id === primaryId ? unifiedDevice(primary, entries) : d);
}

export function separateDevice(devices: Device[], id: string): Device[] {
  return devices.flatMap(d => d.id === id && d.networkEntries?.length ? networkEntries(d) : [d]);
}
