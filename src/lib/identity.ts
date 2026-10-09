/**
 * Device Identity v1 — reconocimiento de fabricante y tipo con fiabilidad.
 *
 * Todo se calcula en local a partir de datos que ya tenemos (MAC, nombre,
 * servicios detectados y ediciones manuales). No se guarda nada nuevo en el
 * inventario: la identidad se deriva cada vez, así los datos antiguos siguen
 * funcionando tal cual y no hace falta migrar `devices-db.json`.
 *
 * Catálogo de fabricantes: listados públicos de la IEEE Registration Authority
 * (MA-L 24 bits, MA-M 28 bits, MA-S 36 bits) incluidos en la app y cargados
 * bajo demanda. Nunca se envían MAC ni IP a servicios externos.
 */
import type { Device, DeviceType } from "./devices";

export type IdentityConfidence = "confirmed" | "probable" | "unknown";
export type IdentitySource = "manual" | "oui" | "hostname" | "network" | null;

export interface IdentityFact<T> {
  value: T | null;
  confidence: IdentityConfidence;
  source: IdentitySource;
}

export interface DeviceIdentity {
  /** Empresa registrada para la tarjeta de red (no necesariamente la marca del aparato). */
  adapterVendor: IdentityFact<string>;
  /** Marca del aparato, solo si hay evidencia (manual o nombre). */
  vendor: IdentityFact<string>;
  type: IdentityFact<DeviceType>;
  macKind: MacKind;
}

export type MacKind = "global" | "local" | "multicast" | "invalid";

export const confidenceLabels: Record<IdentityConfidence, string> = {
  confirmed: "Confirmado",
  probable: "Probable",
  unknown: "Desconocido",
};

export const sourceLabels: Record<Exclude<IdentitySource, null>, string> = {
  manual: "Manual",
  oui: "OUI",
  hostname: "Nombre/hostname",
  network: "Señales de red",
};

/* ------------------------------------------------------------------ MAC */

/** Devuelve los 12 dígitos hexadecimales en mayúsculas, o null si no es una MAC válida. */
export function macHex(mac: string | null | undefined): string | null {
  const raw = String(mac ?? "").trim();
  if (!/^[0-9a-f]{2}([:-]?[0-9a-f]{2}){5}$/i.test(raw) && !/^[0-9a-f]{4}\.[0-9a-f]{4}\.[0-9a-f]{4}$/i.test(raw))
    return null;
  const hex = raw.replace(/[^0-9a-f]/gi, "").toUpperCase();
  if (hex.length !== 12) return null;
  if (hex === "000000000000" || hex === "FFFFFFFFFFFF") return null;
  return hex;
}

export function classifyMac(mac: string | null | undefined): MacKind {
  const hex = macHex(mac);
  if (!hex) return "invalid";
  const first = parseInt(hex.slice(0, 2), 16);
  if (first & 0x01) return "multicast";
  if (first & 0x02) return "local";
  return "global";
}

/* ------------------------------------------------------- Catálogo IEEE */

interface Registry {
  names: string[];
  l: Map<string, number>;
  m: Map<string, number>;
  s: Map<string, number>;
}

let registry: Registry | null = null;
let loading: Promise<Registry | null> | null = null;
const listeners = new Set<() => void>();

function parseBlock(text: string): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of text.split(";")) {
    const sep = item.indexOf(":");
    if (sep > 0) map.set(item.slice(0, sep), Number(item.slice(sep + 1)));
  }
  return map;
}

export interface RawRegistry {
  names: string[];
  "24": string;
  "28": string;
  "36": string;
}

/** Instala un catálogo ya cargado (usado por la carga perezosa y por las pruebas). */
export function installRegistry(raw: RawRegistry) {
  registry = { names: raw.names, l: parseBlock(raw["24"]), m: parseBlock(raw["28"]), s: parseBlock(raw["36"]) };
  listeners.forEach((fn) => fn());
}

/** Carga el catálogo local (un único archivo empaquetado con la app). */
export function loadIeeeRegistry(): Promise<Registry | null> {
  if (registry) return Promise.resolve(registry);
  if (!loading) {
    loading = import("./oui-data/ieee-registry.json")
      .then((mod) => {
        installRegistry((mod.default ?? mod) as unknown as RawRegistry);
        return registry;
      })
      .catch(() => {
        loading = null;
        return null;
      });
  }
  return loading;
}

export function isRegistryLoaded() {
  return registry !== null;
}

