import type { VendorBrand } from "./oui";
import type { ServiceHit } from "./services";

export type DeviceType =
  | "pc"
  | "laptop"
  | "smartphone"
  | "tablet"
  | "tv"
  | "set-top-box"
  | "console"
  | "home-assistant"
  | "router"
  | "nas"
  | "printer"
  | "camera"
  | "smart-plug"
  | "smart-bulb"
  | "led-strip"
  | "speaker"
  | "iot"
  | "other";

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
  /** Controles locales (simulados, listos para enviar al router/API) */
  blocked?: boolean;
  prioritized?: boolean;
  /** Marca detectada por prefijo MAC (base OUI local) */
  brand?: VendorBrand;
  /** ISO de la primera vez que se vio el dispositivo en un escaneo */
  firstSeenAt?: string;
  /** ISO de la última vez que se vio online */
  lastOnlineAt?: string;
  /** Detectado por primera vez en el último escaneo */
  isNew?: boolean;
  /** Marcado manualmente como conocido / confiable */
  trusted?: boolean;
  /** Servicios detectados en el último sondeo de puertos */
  services?: ServiceHit[];
  servicesScannedAt?: string;
  /** El usuario ha editado manualmente nombre, tipo o fabricante */
  manualEdit?: boolean;
  /** Red / router al que pertenece (asignada a mano; si falta se deduce por subred) */
  networkId?: string;
  /** Últimas medidas de latencia (ms), la más reciente al final */
  latency?: Array<{ rtt: number | null; at: string }>;
  /** Persona a la que pertenece el dispositivo (opcional) */
  person?: string;
  /** Ubicación / habitación donde está el dispositivo (opcional) */
  location?: string;
}

export const deviceTypeLabels: Record<DeviceType, string> = {
  pc: "PC de sobremesa",
  laptop: "Portátil",
  smartphone: "Smartphone",
  tablet: "Tablet",
  tv: "Smart TV",
  "set-top-box": "Decodificador / TV Box",
  console: "Consola",
  "home-assistant": "Domótica / Home Assistant",
  router: "Router / Red",
  nas: "NAS / Servidor",
  printer: "Impresora",
  camera: "Cámara IP",
  "smart-plug": "Enchufe inteligente",
  "smart-bulb": "Bombilla inteligente",
  "led-strip": "Tira LED inteligente",
  speaker: "Altavoz inteligente",
  iot: "IoT / Otros conectados",
  other: "Otro",
};

/** Tipos antiguos guardados en la base local y su equivalente actual. */
const legacyTypes: Record<string, DeviceType> = {
  phone: "smartphone",
  mobile: "smartphone",
  plug: "smart-plug",
  bulb: "smart-bulb",
};

/** Convierte cualquier tipo guardado (incluido uno antiguo) en un tipo válido. */
export function normalizeDeviceType(value: unknown): DeviceType {
  const raw = String(value ?? "").trim();
  if (raw in deviceTypeLabels) return raw as DeviceType;
  return legacyTypes[raw] ?? "other";
}
