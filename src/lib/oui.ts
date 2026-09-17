/**
 * Base de datos OUI local (prefijos MAC → fabricante) con marcas habituales en
 * redes domésticas: móviles, PCs, consolas, Smart TVs, operadoras, routers e IoT.
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
  | "huawei"
  | "realtek"
  | "sercomm"
  | "sagemcom"
  | "arcadyan"
  | "technicolor"
  | "mitrastar"
  | "askey"
  | "zyxel"
  | "comtrend"
  | "tuya"
  | "hp"
  | "dell"
  | "lenovo"
  | "roku"
  | "sonos"
  | "synology"
  | "canon"
  | "epson"
  | "brother"
  | "hikvision"
  | "dahua"
  | "honor"
  | "oppo"
  | "oneplus"
  | "unknown";

export interface OuiEntry {
  vendor: string;
  brand: VendorBrand;
}

interface HostnameRule {
  pattern: RegExp;
  entry: OuiEntry;
}

const UNKNOWN_VENDOR: OuiEntry = { vendor: "Fabricante desconocido", brand: "unknown" };
const OUI_CACHE_KEY = "nethub.oui-cache.v1";

function entry(vendor: string, brand: VendorBrand): OuiEntry {
  return { vendor, brand };
}

function addEntries(
  target: Record<string, OuiEntry>,
  vendor: string,
  brand: VendorBrand,
  prefixes: string[],
) {
  const item = entry(vendor, brand);
  prefixes.forEach((p) => {
    target[p] = item;
  });
}

/** Prefijos OUI en minúsculas con formato `aa:bb:cc`. */
const OUI: Record<string, OuiEntry> = {};

addEntries(OUI, "Apple", "apple", [
  "00:03:93",
  "00:05:02",
  "00:0a:27",
  "00:0a:95",
  "00:0d:93",
  "00:11:24",
  "00:14:51",
  "00:16:cb",
  "00:17:f2",
  "00:19:e3",
  "00:1b:63",
  "00:1c:b3",
  "00:1e:c2",
  "00:1f:5b",
  "00:21:e9",
  "00:22:41",
  "00:23:12",
  "00:23:32",
  "00:23:6c",
  "00:25:00",
  "00:25:4b",
  "00:26:08",
  "00:26:4a",
  "00:26:b0",
  "04:0c:ce",
  "04:1e:64",
  "04:26:65",
  "04:48:9a",
  "04:54:53",
  "04:69:f8",
  "04:d3:cf",
  "08:00:07",
  "08:66:98",
  "08:70:45",
  "08:74:02",
  "08:f4:ab",
  "0c:30:21",
  "0c:3e:9f",
  "0c:4d:e9",
  "0c:74:c2",
  "0c:77:1a",
  "10:40:f3",
  "10:93:e9",
  "10:9a:dd",
  "10:dd:b1",
  "14:10:9f",
  "14:20:5e",
  "14:5a:05",
  "14:7d:da",
  "18:20:32",
  "18:34:51",
  "18:65:90",
  "18:af:61",
  "18:e7:f4",
  "1c:1a:c0",
  "1c:36:bb",
  "1c:5c:f2",
  "1c:ab:a7",
  "20:78:f0",
  "20:a2:e4",
  "20:c9:d0",
  "24:24:0e",
  "24:5b:a7",
  "24:a0:74",
  "24:ab:81",
  "28:37:37",
  "28:cf:da",
  "28:e0:2c",
  "28:e7:cf",
  "2c:1f:23",
  "2c:33:61",
  "2c:54:91",
  "2c:f0:a2",
  "30:10:e4",
  "30:35:ad",
  "30:90:ab",
  "30:f7:c5",
  "34:15:9e",
  "34:36:3b",
  "34:51:c9",
  "34:ab:37",
  "34:c0:59",
  "38:0f:4a",
  "38:48:4c",
  "38:71:de",
  "38:c9:86",
  "3c:07:54",
  "3c:15:c2",
  "3c:2e:f9",
  "3c:5a:b4",
  "3c:a1:0d",
  "3c:d0:f8",
  "40:30:04",
  "40:33:1a",
  "40:6c:8f",
  "40:a6:d9",
  "44:00:10",
  "44:4c:0c",
  "44:d8:84",
  "48:43:7c",
  "48:60:bc",
  "48:74:6e",
  "48:a9:1c",
  "4c:32:75",
  "4c:57:ca",
  "4c:74:bf",
  "50:32:37",
  "50:ea:d6",
  "54:26:96",
  "54:72:4f",
  "58:55:ca",
  "58:b0:35",
  "5c:1d:d9",
  "5c:8d:4e",
  "5c:95:ae",
  "60:33:4b",
  "60:69:44",
  "60:92:17",
  "64:20:0c",
  "64:76:ba",
  "64:a3:cb",
  "68:09:27",
  "68:5b:35",
  "68:96:7b",
  "68:ab:1e",
  "6c:3e:6d",
  "6c:40:08",
  "6c:72:e7",
  "70:11:24",
  "70:56:81",
  "70:73:cb",
  "70:cd:60",
  "74:81:14",
  "78:31:c1",
  "78:4f:43",
  "78:6c:1c",
  "78:7b:8a",
  "7c:04:d0",
  "7c:11:be",
  "7c:6d:62",
  "7c:c5:37",
  "80:00:6e",
  "80:49:71",
  "80:92:9f",
  "80:e6:50",
  "84:29:99",
  "84:38:35",
  "84:85:06",
  "84:fc:fe",
  "88:53:95",
  "88:63:df",
  "88:c6:63",
  "8c:29:37",
  "8c:58:77",
  "8c:7b:9d",
  "90:27:e4",
  "90:60:f1",
  "90:72:40",
  "90:b0:ed",
  "94:94:26",
  "98:01:a7",
  "98:03:d8",
  "98:b8:e3",
  "98:ca:33",
  "9c:04:eb",
  "9c:20:7b",
  "9c:35:eb",
  "9c:84:bf",
  "a0:56:f3",
  "a0:99:9b",
  "a4:5e:60",
  "a4:67:06",
  "a4:b1:97",
  "a8:5b:78",
  "a8:86:dd",
  "a8:bb:cf",
  "ac:bc:32",
  "ac:cf:5c",
  "ac:fd:ec",
  "b0:34:95",
  "b0:48:1a",
  "b0:65:bd",
  "b4:18:d1",
  "b4:8b:19",
  "b8:09:8a",
  "b8:c7:5d",
  "b8:e8:56",
  "bc:3b:af",
  "bc:52:b7",
  "bc:67:78",
  "bc:92:6b",
  "c0:84:7a",
  "c0:9f:42",
  "c4:2c:03",
  "c8:33:4b",
  "c8:69:cd",
  "c8:bc:c8",
  "cc:08:8d",
  "cc:20:e8",
  "cc:29:f5",
  "cc:44:63",
  "d0:03:4b",
  "d0:23:db",
  "d0:81:7a",
  "d4:9a:20",
  "d4:f4:6f",
  "d8:30:62",
  "d8:a2:5e",
  "dc:2b:2a",
  "dc:37:14",
  "dc:86:d8",
  "e0:66:78",
  "e0:b5:2d",
  "e0:c9:7a",
  "e4:25:e7",
  "e4:8b:7f",
  "e4:ce:8f",
  "e8:06:88",
  "e8:80:2e",
  "e8:8d:28",
  "ec:35:86",
  "ec:85:2f",
  "f0:18:98",
  "f0:24:75",
  "f0:99:bf",
  "f0:b4:d2",
  "f4:0f:24",
  "f4:31:c3",
  "f4:5c:89",
  "f4:f1:5a",
  "f8:1e:df",
  "f8:ff:c2",
  "fc:25:3f",
  "fc:e9:98",
]);