export function onRegistryLoaded(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Organización registrada para la MAC (prefijo más largo primero). Null si es local/aleatoria o no consta. */
export function ieeeVendor(mac: string | null | undefined): string | null {
  if (!registry) return null;
  if (classifyMac(mac) !== "global") return null;
  const hex = macHex(mac)!;
  const hit = registry.s.get(hex.slice(0, 9)) ?? registry.m.get(hex.slice(0, 7)) ?? registry.l.get(hex.slice(0, 6));
  return hit === undefined ? null : (registry.names[hit] ?? null);
}

/* ------------------------------------------------------- Tipo y marca */

/** Nombres que no dicen nada del aparato (los generamos nosotros o el router). */
const GENERIC_NAME =
  /^(dispositivo|device|unknown|desconocido|host|android|localhost|espressif|esp[_-]?[0-9a-f]{4,}|[0-9a-f]{2}([:-][0-9a-f]{2}){5}|\d{1,3}(\.\d{1,3}){3})\b|^(dispositivo|fabricante desconocido|mac privada)/i;

export function isGenericName(name: string | null | undefined, vendor?: string | null): boolean {
  const text = String(name ?? "").trim();
  if (!text) return true;
  if (GENERIC_NAME.test(text)) return true;
  // "Fabricante 42": nombre generado automáticamente a partir del fabricante y la IP.
  const m = text.match(/^(.+)\s\d{1,3}$/);
  return !!(m?.[1] && vendor && m[1].trim().toLowerCase() === vendor.trim().toLowerCase());
}

/** Pistas inequívocas o casi en el nombre / hostname. Orden: de más a menos específico. */
const NAME_TYPE_RULES: Array<[RegExp, DeviceType]> = [
  [/playstation|\bps[345]\b|xbox|nintendo|\bswitch\b|steam.?deck/i, "console"],
  [/home.?assistant|\bhassio\b|\bhass\b/i, "home-assistant"],
  [/apple.?tv|chromecast|fire.?tv|firestick|shield.?tv|android.?tv.?box|mi.?box|\broku\b|decodificador|tv.?box|set.?top/i, "set-top-box"],
  [/bravia|webos|tizen|smart.?tv|\b(lg|samsung|philips|tcl|hisense).?tv\b|televisi/i, "tv"],
  [/\bipad\b|galaxy.?tab|\btablet\b|matepad|mediapad/i, "tablet"],
  [/iphone|\bpixel\b|galaxy.?[saz]\d|redmi.?note|smartphone|m[oó]vil/i, "smartphone"],
  [/macbook|thinkpad|ideapad|vivobook|zenbook|latitude|inspiron|laptop|port[aá]til|notebook/i, "laptop"],
  [/\bimac\b|mac.?mini|mac.?studio|desktop|sobremesa|\bpc\b/i, "pc"],
  [/synology|diskstation|qnap|truenas|unraid|\bnas\b/i, "nas"],
  [/laserjet|officejet|deskjet|envy.?\d|printer|impresora|\bepson\b|\bbrother\b|canon.?(mg|ts|ix|mf)/i, "printer"],
  [/\bcam(era)?\b|c[aá]mara|reolink|hikvision|dahua|doorbell|timbre|tapo.?c\d/i, "camera"],
  [/\becho\b|alexa|homepod|sonos|nest.?(mini|audio)|altavoz|speaker/i, "speaker"],
  [/smart.?plug|enchufe|tapo.?p1\d\d|\bhs1\d\d\b|\bkp1\d\d\b|sonoff|shelly.?plug/i, "smart-plug"],
  [/\bbulb\b|bombilla|\bhue\b|yeelight|lifx|tradfri|wiz/i, "smart-bulb"],
  [/led.?strip|tira.?led|lightstrip|govee|nanoleaf/i, "led-strip"],
  [/router|\bhgu\b|fritz.?box|livebox|repetidor|extender|access.?point|unifi|openwrt|deco.?[mx]\d/i, "router"],
];

/** Marca del aparato deducible del nombre (no del adaptador). */
const NAME_BRAND_RULES: Array<[RegExp, string]> = [
  [/iphone|ipad|macbook|\bimac\b|apple|homepod/i, "Apple"],
  [/playstation|\bps[345]\b|bravia/i, "Sony"],
  [/xbox|surface/i, "Microsoft"],
  [/nintendo|\bswitch\b/i, "Nintendo"],
  [/galaxy|samsung|tizen/i, "Samsung"],
  [/\bpixel\b|chromecast|google.?home|nest/i, "Google"],
  [/\becho\b|alexa|fire.?tv|firestick|kindle/i, "Amazon"],
  [/synology|diskstation/i, "Synology"],
  [/sonos/i, "Sonos"],
  [/shelly/i, "Shelly"],
  [/fritz/i, "AVM"],
  [/reolink/i, "Reolink"],
  [/\bhue\b|philips/i, "Philips"],
];

/** Tipos que el fabricante del adaptador sugiere razonablemente (solo marcas monoproducto). */
const ADAPTER_TYPE_RULES: Array<[RegExp, DeviceType]> = [
  [/nintendo/i, "console"],
  [/sony interactive/i, "console"],
  [/valve/i, "console"],
  [/synology|qnap/i, "nas"],
  [/reolink|hikvision|hangzhou hikvision|dahua/i, "camera"],
  [/seiko epson|brother industries|canon inc/i, "printer"],
  [/sonos/i, "speaker"],
  [/roku/i, "set-top-box"],
  [/sagemcom|sercomm|arcadyan|mitrastar|askey|comtrend|zyxel|technicolor|avm gmbh|ubiquiti/i, "router"],
];

/** Servicios que identifican el tipo con bastante seguridad. */
function typeFromServices(device: Pick<Device, "services">): DeviceType | null {
  const ports = new Set((device.services ?? []).map((s) => s.port));
  if (ports.size === 0) return null;
  if (ports.has(8123)) return "home-assistant";
  if (ports.has(9100) || ports.has(631)) return "printer";
  if (ports.has(554)) return "camera";
  if (ports.has(32400) || (ports.has(5000) && ports.has(445))) return "nas";
  if (ports.has(3389)) return "pc";
  return null;
}

function isMeaningfulVendor(v: string | null | undefined): v is string {
  const text = String(v ?? "").trim();
  return text.length > 0 && !/^(fabricante desconocido|mac privada|desconocido|unknown)/i.test(text);
}

export type IdentityInput = Pick<Device, "name" | "type" | "mac" | "vendor" | "manualEdit" | "services">;

/**
 * Calcula la identidad de un dispositivo. `adapterName` permite pasar el
 * fabricante IEEE explícitamente (pruebas); si no, se usa el catálogo cargado.
 */
export function deriveIdentity(device: IdentityInput, adapterName?: string | null): DeviceIdentity {
  const macKind = classifyMac(device.mac);
  const adapter = adapterName !== undefined ? adapterName : ieeeVendor(device.mac);
  const name = isGenericName(device.name, device.vendor) ? "" : String(device.name ?? "");

  const adapterVendor: IdentityFact<string> =
    macKind === "global" && adapter
      ? { value: adapter, confidence: "probable", source: "oui" }
      : { value: null, confidence: "unknown", source: null };

  // Marca del aparato
  let vendor: IdentityFact<string> = { value: null, confidence: "unknown", source: null };
  if (device.manualEdit && isMeaningfulVendor(device.vendor)) {
    vendor = { value: device.vendor.trim(), confidence: "confirmed", source: "manual" };
  } else {
    const byName = name ? NAME_BRAND_RULES.find(([re]) => re.test(name))?.[1] : undefined;
    if (byName) vendor = { value: byName, confidence: "probable", source: "hostname" };
    else if (adapterVendor.value) vendor = { ...adapterVendor };
  }

  // Tipo
  let type: IdentityFact<DeviceType> = { value: null, confidence: "unknown", source: null };
  if (device.manualEdit) {
    type = { value: device.type, confidence: "confirmed", source: "manual" };
  } else {
    const byName = name ? NAME_TYPE_RULES.find(([re]) => re.test(name))?.[1] : undefined;
    const byNet = typeFromServices(device);
    const byAdapter = adapterVendor.value
      ? ADAPTER_TYPE_RULES.find(([re]) => re.test(adapterVendor.value!))?.[1]
      : undefined;
    if (byName) type = { value: byName, confidence: "probable", source: "hostname" };
    else if (byNet) type = { value: byNet, confidence: "probable", source: "network" };
    else if (byAdapter) type = { value: byAdapter, confidence: "probable", source: "oui" };
  }

  return { adapterVendor, vendor, type, macKind };
}

/** Tipo sugerido para un dispositivo recién detectado, o null si no hay pistas. */
export function inferType(device: IdentityInput, adapterName?: string | null): DeviceType | null {
  return deriveIdentity({ ...device, manualEdit: false }, adapterName).type.value;
}
