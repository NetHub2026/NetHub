import { deviceTypeLabels, type DeviceType } from "./devices";

export const deviceTypeGroups: Array<{ label: string; types: DeviceType[] }> = [
  {
    label: "Ordenadores y móviles",
    types: [
      "pc",
      "laptop",
      "smartphone",
      "tablet",
      "smartwatch",
      "clock",
      "printer",
      "scanner",
      "barcode-scanner",
      "ip-phone",
    ],
  },
  {
    label: "Audio, vídeo y entretenimiento",
    types: [
      "tv",
      "set-top-box",
      "console",
      "streaming-dongle",
      "media-player",
      "projector",
      "speaker",
      "audio-player",
      "amplifier",
      "radio",
      "photo-frame",
      "photo-camera",
    ],
  },
  {
    label: "Hogar y domótica",
    types: [
      "home-assistant",
      "smart-plug",
      "smart-bulb",
      "led-strip",
      "sensor",
      "doorbell",
      "camera",
      "smart-appliance",
      "smart-fridge",
      "smart-washer",
      "robot-vacuum",
      "thermostat",
      "air-conditioner",
      "smart-fan",
      "touch-panel",
      "controller",
      "weather-station",
      "smart-lock",
      "baby-monitor",
      "garage-door",
      "robot",
    ],
  },
  {
    label: "Red y conectividad",
    types: [
      "router",
      "switch",
      "access-point",
      "wifi-extender",
      "mesh-node",
      "modem",
      "firewall",
      "vpn",
      "network-appliance",
      "ups",
    ],
  },
  {
    label: "Almacenamiento y servidores",
    types: [
      "nas",
      "server",
      "virtual-machine",
      "cloud-device",
    ],
  },
  {
    label: "Electrónica y sistemas especializados",
    types: [
      "circuit-board",
      "arduino",
      "raspberry-pi",
      "rfid",
      "solar-panel",
      "car",
      "automotive",
      "industrial",
      "medical",
      "energy",
    ],
  },
  {
    label: "Otros",
    types: ["iot", "other"],
  },
];

const normalizeSearch = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export function searchDeviceTypes(query: string) {
  const q = normalizeSearch(query.trim());
  return deviceTypeGroups
    .map((group) => ({
      ...group,
      types: group.types.filter(
        (type) =>
          !q || normalizeSearch(`${group.label} ${deviceTypeLabels[type]} ${type}`).includes(q),
      ),
    }))
    .filter((group) => group.types.length > 0);
}
