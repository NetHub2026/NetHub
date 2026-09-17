/**
 * Base de datos OUI local (prefijos MAC → fabricante) con las marcas más
 * habituales en una red doméstica. No requiere conexión ni API externa.
 */

export type VendorBrand =
  | "apple"
  | "sony"
  | "nintendo"
  | "microsoft"
  | "samsung"
  | "lg"
  | "espressif"
  | "shelly"
  | "intel"
  | "raspberry"
  | "tp-link"
  | "asus"
  | "google"
  | "amazon"
  | "xiaomi"
  | "philips"
  | "aqara"
  | "tado"
  | "reolink"
  | "valve"
  | "ubiquiti"
  | "netgear"
  | "avm"
  | "unknown";

interface OuiEntry {
  vendor: string;
  brand: VendorBrand;
}

/** Prefijos OUI en minúsculas con formato `aa:bb:cc`. */
const OUI: Record<string, OuiEntry> = {
  // Apple
  "f0:18:98": { vendor: "Apple", brand: "apple" },
  "a4:5e:60": { vendor: "Apple", brand: "apple" },
  "3c:15:c2": { vendor: "Apple", brand: "apple" },
  "d0:81:7a": { vendor: "Apple", brand: "apple" },
  "ac:bc:32": { vendor: "Apple", brand: "apple" },
  "f4:5c:89": { vendor: "Apple", brand: "apple" },
  // Sony / PlayStation
  "78:c8:81": { vendor: "Sony Interactive", brand: "sony" },
  "00:d9:d1": { vendor: "Sony Interactive", brand: "sony" },
  "bc:60:a7": { vendor: "Sony Interactive", brand: "sony" },
  "fc:0f:e6": { vendor: "Sony Interactive", brand: "sony" },
  // Nintendo
  "98:b6:e9": { vendor: "Nintendo", brand: "nintendo" },
  "58:bd:a3": { vendor: "Nintendo", brand: "nintendo" },
  "8c:56:c5": { vendor: "Nintendo", brand: "nintendo" },
  "e8:4e:ce": { vendor: "Nintendo", brand: "nintendo" },
  // Microsoft / Xbox
  "00:15:5d": { vendor: "Microsoft", brand: "microsoft" },
  "7c:1e:52": { vendor: "Microsoft", brand: "microsoft" },
  "c8:3f:26": { vendor: "Microsoft", brand: "microsoft" },
  // Samsung
  "8c:79:f5": { vendor: "Samsung", brand: "samsung" },
  "5c:49:7d": { vendor: "Samsung", brand: "samsung" },
  "78:47:1d": { vendor: "Samsung", brand: "samsung" },
  "fc:03:9f": { vendor: "Samsung", brand: "samsung" },
  // LG
  "3c:cd:93": { vendor: "LG Electronics", brand: "lg" },
  "10:f9:6f": { vendor: "LG Electronics", brand: "lg" },
  "cc:2d:8c": { vendor: "LG Electronics", brand: "lg" },
  // Espressif (ESP8266/ESP32, base de muchos IoT y Shelly)
  "50:02:91": { vendor: "Espressif (IoT)", brand: "espressif" },
  "24:0a:c4": { vendor: "Espressif (IoT)", brand: "espressif" },
  "3c:61:05": { vendor: "Espressif (IoT)", brand: "espressif" },
  "84:cc:a8": { vendor: "Espressif (IoT)", brand: "espressif" },
  "bc:dd:c2": { vendor: "Espressif (IoT)", brand: "espressif" },
  "b8:27:eb": { vendor: "Raspberry Pi", brand: "raspberry" },
  "dc:a6:32": { vendor: "Raspberry Pi", brand: "raspberry" },
  "e4:5f:01": { vendor: "Raspberry Pi", brand: "raspberry" },
  "2c:cf:67": { vendor: "Raspberry Pi", brand: "raspberry" },
  // Shelly (Allterco)
  "c4:5b:be": { vendor: "Shelly", brand: "shelly" },
  "e8:68:e7": { vendor: "Shelly", brand: "shelly" },
  "8c:aa:b5": { vendor: "Shelly", brand: "shelly" },
  // Intel (portátiles y placas)
  "00:1b:77": { vendor: "Intel", brand: "intel" },
  "94:65:9c": { vendor: "Intel", brand: "intel" },
  "a4:c3:f0": { vendor: "Intel", brand: "intel" },
  "e4:a4:71": { vendor: "Intel", brand: "intel" },
  // TP-Link
  "50:c7:bf": { vendor: "TP-Link", brand: "tp-link" },
  "98:da:c4": { vendor: "TP-Link", brand: "tp-link" },
  "b0:4e:26": { vendor: "TP-Link", brand: "tp-link" },
  "ac:84:c6": { vendor: "TP-Link", brand: "tp-link" },
  // ASUS
  "2c:56:dc": { vendor: "ASUSTek", brand: "asus" },
  "1c:87:2c": { vendor: "ASUSTek", brand: "asus" },
  "04:d4:c4": { vendor: "ASUSTek", brand: "asus" },
  // Google / Nest
  "00:1a:11": { vendor: "Google", brand: "google" },
  "f4:f5:e8": { vendor: "Google", brand: "google" },
  "1c:f2:9a": { vendor: "Google", brand: "google" },
  // Amazon (Echo, Fire TV)
  "44:65:0d": { vendor: "Amazon", brand: "amazon" },
  "68:37:e9": { vendor: "Amazon", brand: "amazon" },
  "fc:65:de": { vendor: "Amazon", brand: "amazon" },
  // Xiaomi
  "78:11:dc": { vendor: "Xiaomi", brand: "xiaomi" },
  "64:cc:2e": { vendor: "Xiaomi", brand: "xiaomi" },
  "f8:8f:ca": { vendor: "Xiaomi", brand: "xiaomi" },
  // Philips Hue / Signify
  "00:17:88": { vendor: "Philips Hue", brand: "philips" },
  "ec:b5:fa": { vendor: "Philips Hue", brand: "philips" },
  // Otros IoT y red
  "e0:98:06": { vendor: "Aqara", brand: "aqara" },
  "54:ef:44": { vendor: "Aqara", brand: "aqara" },
  "50:02:92": { vendor: "Tado", brand: "tado" },
  "ec:71:db": { vendor: "Reolink", brand: "reolink" },
  "1c:bf:ce": { vendor: "Valve", brand: "valve" },
  "78:8a:20": { vendor: "Ubiquiti", brand: "ubiquiti" },
  "f4:92:bf": { vendor: "Ubiquiti", brand: "ubiquiti" },
  "a0:40:a0": { vendor: "Netgear", brand: "netgear" },
  "9c:3d:cf": { vendor: "Netgear", brand: "netgear" },
  "3c:a6:2f": { vendor: "AVM (FRITZ!Box)", brand: "avm" },
};

export function normalizeMac(mac: string): string {
  return mac.trim().toUpperCase().replace(/-/g, ":");
}

function prefix(mac: string): string {
  return normalizeMac(mac).toLowerCase().slice(0, 8);
}

export function lookupOui(mac: string): OuiEntry {
  return OUI[prefix(mac)] ?? { vendor: "Fabricante desconocido", brand: "unknown" };
}

export function vendorFromMac(mac: string): string {
  return lookupOui(mac).vendor;
}

export function brandFromMac(mac: string): VendorBrand {
  return lookupOui(mac).brand;
}

/** ¿Es una MAC aleatorizada por privacidad? (segundo bit del primer octeto) */
export function isRandomizedMac(mac: string): boolean {
  const first = parseInt(normalizeMac(mac).slice(0, 2), 16);
  return Number.isFinite(first) ? (first & 0x02) === 0x02 : false;
}

/** Nombre sugerido automáticamente a partir del fabricante y la IP. */
export function suggestedName(mac: string, ip: string): string {
  const { vendor, brand } = lookupOui(mac);
  const host = ip.split(".").pop() ?? "?";
  if (brand === "unknown") return `Dispositivo ${host}`;
  return `${vendor} ${host}`;
}
