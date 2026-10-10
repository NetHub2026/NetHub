import type { Device } from "./devices";
export const CONNECTION_TAGS = ["Cableado / Ethernet", "Wi-Fi", "Wi-Fi 2.4GHz", "Wi-Fi 5GHz", "Wi-Fi 6GHz", "Wi-Fi 6"];
export function connectionOf(device: Pick<Device, "tags" | "connectionSource">): "wifi" | "wired" | null {
  if (!device.connectionSource) return null;
  const wired = device.tags.includes("Cableado / Ethernet");
  const wifi = device.tags.some(t => CONNECTION_TAGS.includes(t) && t !== "Cableado / Ethernet");
  return wired === wifi ? null : wired ? "wired" : "wifi";
}
export function wifiBand(device: Pick<Device, "tags" | "connectionSource">): "2.4" | "5" | "6" | null {
  if (connectionOf(device) !== "wifi") return null;
  const bands = (["2.4", "5", "6"] as const).filter(b => device.tags.includes(`Wi-Fi ${b}GHz`));
  return bands.length === 1 ? bands[0]! : null;
}
export function connectionSummary(devices: Device[]) {
  const active = devices.filter(d => d.status === "online");
  const wifi = active.filter(d => connectionOf(d) === "wifi");
  const wired = active.filter(d => connectionOf(d) === "wired").length;
  return { active: active.length, inactive: devices.length - active.length, wired, wifi: wifi.length, unknown: active.length - wired - wifi.length,
    bands: { "2.4": wifi.filter(d => wifiBand(d) === "2.4").length, "5": wifi.filter(d => wifiBand(d) === "5").length, "6": wifi.filter(d => wifiBand(d) === "6").length },
    bandUnknown: wifi.filter(d => !wifiBand(d)).length };
}