addEntries(OUI, "Samsung", "samsung", [
  "00:07:ab",
  "00:12:47",
  "00:15:99",
  "00:16:32",
  "00:17:c9",
  "00:1a:8a",
  "00:1b:98",
  "00:1c:43",
  "00:1d:25",
  "00:1e:7d",
  "00:21:19",
  "00:23:39",
  "00:24:54",
  "00:26:37",
  "04:18:0f",
  "08:08:c2",
  "08:37:3d",
  "08:fc:88",
  "0c:14:20",
  "0c:89:10",
  "10:30:47",
  "10:77:b1",
  "14:49:e0",
  "18:3a:2d",
  "18:46:17",
  "18:89:5b",
  "1c:5a:3e",
  "1c:66:aa",
  "1c:af:05",
  "20:02:af",
  "20:13:e0",
  "20:64:32",
  "24:4b:03",
  "24:c9:a1",
  "28:27:bf",
  "2c:44:fd",
  "30:07:4d",
  "34:14:5f",
  "34:23:ba",
  "34:aa:8b",
  "38:aa:3c",
  "3c:5a:b4",
  "3c:bd:3e",
  "40:0e:85",
  "40:16:3b",
  "44:4e:1a",
  "48:5a:3f",
  "4c:3c:16",
  "50:01:bb",
  "50:32:75",
  "50:56:bf",
  "54:40:ad",
  "5c:49:7d",
  "5c:51:4f",
  "5c:f6:dc",
  "60:6b:bd",
  "64:5a:04",
  "64:b3:10",
  "68:05:ca",
  "68:27:37",
  "6c:2f:2c",
  "70:28:8b",
  "70:f9:27",
  "74:45:8a",
  "78:1f:db",
  "78:25:ad",
  "78:47:1d",
  "7c:61:66",
  "80:18:a7",
  "84:25:db",
  "84:a4:66",
  "88:32:9b",
  "8c:71:f8",
  "8c:79:f5",
  "90:18:7c",
  "94:01:c2",
  "98:52:b1",
  "98:d6:f7",
  "9c:02:98",
  "a0:0b:ba",
  "a0:21:95",
  "a4:eb:d3",
  "a8:f2:74",
  "ac:5f:3e",
  "b0:c4:20",
  "b4:62:93",
  "bc:14:85",
  "bc:20:a4",
  "bc:72:b1",
  "c0:bd:d1",
  "c4:57:6e",
  "cc:07:ab",
  "d0:87:e2",
  "d4:88:90",
  "d8:31:cf",
  "dc:66:72",
  "e4:32:cb",
  "e8:03:9a",
  "ec:1f:72",
  "f0:25:b7",
  "f4:7b:5e",
  "fc:03:9f",
]);

addEntries(OUI, "Xiaomi", "xiaomi", [
  "04:cf:8c",
  "10:2a:b3",
  "14:f6:5a",
  "18:59:36",
  "1c:1d:67",
  "20:34:fb",
  "28:e3:1f",
  "2c:ab:33",
  "34:80:b3",
  "38:a4:ed",
  "40:31:3c",
  "44:6d:57",
  "50:8f:4c",
  "58:44:98",
  "64:09:80",
  "64:cc:2e",
  "68:df:dd",
  "74:23:44",
  "78:11:dc",
  "7c:49:eb",
  "84:c7:ea",
  "8c:be:be",
  "98:fa:e3",
  "9c:99:a0",
  "a0:86:c6",
  "a4:50:46",
  "ac:c1:ee",
  "b0:e2:35",
  "c4:0b:cb",
  "d0:13:fd",
  "d4:97:0b",
  "e4:46:da",
  "e8:5a:8b",
  "f0:b4:29",
  "f8:8f:ca",
  "fc:64:ba",
]);

