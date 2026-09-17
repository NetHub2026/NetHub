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
export const devices: Device[] = [
  {
    id: "d1",
    name: "Workstation Gorka",
    type: "pc",
    ip: "192.168.1.20",
    mac: "A4:5E:60:D1:07:9B",
    status: "online",
    vendor: "ASUSTek",
    lastSeen: "Ahora mismo",
    downstream: 128.4,
    upstream: 22.1,
    tags: ["Trabajo", "Cableado"],
    notes: "Equipo principal con IP fija reservada en el router.",
  },
  {
    id: "d2",
    name: "MacBook Air",
    type: "pc",
    ip: "192.168.1.24",
    mac: "F0:18:98:2C:41:AA",
    status: "online",
    vendor: "Apple",
    lastSeen: "Hace 2 min",
    downstream: 34.7,
    upstream: 9.4,
    tags: ["Wi-Fi 6"],
  },
  {
    id: "d3",
    name: "PlayStation 5",
    type: "console",
    ip: "192.168.1.31",
    mac: "78:C8:81:0F:3D:12",
    status: "online",
    vendor: "Sony Interactive",
    lastSeen: "Hace 1 min",
    downstream: 212.9,
    upstream: 14.8,
    tags: ["Salón", "Prioridad alta"],
    notes: "Descargando actualización de juego.",
  },
  {
    id: "d4",
    name: "Nintendo Switch",
    type: "console",
    ip: "192.168.1.33",
    mac: "98:B6:E9:7A:55:C4",
    status: "offline",
    vendor: "Nintendo",
    lastSeen: "Hace 3 días",
    downstream: 0,
    upstream: 0,
    tags: ["Portátil"],
  },
  {
    id: "d5",
    name: "LG OLED Salón",
    type: "tv",
    ip: "192.168.1.40",
    mac: "3C:CD:93:11:88:0E",
    status: "online",
    vendor: "LG Electronics",
    lastSeen: "Hace 5 min",
    downstream: 88.2,
    upstream: 3.1,
    tags: ["Salón", "Streaming"],
  },
  {
    id: "d6",
    name: "Samsung TV Dormitorio",
    type: "tv",
    ip: "192.168.1.41",
    mac: "8C:79:F5:64:2B:D9",
    status: "offline",
    vendor: "Samsung",
    lastSeen: "Ayer, 23:40",
    downstream: 0,
    upstream: 0,
    tags: ["Dormitorio"],
  },
  {
    id: "d7",
    name: "Home Assistant Green",
    type: "home-assistant",
    ip: "192.168.1.10",
    mac: "DC:A6:32:9E:41:77",
    status: "online",
    vendor: "Nabu Casa",
    lastSeen: "Ahora mismo",
    downstream: 6.4,
    upstream: 2.8,
    tags: ["Servidor", "24/7", "Prioridad alta"],
    notes: "Orquesta 34 entidades y automatizaciones de iluminación.",
  },
  {
    id: "d8",
    name: "Enchufe Shelly Cocina",
    type: "iot",
    ip: "192.168.1.52",
    mac: "B8:27:EB:53:AC:20",
    status: "online",
    vendor: "Shelly",
    lastSeen: "Hace 30 s",
    downstream: 0.2,
    upstream: 0.1,
    tags: ["Cocina", "Energía"],
  },
  {
    id: "d9",
    name: "Cámara Entrada",
    type: "iot",
    ip: "192.168.1.55",
    mac: "44:65:0D:8B:12:F3",
    status: "online",
    vendor: "Reolink",
    lastSeen: "Ahora mismo",
    downstream: 18.9,
    upstream: 24.6,
    tags: ["Seguridad", "VLAN IoT"],
    notes: "Aislada en la VLAN de IoT, sin acceso a la red principal.",
  },
  {
    id: "d10",
    name: "Termostato Salón",
    type: "iot",
    ip: "192.168.1.57",
    mac: "50:02:91:A4:6E:11",
    status: "offline",
    vendor: "Tado",
    lastSeen: "Hace 6 h",
    downstream: 0,
    upstream: 0,
    tags: ["Clima"],
  },
  {
    id: "d11",
    name: "Sensor Puerta Garaje",
    type: "iot",
    ip: "192.168.1.61",
    mac: "E0:98:06:77:31:5C",
    status: "online",
    vendor: "Aqara",
    lastSeen: "Hace 12 min",
    downstream: 0.1,
    upstream: 0.1,
    tags: ["Zigbee"],
  },
  {
    id: "d12",
    name: "Steam Deck",
    type: "console",
    ip: "192.168.1.36",
    mac: "1C:BF:CE:4D:90:82",
    status: "online",
    vendor: "Valve",
    lastSeen: "Hace 8 min",
    downstream: 46.3,
    upstream: 5.2,
    tags: ["Portátil", "Juegos"],
  },
];

/** Serie horaria simulada de ancho de banda total (Mbps). */
export const bandwidthSeries = [
  32, 41, 28, 22, 18, 15, 24, 58, 96, 120, 142, 118, 96, 134, 168, 190, 240, 288, 322,
  356, 402, 368, 254, 148,
];
