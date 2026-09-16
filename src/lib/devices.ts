export type DeviceType = "pc" | "console" | "tv" | "home-assistant" | "iot";

export type DeviceStatus = "online" | "offline";

export interface Device {
  id: string;
  name: string;
  type: DeviceType;
  ip: string;
  mac: string;
  status: DeviceStatus;
  vendor: string;
  lastSeen: string;
  /** Mbps actuales (simulado, listo para sustituir por API) */
  downstream: number;
  upstream: number;
  tags: string[];
  notes?: string;
}

export const deviceTypeLabels: Record<DeviceType, string> = {
  pc: "PC / Portátil",
  console: "Consola",
  tv: "Smart TV",
  "home-assistant": "Home Assistant",
  iot: "IoT",
};

/**
 * Datos simulados. Para integrar una API real (router, Home Assistant, etc.)
 * basta con sustituir esta constante por la respuesta del endpoint manteniendo
 * la forma de `Device`.
 */
export const devices: Device[] = [];

/** Serie horaria simulada de ancho de banda total (Mbps). */
export const bandwidthSeries = [
  32, 41, 28, 22, 18, 15, 24, 58, 96, 120, 142, 118, 96, 134, 168, 190, 240, 288, 322,
  356, 402, 368, 254, 148,
];