addEntries(OUI, "Huawei", "huawei", [
  "00:18:82",
  "00:1e:10",
  "00:25:9e",
  "04:25:c5",
  "08:19:a6",
  "0c:37:dc",
  "10:1b:54",
  "14:b9:68",
  "18:de:d7",
  "20:08:ed",
  "24:09:95",
  "28:31:52",
  "2c:ab:00",
  "30:87:30",
  "34:00:a3",
  "38:37:8b",
  "3c:df:bd",
  "40:4d:8e",
  "44:6e:e5",
  "48:46:fb",
  "4c:54:99",
  "54:25:ea",
  "58:2a:f7",
  "5c:4c:a9",
  "60:de:44",
  "68:a0:f6",
  "70:7b:e8",
  "78:d7:52",
  "7c:11:cb",
  "80:fb:06",
  "84:a8:e4",
  "88:cf:98",
  "8c:34:fd",
  "90:2b:d2",
  "94:04:9c",
  "98:e7:43",
  "9c:28:ef",
  "a0:08:6f",
  "a4:c6:4f",
  "ac:4e:91",
  "b0:08:75",
  "b4:30:52",
  "bc:76:70",
  "c0:70:09",
  "c4:05:28",
  "c8:94:02",
  "cc:96:a0",
  "d0:7a:b5",
  "d4:6e:5c",
  "d8:49:0b",
  "dc:d2:fc",
  "e0:19:1d",
  "e4:a7:c5",
  "e8:08:8b",
  "ec:23:3d",
  "f0:25:72",
  "f4:4e:fd",
  "f8:01:13",
]);

addEntries(OUI, "Honor", "honor", ["24:9f:89", "30:45:11", "48:2c:a0", "68:4a:76", "80:35:c1", "9c:7d:a3", "bc:76:5e"]);
addEntries(OUI, "OPPO", "oppo", ["1c:77:f6", "20:34:fb", "34:be:00", "40:45:da", "54:5b:9c", "64:a2:f9", "70:66:55", "80:35:c1", "a8:5b:36", "bc:8a:e8", "d4:1a:3f", "e8:bb:a8"]);
addEntries(OUI, "OnePlus", "oneplus", ["2c:be:eb", "4c:4e:03", "74:23:44", "94:65:2d", "ac:45:00", "c0:ee:fb"]);

addEntries(OUI, "LG Electronics", "lg", [
  "00:1c:62",
  "00:1e:75",
  "00:21:fb",
  "00:24:83",
  "00:26:e2",
  "10:f9:6f",
  "14:c9:13",
  "18:f6:43",
  "20:21:a5",
  "28:54:71",
  "30:76:6f",
  "34:fc:ef",
  "38:8c:50",
  "3c:cd:93",
  "40:b0:fa",
  "48:59:29",
  "58:a2:b5",
  "5c:70:a3",
  "64:bc:0c",
  "70:05:14",
  "78:5d:c8",
  "7c:1c:4e",
  "88:36:6c",
  "8c:3a:e3",
  "a0:39:f7",
  "a8:16:b2",
  "b4:f7:a1",
  "c0:41:f6",
  "cc:2d:8c",
  "d0:13:fd",
  "e8:5b:5b",
  "f8:0c:f3",
]);

addEntries(OUI, "Sony Interactive", "sony", [
  "00:13:15",
  "00:16:fe",
  "00:19:c5",
  "00:1d:0d",
  "00:1f:a7",
  "00:22:98",
  "00:24:8d",
  "00:d9:d1",
  "04:5d:4b",
  "08:00:46",
  "18:aa:0f",
  "28:18:78",
  "40:b8:37",
  "54:53:ed",
  "58:48:22",
  "70:66:9d",
  "78:c8:81",
  "84:c7:ea",
  "90:cd:b6",
  "a8:e3:ee",
  "b0:52:16",
  "bc:60:a7",
  "c8:4a:a0",
  "d8:d4:3c",
  "e0:ae:5e",
  "f8:d0:27",
  "fc:0f:e6",
]);

addEntries(OUI, "Nintendo", "nintendo", ["00:09:bf", "00:16:56", "00:17:ab", "00:19:1d", "00:1a:e9", "00:1b:7a", "00:1c:be", "00:1d:bc", "00:1e:35", "00:22:aa", "00:24:44", "00:26:59", "2c:10:c1", "40:f4:07", "58:bd:a3", "5c:52:1e", "8c:56:c5", "98:b6:e9", "a4:c0:e1", "cc:fb:65", "e0:e7:51", "e8:4e:ce"]);
addEntries(OUI, "Microsoft", "microsoft", ["00:03:ff", "00:12:5a", "00:15:5d", "00:17:fa", "00:1d:d8", "00:22:48", "00:25:ae", "28:18:78", "38:56:3d", "48:50:73", "50:1a:c5", "58:82:a8", "60:45:bd", "7c:1e:52", "98:5f:d3", "98:7a:14", "b4:ae:2b", "c8:3f:26", "d8:9d:67"]);
addEntries(OUI, "Valve", "valve", ["1c:bf:ce", "28:cf:e9", "50:5a:65", "80:56:f2", "d0:27:88"]);

