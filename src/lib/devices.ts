import type { VendorBrand } from "./oui";
import type { ServiceHit } from "./services";

export type DeviceType =
  | "pc"
  | "phone"
  | "tv"
  | "console"
  | "home-assistant"
  | "router"
  | "printer"
  | "camera"
  | "iot"
  | "speaker"
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
}

export const deviceTypeLabels: Record<DeviceType, string> = {
  pc: "PC / Portátil",
  phone: "Smartphone / Tablet",
  tv: "Smart TV",
  console: "Consola",
  "home-assistant": "Domótica / Home Assistant",
  router: "Router / Red",
  printer: "Impresora",
  camera: "Cámara IP",
  iot: "IoT / Enchufe",
  speaker: "Altavoz inteligente",
  other: "Otro",
};

/** Serie horaria simulada de ancho de banda total (Mbps). */

/** Serie horaria simulada de ancho de banda total (Mbps). */
