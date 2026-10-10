import { deviceTypeLabels, type Device } from "./devices";
import { networkName, networkOf } from "./networks";

export const inventorySortLabels = {
  ip: "Dirección IP",
  name: "Nombre (A–Z)",
  "name-desc": "Nombre (Z–A)",
  active: "Activos primero",
  type: "Tipo de dispositivo",
  recent: "Vistos más recientemente",
};
export const inventoryGroupLabels = {
  none: "Sin agrupar",
  type: "Tipo de dispositivo",
  person: "Persona",
  location: "Ubicación",
  network: "Red",
};
export type InventorySort = keyof typeof inventorySortLabels;
export type InventoryGroup = keyof typeof inventoryGroupLabels;
const compare = (a: string, b: string) =>
  a.localeCompare(b, "es", { numeric: true, sensitivity: "base" });
const time = (value: string) => Date.parse(value) || 0;

export function arrangeInventory(
  devices: Device[],
  order: InventorySort,
  grouping: InventoryGroup,
) {
  const sorted = [...devices].sort((a, b) => {
    const byName = compare(a.name, b.name);
    const primary =
      order === "name"
        ? byName
        : order === "name-desc"
          ? -byName
          : order === "active"
            ? Number(b.status === "online") - Number(a.status === "online")
            : order === "type"
              ? compare(deviceTypeLabels[a.type], deviceTypeLabels[b.type])
              : order === "recent"
                ? time(b.lastOnlineAt ?? b.lastSeen) - time(a.lastOnlineAt ?? a.lastSeen)
                : compare(a.ip, b.ip);
    return primary || byName || compare(a.ip, b.ip) || compare(a.id, b.id);
  });
  if (grouping === "none") return [{ key: "all", label: "", devices: sorted }];
  const groups = new Map<
    string,
    { key: string; label: string; devices: Device[]; missing: boolean }
  >();
  for (const device of sorted) {
    const value =
      grouping === "type"
        ? device.type
        : grouping === "network"
          ? networkOf(device)
          : device[grouping]?.trim();
    const missing = !value || (grouping === "network" && value === "unknown");
    const key = missing ? "missing" : `value:${value!.toLocaleLowerCase("es")}`;
    const label = missing
      ? grouping === "person"
        ? "Sin persona"
        : grouping === "location"
          ? "Sin ubicación"
          : "Sin clasificar"
      : grouping === "type"
        ? deviceTypeLabels[device.type]
        : grouping === "network"
          ? networkName(value!)
          : value!;
    if (!groups.has(key)) groups.set(key, { key, label, devices: [], missing });
    groups.get(key)!.devices.push(device);
  }
  return [...groups.values()].sort(
    (a, b) => Number(a.missing) - Number(b.missing) || compare(a.label, b.label),
  );
}