addEntries(OUI, "Intel", "intel", ["00:02:b3", "00:03:47", "00:04:23", "00:07:e9", "00:0c:f1", "00:0e:0c", "00:11:11", "00:12:f0", "00:13:02", "00:13:20", "00:13:ce", "00:15:00", "00:16:76", "00:16:ea", "00:18:de", "00:19:d1", "00:1b:21", "00:1b:77", "00:1c:bf", "00:1d:e0", "00:1e:64", "00:1f:3b", "00:21:5c", "00:21:6a", "00:22:fa", "00:23:14", "00:24:d6", "00:26:c6", "08:11:96", "0c:8b:fd", "10:02:b5", "18:56:80", "1c:69:7a", "20:16:d8", "24:77:03", "28:16:ad", "2c:6e:85", "30:24:32", "34:13:e8", "3c:a8:2a", "40:25:c2", "44:85:00", "48:45:20", "4c:79:6e", "50:76:af", "54:8d:5a", "58:91:cf", "5c:80:b6", "60:57:18", "64:80:99", "68:17:29", "6c:88:14", "70:1c:e7", "74:e5:0b", "78:92:9c", "7c:2a:31", "80:19:34", "84:1b:77", "88:78:73", "8c:c6:81", "90:49:fa", "94:65:9c", "98:2c:bc", "9c:b6:d0", "a0:a8:cd", "a4:c3:f0", "a8:6d:aa", "ac:2b:6e", "b0:7d:64", "b4:6d:83", "b8:81:98", "bc:17:b8", "c0:3f:d5", "c4:34:6b", "c8:21:58", "cc:3d:82", "d0:57:7b", "d4:d2:52", "d8:f2:ca", "dc:71:96", "e0:2b:e9", "e4:70:b8", "e4:a4:71", "e8:2a:44", "ec:63:d7", "f0:77:c3", "f4:06:69", "f8:63:3f", "fc:77:74"]);
addEntries(OUI, "Realtek", "realtek", ["00:02:44", "00:0e:2e", "00:13:3b", "00:18:e7", "00:1a:70", "00:1c:c0", "00:1d:92", "00:1e:ec", "00:22:68", "00:24:21", "00:e0:4c", "08:10:76", "10:7b:44", "14:da:e9", "1c:1b:0d", "2c:4d:54", "40:16:7e", "48:5b:39", "50:3e:aa", "52:54:00", "54:04:a6", "5c:6f:69", "60:e3:27", "68:1d:ef", "70:4d:7b", "74:27:ea", "78:45:c4", "8c:88:2b", "90:fb:a6", "a8:a1:59", "b0:6e:bf", "c8:3a:35", "d8:cb:8a", "e0:4f:43", "ec:08:6b", "f4:4d:30"]);
addEntries(OUI, "Dell", "dell", ["00:06:5b", "00:08:74", "00:0b:db", "00:0d:56", "00:11:43", "00:12:3f", "00:13:72", "00:14:22", "00:15:c5", "00:18:8b", "00:19:b9", "00:1a:a0", "00:1c:23", "00:1d:09", "00:21:70", "00:22:19", "00:23:ae", "00:24:e8", "00:25:64", "00:26:b9", "04:7d:7b", "08:00:27", "10:98:36", "14:18:77", "18:03:73", "18:66:da", "20:47:47", "24:b6:fd", "28:f1:0e", "34:17:eb", "3c:2c:30", "40:5c:fd", "44:a8:42", "4c:d9:8f", "50:9a:4c", "54:bf:64", "5c:26:0a", "60:45:cb", "64:00:6a", "68:4f:64", "70:b5:e8", "74:86:e2", "78:2b:cb", "80:18:44", "84:2b:2b", "90:b1:1c", "98:90:96", "a4:4c:c8", "b0:7b:25", "bc:30:5b", "c8:1f:66", "d0:94:66", "d4:be:d9", "e4:54:e8", "ec:2a:72", "f0:1f:af", "f8:b1:56"]);
addEntries(OUI, "HP", "hp", ["00:01:e6", "00:04:ea", "00:08:02", "00:0b:cd", "00:0e:7f", "00:10:83", "00:11:0a", "00:12:79", "00:14:38", "00:16:35", "00:17:08", "00:18:fe", "00:1a:4b", "00:1b:78", "00:1c:c4", "00:1f:29", "00:21:5a", "00:22:64", "00:23:7d", "00:25:b3", "00:26:55", "08:2e:5f", "10:1f:74", "14:02:ec", "18:60:24", "1c:c1:de", "20:4a:6d", "24:be:05", "28:92:4a", "2c:27:d7", "30:e1:71", "34:64:a9", "38:63:bb", "3c:52:82", "40:a8:f0", "44:1e:a1", "48:0f:cf", "4c:39:10", "50:65:f3", "54:ab:3a", "58:20:b1", "5c:b9:01", "60:57:18", "64:51:06", "68:b5:99", "70:5a:0f", "74:46:a0", "78:ac:c0", "80:c1:6e", "84:34:97", "88:51:fb", "8c:dc:d4", "90:1b:0e", "94:18:82", "98:e7:f4", "a0:48:1c", "a4:5d:36", "ac:e2:d3", "b0:5a:da", "b4:b5:2f", "bc:ea:fa", "c4:34:6b", "c8:d9:d2", "d0:bf:9c", "d4:85:64", "d8:9d:67", "dc:4a:3e", "e0:07:1b", "e4:11:5b", "e8:39:35", "ec:b1:d7", "f0:92:1c", "f4:39:09", "f8:b4:6a"]);
addEntries(OUI, "Lenovo", "lenovo", ["00:06:1b", "00:0a:e4", "00:0c:29", "00:12:fe", "00:13:72", "00:14:5e", "00:16:41", "00:19:5b", "00:1a:6b", "00:1c:25", "00:1e:37", "00:21:cc", "00:23:7d", "00:25:ab", "04:7d:7b", "08:11:96", "10:7b:44", "18:56:80", "20:16:d8", "28:d2:44", "34:e6:ad", "3c:97:0e", "40:b0:34", "4c:cc:6a", "50:7b:9d", "54:ee:75", "60:45:cb", "68:f7:28", "70:72:cf", "78:2b:cb", "80:fa:5b", "88:88:88", "90:2e:16", "98:fa:9b", "a4:34:d9", "b8:ae:ed", "c8:5b:76", "d8:cb:8a", "e0:2b:e9", "e8:2a:ea", "f0:76:1c", "fc:45:96"]);
addEntries(OUI, "ASUSTek", "asus", ["00:0c:6e", "00:0e:a6", "00:11:2f", "00:13:d4", "00:15:f2", "00:17:31", "00:18:f3", "00:1a:92", "00:1b:fc", "00:1d:60", "00:1e:8c", "00:22:15", "00:23:54", "00:24:8c", "00:26:18", "04:42:1a", "04:d4:c4", "08:60:6e", "10:7b:44", "14:dd:a9", "18:31:bf", "1c:87:2c", "20:cf:30", "24:4b:fe", "2c:56:dc", "30:5a:3a", "34:97:f6", "38:d5:47", "40:16:7e", "44:85:00", "48:5b:39", "50:46:5d", "54:a0:50", "60:a4:4c", "70:4d:7b", "78:24:af", "80:fa:5b", "88:d7:f6", "90:2b:34", "9c:5c:8e", "a0:36:bc", "ac:22:0b", "b0:6e:bf", "bc:ee:7b", "c8:7f:54", "d0:17:c2", "e0:3f:49", "f0:2f:74", "f8:32:e4"]);

