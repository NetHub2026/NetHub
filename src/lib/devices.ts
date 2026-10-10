import type { VendorBrand } from "./oui";
import type { ServiceHit } from "./services";

export type DeviceType = keyof typeof deviceTypeLabels;

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
  /** Provenance recorded only when this field is explicitly edited; absent in legacy data. */
  identityManual?: { type?: boolean; vendor?: boolean };
  /** Red / router al que pertenece (asignada a mano; si falta se deduce por subred) */
  networkId?: string;
  /** Últimas medidas de latencia (ms), la más reciente al final */
  latency?: Array<{ rtt: number | null; at: string }>;
  /** Persona a la que pertenece el dispositivo (opcional) */
  person?: string;
  /** Ubicación / habitación donde está el dispositivo (opcional) */
  location?: string;
}

export const deviceTypeLabels = {
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
  "streaming-dongle": "Dongle de streaming",
  "media-player": "Reproductor multimedia",
  projector: "Proyector",
  "audio-player": "Reproductor de audio",
  amplifier: "Amplificador / receptor AV",
  radio: "Radio conectada",
  "photo-frame": "Marco de fotos digital",
  "photo-camera": "Cámara de fotos",
  "ip-phone": "Teléfono IP",
  "barcode-scanner": "Lector de códigos de barras",
  scanner: "Escáner de documentos",
  smartwatch: "Reloj inteligente",
  clock: "Reloj conectado",
  sensor: "Sensor",
  doorbell: "Timbre inteligente",
  "smart-appliance": "Electrodoméstico inteligente",
  "smart-fridge": "Frigorífico inteligente",
  "smart-washer": "Lavadora inteligente",
  "robot-vacuum": "Robot aspirador",
  thermostat: "Termostato",
  "air-conditioner": "Aire acondicionado",
  "touch-panel": "Panel táctil",
  controller: "Controlador domótico",
  "weather-station": "Estación meteorológica",
  "solar-panel": "Panel solar / inversor",
  "smart-lock": "Cerradura inteligente",
  "baby-monitor": "Vigilabebés",
  "garage-door": "Puerta de garaje",
  "voice-assistant": "Asistente de voz",
  robot: "Robot conectado",
  switch: "Switch de red",
  "access-point": "Punto de acceso Wi-Fi",
  "wifi-extender": "Repetidor Wi-Fi",
  "mesh-node": "Nodo Wi-Fi mesh",
  modem: "Módem / ONT",
  firewall: "Firewall",
  vpn: "Servidor / equipo VPN",
  "network-appliance": "Equipo de red",
  ups: "SAI / UPS",
  server: "Servidor",
  "web-server": "Servidor web",
  "mail-server": "Servidor de correo",
  "proxy-server": "Servidor proxy",
  "file-server": "Servidor de archivos",
  "virtual-machine": "Máquina virtual",
  "cloud-device": "Equipo / servicio en la nube",
  "circuit-board": "Placa electrónica",
  arduino: "Arduino / microcontrolador",
  "raspberry-pi": "Raspberry Pi / miniordenador",
  rfid: "Lector / etiqueta RFID",
  "processing-unit": "Unidad de procesamiento",
  car: "Vehículo conectado",
  automotive: "Equipo de automoción",
  industrial: "Equipo industrial",
  medical: "Equipo médico",
  energy: "Equipo de energía",
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
  if (Object.hasOwn(deviceTypeLabels, raw)) return raw as DeviceType;
  return Object.hasOwn(legacyTypes, raw) ? legacyTypes[raw]! : "other";
}