addEntries(OUI, "TP-Link", "tp-link", ["00:14:78", "00:19:e0", "00:1d:0f", "00:21:27", "00:23:cd", "00:25:86", "04:95:e6", "0c:80:63", "10:27:f5", "14:cc:20", "18:a6:f7", "1c:3b:f3", "20:dc:e6", "24:a4:3c", "28:87:ba", "2c:27:d7", "30:b5:c2", "34:60:f9", "40:3f:8c", "44:94:fc", "50:c7:bf", "54:af:97", "5c:62:8b", "60:e3:27", "64:66:b3", "68:ff:7b", "6c:5a:b0", "70:4f:57", "74:da:88", "78:8c:b5", "84:16:f9", "8c:21:0a", "94:d9:b3", "98:48:27", "98:da:c4", "9c:53:22", "a0:f3:c1", "a4:2b:b0", "ac:15:a2", "ac:84:c6", "b0:4e:26", "b0:95:75", "b4:b0:24", "bc:46:99", "c0:25:e9", "c4:6e:1f", "c8:3a:35", "cc:32:e5", "d4:6e:0e", "d8:0d:17", "dc:fe:18", "e0:46:9a", "e4:c3:2a", "e8:48:b8", "ec:08:6b", "f0:a7:31", "f4:ec:38", "f8:1a:67"]);
addEntries(OUI, "Ubiquiti", "ubiquiti", ["00:15:6d", "04:18:d6", "18:e8:29", "24:a4:3c", "44:d9:e7", "68:72:51", "70:a7:41", "74:83:c2", "78:8a:20", "78:45:58", "80:2a:a8", "9c:05:d6", "a8:5e:45", "b4:fb:e4", "dc:9f:db", "e0:63:da", "f0:9f:c2", "f4:92:bf", "fc:ec:da"]);
addEntries(OUI, "Netgear", "netgear", ["00:09:5b", "00:0f:b5", "00:14:6c", "00:18:4d", "00:1b:2f", "00:1e:2a", "00:22:3f", "00:24:b2", "00:26:f2", "04:a1:51", "08:02:8e", "10:0d:7f", "20:4e:7f", "28:80:23", "2c:30:33", "30:46:9a", "34:98:b5", "44:94:fc", "4c:60:de", "50:6a:03", "54:b8:0a", "5c:26:0a", "6c:b0:ce", "74:44:01", "80:37:73", "84:1b:5e", "94:18:82", "9c:3d:cf", "a0:04:60", "a0:21:b7", "a0:40:a0", "b0:39:56", "c0:3f:0e", "c4:04:15", "cc:40:d0", "d0:75:be", "e0:46:ee", "e4:f4:c6", "ec:08:6b"]);
addEntries(OUI, "AVM (FRITZ!Box)", "avm", ["00:04:0e", "00:15:0c", "00:1a:4f", "00:1c:4a", "00:1f:3f", "00:24:fe", "08:96:d7", "24:65:11", "34:31:c4", "3c:a6:2f", "44:4e:6d", "5c:49:79", "74:31:70", "7c:ff:4d", "9c:c7:a6", "bc:05:43", "c8:0e:14", "dc:15:c8", "e0:28:6d"]);
// Routers de operadora (España: Movistar, Vodafone, Orange, Yoigo, Digi…).
// Prefijos sin solapamientos con TP-Link, Netgear o Ubiquiti para no confundir marcas.
addEntries(OUI, "Sercomm", "sercomm", ["00:13:c8", "00:15:56", "00:19:15", "00:1d:20", "00:24:ba", "04:20:9a", "0c:4c:39", "10:62:eb", "14:91:82", "18:83:bf", "20:2b:c1", "28:be:9b", "34:6b:46", "38:6b:1c", "40:65:a3", "48:31:b7", "58:23:8c", "64:66:24", "6c:63:9c", "70:54:d2", "78:8c:54", "94:4a:0c", "9c:97:26", "bc:4d:fb", "c0:56:27", "c4:27:95", "d4:6a:91", "dc:08:0f", "e0:91:f5", "e8:37:7a", "f0:72:8c", "f8:8e:85"]);
addEntries(OUI, "Sagemcom", "sagemcom", ["00:1a:2b", "00:22:07", "00:26:91", "0c:30:21", "18:1e:78", "1c:95:5d", "34:27:92", "3c:81:d8", "44:ce:7d", "4c:17:44", "50:7e:5d", "5c:35:3b", "68:7f:74", "80:3f:5d", "98:6b:3d", "ac:3b:77", "cc:2d:e0", "f4:b5:49"]);
addEntries(OUI, "Arcadyan", "arcadyan", ["00:12:bf", "00:1d:19", "08:76:ff", "10:13:31", "14:c0:3e", "18:83:31", "38:70:0c", "44:d4:e0", "50:d4:f7", "88:d2:74", "9c:80:df", "a4:08:f5", "b4:ee:b4", "cc:33:bb", "d0:5b:a8", "e0:19:1d", "e8:cc:18", "f4:6a:dd", "fc:b4:e6"]);
addEntries(OUI, "Technicolor", "technicolor", ["00:14:7f", "00:1f:9f", "00:24:d4", "08:76:95", "10:9f:a9", "34:8a:ae", "44:32:c8", "78:99:5c", "7c:03:d8", "84:e0:f4", "a0:55:de", "b8:16:19", "bc:64:4b", "cc:03:fa", "d4:35:1d", "dc:53:7c", "e8:3e:fc", "f8:8e:a1"]);
addEntries(OUI, "MitraStar", "mitrastar", ["04:c0:6f", "10:62:d0", "1c:49:7b", "28:9e:fc", "40:ed:00", "8c:0c:90", "e0:19:54", "f4:06:8d"]);
addEntries(OUI, "Askey", "askey", ["00:1e:c7", "00:23:08", "0c:f4:d5", "20:76:93", "34:8a:7b", "5c:a3:9d", "70:5a:9e", "88:96:4e", "b0:ac:d2", "cc:d4:a1", "e0:cc:f8"]);
addEntries(OUI, "Zyxel", "zyxel", ["00:13:49", "00:19:cb", "00:23:f8", "40:4a:03", "4c:9e:ff", "5c:f4:ab", "90:ef:68", "b0:b2:dc", "bc:99:11", "d8:ec:e5", "ec:43:f6", "f4:69:d5"]);
addEntries(OUI, "Comtrend", "comtrend", ["04:18:0f", "64:68:0c", "84:26:15", "90:5c:44", "c8:6c:87"]);

addEntries(OUI, "Espressif (IoT)", "espressif", ["18:fe:34", "24:0a:c4", "24:6f:28", "2c:3a:e8", "30:ae:a4", "3c:61:05", "48:3f:da", "4c:11:ae", "50:02:91", "54:5a:a6", "5c:cf:7f", "60:01:94", "68:c6:3a", "7c:9e:bd", "80:7d:3a", "84:0d:8e", "84:cc:a8", "8c:aa:b5", "90:97:d5", "94:b5:55", "98:cd:ac", "a0:20:a6", "a4:cf:12", "ac:67:b2", "b4:e6:2d", "bc:dd:c2", "c4:4f:33", "c8:2b:96", "cc:50:e3", "d8:a0:1d", "dc:4f:22", "e0:5a:1b", "e8:31:cd", "ec:64:c9", "f0:08:d1", "f4:cf:a2", "fc:f5:c4"]);
addEntries(OUI, "Shelly", "shelly", ["8c:aa:b5", "98:f4:ab", "c4:5b:be", "cc:50:e3", "e8:68:e7"]);
addEntries(OUI, "Tuya / SmartLife", "tuya", ["10:5a:17", "18:69:d8", "1c:90:ff", "24:62:ab", "34:94:54", "38:1f:8d", "3c:61:05", "50:8a:06", "60:01:94", "68:c6:3a", "70:03:9f", "84:0d:8e", "84:f3:eb", "a4:cf:12", "b4:e6:2d", "bc:dd:c2", "c4:dd:57", "d8:f1:5b", "dc:4f:22", "ec:fa:bc"]);
addEntries(OUI, "Raspberry Pi", "raspberry", ["b8:27:eb", "dc:a6:32", "e4:5f:01", "2c:cf:67", "d8:3a:dd"]);
addEntries(OUI, "Philips Hue", "philips", ["00:17:88", "ec:b5:fa", "00:04:7d", "00:12:4b", "5c:02:72", "84:18:26"]);
addEntries(OUI, "Aqara", "aqara", ["04:cf:8c", "54:ef:44", "e0:98:06", "ec:1b:bd"]);
addEntries(OUI, "Tado", "tado", ["50:02:92", "b8:27:eb", "d8:3a:dd"]);
addEntries(OUI, "Reolink", "reolink", ["00:1e:c0", "24:52:6a", "44:19:b6", "48:ea:63", "70:ef:00", "7c:78:b2", "90:09:d0", "b4:a3:82", "ec:71:db"]);
addEntries(OUI, "Hikvision", "hikvision", ["00:12:31", "00:23:63", "04:03:12", "18:68:cb", "28:57:be", "44:19:b6", "4c:bd:8f", "64:db:8b", "80:7c:62", "98:df:82", "a4:14:37", "bc:ad:28", "c4:2f:90", "d4:e8:53", "e0:ba:ad"]);
addEntries(OUI, "Dahua", "dahua", ["14:a7:8b", "1c:87:76", "3c:ef:8c", "4c:11:bf", "64:db:8b", "8c:e7:48", "90:02:a9", "a4:6c:2a", "bc:32:5f", "c4:11:e0", "e0:50:8b"]);

addEntries(OUI, "Google", "google", ["00:1a:11", "3c:5a:b4", "54:60:09", "64:16:66", "6c:ad:f8", "70:3a:cb", "7c:d9:5c", "88:54:1f", "9c:8e:cd", "a4:77:33", "b0:2a:43", "da:a1:19", "f4:f5:e8", "f8:8f:ca", "1c:f2:9a"]);
addEntries(OUI, "Amazon", "amazon", ["00:bb:3a", "18:74:2e", "1c:12:b0", "34:d2:70", "38:f7:3d", "44:65:0d", "50:dc:e7", "54:e4:3a", "68:37:e9", "68:54:fd", "6c:56:97", "74:c2:46", "84:d6:d0", "8c:85:90", "98:ed:5c", "a0:02:dc", "ac:63:be", "b0:fc:0d", "c8:3a:6b", "cc:f7:35", "d0:03:4b", "dc:54:d7", "e0:60:66", "f0:27:2d", "fc:65:de"]);
addEntries(OUI, "Roku", "roku", ["00:0d:4b", "08:05:81", "10:59:32", "18:bb:26", "20:ef:bd", "2c:43:1a", "38:79:f4", "40:4d:7f", "50:32:37", "5c:1d:d9", "64:16:66", "70:66:55", "84:ea:ed", "88:de:a9", "98:6f:60", "a8:3e:0e", "b0:ee:7b", "bc:d7:d4", "cc:6d:a0", "d0:4d:2c", "dc:3a:5e", "e0:37:bf", "f0:25:b7"]);
addEntries(OUI, "Sonos", "sonos", ["00:0e:58", "00:11:f5", "00:18:98", "00:1f:f3", "00:25:c5", "04:3e:9f", "34:7e:5c", "38:42:0b", "48:a6:b8", "54:2a:1b", "5c:aa:fd", "78:28:ca", "94:9f:3e", "b8:e9:37", "c4:38:75", "d8:1f:12", "f0:f6:c1"]);
addEntries(OUI, "Synology", "synology", ["00:11:32", "00:1d:ec", "00:22:4d", "00:2a:4f", "08:60:6e", "24:5e:be", "2c:59:e5", "48:4d:7e", "64:00:6a", "90:09:d0", "a8:a1:59", "b4:fb:e4", "e0:db:55"]);
addEntries(OUI, "Canon", "canon", ["00:00:85", "00:08:da", "00:1e:8f", "00:1f:6a", "00:21:ce", "00:24:9b", "00:2e:c7", "08:00:37", "10:1f:74", "18:0c:ac", "2c:9e:fc", "34:9f:7b", "3c:4a:92", "40:16:7e", "54:bd:79", "70:85:c2", "78:44:05", "88:87:17", "9c:32:ce", "ac:fd:ec", "b8:ca:3a", "c0:ee:fb", "f4:81:39"]);
addEntries(OUI, "Epson", "epson", ["00:00:48", "00:80:77", "00:90:ae", "04:cb:88", "38:1a:52", "44:d2:44", "50:57:9c", "64:eb:8c", "74:29:af", "9c:ae:d3", "a4:ee:57", "b0:e8:92", "d0:22:be", "e0:bb:9e"]);
addEntries(OUI, "Brother", "brother", ["00:80:77", "00:a0:5f", "00:1b:a9", "00:22:58", "00:24:17", "00:26:73", "08:00:37", "30:05:5c", "3c:2a:f4", "44:1c:a8", "54:13:79", "74:5c:4b", "80:77:37", "90:9c:4a", "a8:6b:ad", "c8:d3:a3", "e8:9a:8f"]);

const HOSTNAME_RULES: HostnameRule[] = [
  { pattern: /\b(iphone|ipad|ipod|macbook|imac|apple-tv|homepod)\b/i, entry: entry("Apple", "apple") },
  { pattern: /\b(galaxy|samsung)\b/i, entry: entry("Samsung", "samsung") },
  { pattern: /\b(xiaomi|redmi|poco|mi[-_ ]?box)\b/i, entry: entry("Xiaomi", "xiaomi") },
  { pattern: /\b(huawei|honor)\b/i, entry: entry("Huawei", "huawei") },
  { pattern: /\b(oppo|realme)\b/i, entry: entry("OPPO", "oppo") },
  { pattern: /\b(oneplus)\b/i, entry: entry("OnePlus", "oneplus") },
  { pattern: /\b(archer|deco|tapo|tplink|tp-link)\b/i, entry: entry("TP-Link", "tp-link") },
  { pattern: /\b(fritz|fritzbox|avm)\b/i, entry: entry("AVM (FRITZ!Box)", "avm") },
  { pattern: /\b(vodafone|sercomm)\b/i, entry: entry("Sercomm", "sercomm") },
  { pattern: /\b(livebox|sagemcom)\b/i, entry: entry("Sagemcom", "sagemcom") },
  { pattern: /\b(unifi|ubnt|ubiquiti)\b/i, entry: entry("Ubiquiti", "ubiquiti") },
  { pattern: /\b(netgear|orbi|nighthawk)\b/i, entry: entry("Netgear", "netgear") },
  { pattern: /\b(asus|asuswrt|rog)\b/i, entry: entry("ASUSTek", "asus") },
  { pattern: /\b(dell|xps|latitude|optiplex)\b/i, entry: entry("Dell", "dell") },
  { pattern: /\b(hp|laserjet|officejet|elitebook|probook)\b/i, entry: entry("HP", "hp") },
  { pattern: /\b(lenovo|thinkpad|ideapad|legion)\b/i, entry: entry("Lenovo", "lenovo") },
  { pattern: /\b(playstation|ps4|ps5|sony|bravia)\b/i, entry: entry("Sony", "sony") },
  { pattern: /\b(xbox|surface)\b/i, entry: entry("Microsoft", "microsoft") },
  { pattern: /\b(nintendo|switch)\b/i, entry: entry("Nintendo", "nintendo") },
  { pattern: /\b(lg|webos|oled)\b/i, entry: entry("LG Electronics", "lg") },
  { pattern: /\b(echo|alexa|firetv|kindle|amazon)\b/i, entry: entry("Amazon", "amazon") },
  { pattern: /\b(chromecast|nest|google[-_ ]?home|pixel)\b/i, entry: entry("Google", "google") },
  { pattern: /\b(roku)\b/i, entry: entry("Roku", "roku") },
  { pattern: /\b(sonos)\b/i, entry: entry("Sonos", "sonos") },
  { pattern: /\b(synology|diskstation|rackstation)\b/i, entry: entry("Synology", "synology") },
  { pattern: /\b(shelly)\b/i, entry: entry("Shelly", "shelly") },
  { pattern: /\b(tuya|smartlife|smart[-_ ]?life)\b/i, entry: entry("Tuya / SmartLife", "tuya") },
  { pattern: /\b(espressif|esp32|esp8266)\b/i, entry: entry("Espressif (IoT)", "espressif") },
  { pattern: /\b(homeassistant|home-assistant|raspberry|raspberrypi)\b/i, entry: entry("Raspberry Pi", "raspberry") },
  { pattern: /\b(hue|philips|signify)\b/i, entry: entry("Philips Hue", "philips") },
  { pattern: /\b(aqara)\b/i, entry: entry("Aqara", "aqara") },
  { pattern: /\b(reolink)\b/i, entry: entry("Reolink", "reolink") },
  { pattern: /\b(hikvision)\b/i, entry: entry("Hikvision", "hikvision") },
  { pattern: /\b(dahua)\b/i, entry: entry("Dahua", "dahua") },
  { pattern: /\b(canon)\b/i, entry: entry("Canon", "canon") },
  { pattern: /\b(epson)\b/i, entry: entry("Epson", "epson") },
  { pattern: /\b(brother)\b/i, entry: entry("Brother", "brother") },
];

export function normalizeMac(mac: string): string {
  const compact = mac.trim().replace(/[^0-9a-f]/gi, "").toUpperCase();
  if (compact.length === 12) return compact.match(/.{2}/g)?.join(":") ?? mac.trim().toUpperCase();
  return mac.trim().toUpperCase().replace(/-/g, ":");
}

function prefix(mac: string): string {
  return normalizeMac(mac).toLowerCase().slice(0, 8);
}

function cacheKey(mac: string): string {
  return prefix(mac);
}

function readCache(): Record<string, OuiEntry> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(OUI_CACHE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, OuiEntry>) : {};
  } catch {
    return {};
  }
}

function writeCache(cache: Record<string, OuiEntry>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(OUI_CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* caché no disponible */
  }
}

export function cacheOui(mac: string, vendor: string, brand: VendorBrand = "unknown"): OuiEntry {
  const normalized = normalizeMac(mac);
  const cached = { vendor, brand };
  const cache = readCache();
  cache[cacheKey(normalized)] = cached;
  writeCache(cache);
  return cached;
}

export function lookupByHostname(hostname?: string | null): OuiEntry | null {
  const text = hostname?.trim();
  if (!text) return null;
  return HOSTNAME_RULES.find((rule) => rule.pattern.test(text))?.entry ?? null;
}

/** Etiqueta usada cuando la MAC es aleatoria/privada y no identifica al fabricante. */
export const PRIVATE_MAC_LABEL = "MAC privada (Móvil/Portátil)";
const PRIVATE_MAC_ENTRY: OuiEntry = { vendor: PRIVATE_MAC_LABEL, brand: "unknown" };

export function lookupOui(mac: string, hostname?: string | null): OuiEntry {
  const normalized = normalizeMac(mac);
  const local = OUI[prefix(normalized)];
  if (local) return local;
  const cached = readCache()[cacheKey(normalized)];
  if (cached) return cached;
  const byHost = lookupByHostname(hostname);
  if (byHost) return byHost;
  if (isRandomizedMac(normalized)) return PRIVATE_MAC_ENTRY;
  return UNKNOWN_VENDOR;
}

/** Consulta al agente local (sin CORS ni bloqueos del navegador). */
async function resolveViaAgent(mac: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(
      `http://localhost:8765/vendor?mac=${encodeURIComponent(mac)}`,
      { signal: controller.signal, cache: "no-store" },
    );
    clearTimeout(timer);
    if (!res.ok) return "";
    const body = (await res.json()) as { vendor?: string };
    return body.vendor?.trim() ?? "";
  } catch {
    return "";
  }
}

export async function resolveVendor(mac: string, hostname?: string | null): Promise<OuiEntry> {
  const local = lookupOui(mac, hostname);
  if (local.brand !== "unknown") return local;

  const normalized = normalizeMac(mac);

  // Una MAC aleatoria no pertenece a ningún fabricante: no se consulta Internet.
  if (!OUI[prefix(normalized)] && isRandomizedMac(normalized)) {
    return lookupByHostname(hostname) ?? PRIVATE_MAC_ENTRY;
  }

  const fromAgent = await resolveViaAgent(normalized);
  if (fromAgent && !/not found|unknown/i.test(fromAgent)) {
    return cacheOui(normalized, fromAgent, brandFromVendorName(fromAgent));
  }

  const urls = [
    `https://api.macvendors.com/${encodeURIComponent(normalized)}`,
    `https://api.maclookup.app/v2/macs/${encodeURIComponent(normalized)}`,
  ];

  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 900);
      const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
      clearTimeout(timer);
      if (!res.ok) continue;
      const contentType = res.headers.get("content-type") ?? "";
      const body = contentType.includes("application/json") ? await res.json() : await res.text();
      const vendor =
        typeof body === "string"
          ? body.trim()
          : (body as { company?: string; vendorDetails?: { companyName?: string } }).company ??
            (body as { company?: string; vendorDetails?: { companyName?: string } }).vendorDetails
              ?.companyName ??
            "";
      if (!vendor || /not found|unknown/i.test(vendor)) continue;
      return cacheOui(normalized, vendor, brandFromVendorName(vendor));
    } catch {
      /* siguiente proveedor */
    }
  }

  const byHost = lookupByHostname(hostname);
  return byHost ? cacheOui(normalized, byHost.vendor, byHost.brand) : local;
}

export function vendorFromMac(mac: string, hostname?: string | null): string {
  return lookupOui(mac, hostname).vendor;
}

export function brandFromMac(mac: string, hostname?: string | null): VendorBrand {
  return lookupOui(mac, hostname).brand;
}

export function brandFromVendorName(vendor: string): VendorBrand {
  const found = lookupByHostname(vendor);
  return found?.brand ?? "unknown";
}

/** ¿Es una MAC aleatorizada por privacidad? (segundo bit del primer octeto) */
export function isRandomizedMac(mac: string): boolean {
  const first = parseInt(normalizeMac(mac).slice(0, 2), 16);
  return Number.isFinite(first) ? (first & 0x02) === 0x02 : false;
}

/** Nombre sugerido automáticamente a partir del fabricante y la IP. */
export function suggestedName(mac: string, ip: string, hostname?: string | null): string {
  const hostName = hostname?.trim();
  if (hostName) return hostName;
  const { vendor, brand } = lookupOui(mac, hostname);
  const host = ip.split(".").pop() ?? "?";
  if (brand === "unknown") return `Dispositivo ${host}`;
  return `${vendor} ${host}`;
}
