import { type Device, type DeviceType } from "./devices";
import {
  brandFromVendorName,
  lookupByHostname,
  lookupOui,
  normalizeMac,
  resolveVendor,
  suggestedName,
} from "./oui";

export { vendorFromMac, suggestedName, isRandomizedMac } from "./oui";

export const AGENT_URL = "http://localhost:8765/scan";
const STORAGE_KEY = "nethub.devices.v1";
const STORAGE_META_KEY = "nethub.scan-meta.v1";

export type ScannerStatus = "unknown" | "connected" | "disconnected" | "checking";

export interface ScanMeta {
  lastScanAt: string | null;
  source: "agent" | "native" | "arp" | "json" | "demo" | null;
}

/** Fila cruda que puede devolver el agente o un JSON importado. */
interface RawHost {
  ip?: string;
  address?: string;
  mac?: string;
  hw?: string;
  name?: string;
  hostname?: string;
  vendor?: string;
  type?: string;
  status?: string;
  online?: boolean;
  tags?: string[] | string;
}

function guessType(name: string, vendor: string): DeviceType {
  const text = `${name} ${vendor}`.toLowerCase();
  if (/playstation|xbox|nintendo|switch|steam|sony interactive|valve|microsoft/.test(text))
    return "console";
  if (/iphone|ipad|android|pixel|galaxy|phone|movil|m[oó]vil|tablet|xiaomi|redmi|poco|huawei|honor|oppo|oneplus/.test(text))
    return "phone";
  if (/tv|roku|chromecast|firestick|fire.?tv|bravia|webos|lg electronics|samsung/.test(text))
    return "tv";
  if (/home.?assistant|hass|raspberry/.test(text)) return "home-assistant";
  if (/router|gateway|fritz|livebox|sercomm|sagemcom|asuswrt|archer|deco|tp-link|netgear|ubiquiti|unifi|openwrt/.test(text))
    return "router";
  if (/printer|impresora|brother|epson|canon|laserjet|officejet|hp /.test(text))
    return "printer";
  if (/cam|camera|reolink|hikvision|dahua|tapo/.test(text)) return "camera";
  if (/echo|alexa|sonos|homepod|nest.?(mini|audio)|speaker|altavoz/.test(text))
    return "speaker";
  if (/pc|desktop|laptop|macbook|apple|asus|msi|lenovo|dell|intel/.test(text)) return "pc";
  return "iot";
}

function makeDevice(ip: string, mac: string, extra: Partial<Device> = {}): Device {
  const normalizedMac = normalizeMac(mac);
  const name = extra.name || suggestedName(normalizedMac, ip);
  const byHostname = lookupByHostname(name);
  const oui = lookupOui(normalizedMac, name);
  const vendor = extra.vendor || byHostname?.vendor || oui.vendor;
  const vendorBrand = brandFromVendorName(vendor);
  const brand = extra.brand ?? (vendorBrand !== "unknown" ? vendorBrand : byHostname?.brand ?? oui.brand);
  return {
    id: normalizedMac || ip,
    name,
    type: extra.type ?? guessType(name, vendor),
    ip,
    mac: normalizedMac,
    status: extra.status ?? "online",
    vendor,
    brand,
    lastSeen: extra.lastSeen ?? "Detectado en el último escaneo",
    downstream: extra.downstream ?? 0,
    upstream: extra.upstream ?? 0,
    tags: sanitizeTags(extra.tags),
  };
}

/** Etiquetas automáticas que ya no queremos mostrar en la interfaz. */
const REMOVED_TAGS = ["escaneado"];

/** Quita etiquetas obsoletas (p. ej. "Escaneado") de una lista de etiquetas. */
export function sanitizeTags(tags?: string[]): string[] {
  if (!Array.isArray(tags)) return [];
  return tags.filter((tag) => !REMOVED_TAGS.includes(String(tag).trim().toLowerCase()));
}

/** Limpia las etiquetas obsoletas de una lista de dispositivos guardada. */
export function sanitizeDevices(devices: Device[]): Device[] {
  return devices.map((device) => ({ ...device, tags: sanitizeTags(device.tags) }));
}

export async function enrichDevicesWithResolvedVendors(devices: Device[]): Promise<Device[]> {
  return devices.map((device) => {
    if (device.manualEdit || (device.brand && device.brand !== "unknown")) return device;
    const resolved = lookupOui(device.mac, device.name);
    if (resolved.brand === "unknown" && resolved.vendor === "Fabricante desconocido") {
      return device;
    }
    return { ...device, vendor: resolved.vendor, brand: resolved.brand };
  });
}

/** Convierte la salida de `arp -a` (Windows o Linux/macOS) en dispositivos. */
export function parseArpOutput(text: string): Device[] {
  const ipRe = /(\d{1,3}(?:\.\d{1,3}){3})/;
  const macRe = /([0-9a-f]{2}(?:[:-][0-9a-f]{2}){5})/i;
  const found = new Map<string, Device>();

  for (const line of text.split(/\r?\n/)) {
    const ip = line.match(ipRe)?.[1];
    const mac = line.match(macRe)?.[1];
    if (!ip || !mac) continue;
    if (/ff:ff:ff:ff:ff:ff|ff-ff-ff-ff-ff-ff/i.test(mac)) continue;
    if (/^2(2[4-9]|3\d)\./.test(ip) || ip.endsWith(".255")) continue;
    const device = makeDevice(ip, mac);
    found.set(device.id, device);
  }
  return [...found.values()].sort((a, b) => a.ip.localeCompare(b.ip, undefined, { numeric: true }));
}

/** Normaliza un JSON del agente o importado a `Device[]`. */
export function parseHostsJson(input: unknown): Device[] {
  const list: RawHost[] = Array.isArray(input)
    ? (input as RawHost[])
    : ((input as { devices?: RawHost[]; hosts?: RawHost[] })?.devices ??
        (input as { hosts?: RawHost[] })?.hosts ??
        []);

  const found = new Map<string, Device>();
  for (const raw of list) {
    const ip = raw.ip ?? raw.address;
    const mac = raw.mac ?? raw.hw;
    if (!ip || !mac) continue;
    const online = raw.online ?? (raw.status ? raw.status !== "offline" : true);
    const extra: Partial<Device> = { status: online ? "online" : "offline" };
    const rawName = raw.name ?? raw.hostname;
    if (rawName) extra.name = rawName;
    if (raw.vendor) extra.vendor = raw.vendor;
    if (raw.type) extra.type = raw.type as DeviceType;
    if (Array.isArray(raw.tags)) extra.tags = raw.tags;
    if (typeof raw.tags === "string") extra.tags = [raw.tags];
    const device = makeDevice(ip, mac, extra);
    found.set(device.id, device);
  }
  return [...found.values()].sort((a, b) => a.ip.localeCompare(b.ip, undefined, { numeric: true }));
}

export function resolveVendorsInBackground(
  devices: Device[],
  onResolved: (devices: Device[]) => void,
) {
  if (typeof window === "undefined") return;
  const pending = devices.filter((device) => {
    if (device.manualEdit || (device.brand && device.brand !== "unknown")) return false;
    const local = lookupOui(device.mac, device.name);
    return local.brand === "unknown";
  });
  if (pending.length === 0) return;

  window.setTimeout(() => {
    void Promise.all(
      pending.map(async (device) => {
        const resolved = await resolveVendor(device.mac, device.name);
        if (resolved.brand === "unknown" && resolved.vendor === "Fabricante desconocido") {
          return device;
        }
        return { ...device, vendor: resolved.vendor, brand: resolved.brand };
      }),
    ).then(onResolved);
  }, 0);
}

/**
 * Fusiona un escaneo nuevo con la lista conocida:
 * - conserva nombre editado, etiquetas, notas, controles y confianza;
 * - marca como `isNew` los dispositivos vistos por primera vez;
 * - deja como `offline` los conocidos que ya no aparecen.
 */
export function mergeScan(previous: Device[], scanned: Device[]): Device[] {
  const now = new Date().toISOString();
  const byId = new Map(previous.map((d) => [d.id, d]));
  const seen = new Set(scanned.map((d) => d.id));

  const merged: Device[] = scanned.map((fresh) => {
    const old = byId.get(fresh.id);
    if (!old) {
      return {
        ...fresh,
        tags: sanitizeTags(fresh.tags),
        firstSeenAt: now,
        isNew: true,
        trusted: false,
      };
    }
    const freshVendorIsKnown = fresh.vendor && fresh.vendor !== "Fabricante desconocido";
    const vendor = old.manualEdit ? old.vendor : freshVendorIsKnown ? fresh.vendor : old.vendor;
    const brand = old.manualEdit
      ? old.brand
      : fresh.brand && fresh.brand !== "unknown"
        ? fresh.brand
        : old.brand;
    const result: Device = {
      ...old,
      tags: sanitizeTags(old.tags),
      ip: fresh.ip,
      status: fresh.status,
      lastSeen: fresh.lastSeen,
      // El nombre, tipo y fabricante editados a mano nunca se sobrescriben.
      name: old.name,
      type: old.type,
      vendor,
      firstSeenAt: old.firstSeenAt ?? now,
      isNew: old.trusted ? false : (old.isNew ?? false),
      ...(brand ? { brand } : {}),
    };
    return result;
  });

  const missing = previous
    .filter((d) => !seen.has(d.id))
    .map((d) => ({
      ...d,
      tags: sanitizeTags(d.tags),
      status: "offline" as const,
      downstream: 0,
      upstream: 0,
    }));

  return [...merged, ...missing].sort((a, b) =>
    a.ip.localeCompare(b.ip, undefined, { numeric: true }),
  );
}

/** Dispositivos detectados por primera vez y todavía no marcados como conocidos. */
export function newDevices(devices: Device[]): Device[] {
  return devices.filter((d) => d.isNew && !d.trusted);
}



/** Consulta al agente local. Lanza error si no responde. */
export async function fetchFromAgent(signal?: AbortSignal): Promise<Device[]> {
  const res = await fetch(AGENT_URL, {
    ...(signal ? { signal } : {}),
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`El agente respondió ${res.status}`);
  return parseHostsJson(await res.json());
}

export async function pingAgent(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(AGENT_URL, { signal: controller.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

export function loadStoredDevices(): Device[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? sanitizeDevices(JSON.parse(raw) as Device[]) : null;
  } catch {
    return null;
  }
}

export function saveDevices(devices: Device[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizeDevices(devices)));
  } catch {
    /* almacenamiento no disponible */
  }
}

export function loadScanMeta(): ScanMeta {
  if (typeof window === "undefined") return { lastScanAt: null, source: null };
  try {
    const raw = window.localStorage.getItem(STORAGE_META_KEY);
    return raw ? (JSON.parse(raw) as ScanMeta) : { lastScanAt: null, source: null };
  } catch {
    return { lastScanAt: null, source: null };
  }
}

export function saveScanMeta(meta: ScanMeta) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_META_KEY, JSON.stringify(meta));
  } catch {
    /* almacenamiento no disponible */
  }
}

export function clearStoredData() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
  window.localStorage.removeItem(STORAGE_META_KEY);
}

export function formatScanTime(iso: string | null): string {
  if (!iso) return "sin escaneos";
  const d = new Date(iso);
  return d.toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const pythonAgentScript = `# nethub_agent.py — agente de escaneo ARP + ping + Wake-on-LAN para Windows
# Requisitos: Python 3.9+ (no necesita dependencias externas)
# Endpoints:  /scan   /ping?ip=192.168.1.20   /wol?mac=AA:BB:CC:DD:EE:FF   /vendor?mac=AA:BB:CC:DD:EE:FF
import json, os, re, socket, subprocess, time, urllib.request, uuid
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs

TIME_RE = re.compile(r"(?:tiempo|time)[=<]\\s*(\\d+(?:[.,]\\d+)?)\\s*ms", re.IGNORECASE)

IP_RE = re.compile(r"(\\d{1,3}(?:\\.\\d{1,3}){3})")
MAC_RE = re.compile(r"([0-9a-fA-F]{2}(?:[:-][0-9a-fA-F]{2}){5})")


def local_device():
    hostname = socket.gethostname()
    ip = "127.0.0.1"
    try:
        probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        probe.connect(("8.8.8.8", 80))
        ip = probe.getsockname()[0]
        probe.close()
    except Exception:
        try:
            ip = socket.gethostbyname(hostname)
        except Exception:
            pass

    mac_int = uuid.getnode()
    mac = ":".join(f"{(mac_int >> shift) & 0xff:02X}" for shift in range(40, -1, -8))
    return {
        "ip": ip,
        "mac": mac,
        "name": hostname,
        "type": "pc",
        "online": True,
        "tags": ["Este equipo", "Local"],
    }


def scan():
    out = subprocess.run(["arp", "-a"], capture_output=True, text=True, shell=True).stdout
    hosts, seen = [], set()
    for line in out.splitlines():
        ip = IP_RE.search(line)
        mac = MAC_RE.search(line)
        if not ip or not mac:
            continue
        mac_v = mac.group(1).upper().replace("-", ":")
        if mac_v == "FF:FF:FF:FF:FF:FF" or mac_v in seen:
            continue
        seen.add(mac_v)
        hosts.append({"ip": ip.group(1), "mac": mac_v, "online": True})
    local = local_device()
    hosts = [h for h in hosts if h.get("mac") != local["mac"]]
    hosts.append(local)
    return annotate_vendors(hosts)


def ping(ip):
    """Ping ICMP real: 1 paquete, 1 segundo de espera."""
    if not re.fullmatch(r"\\d{1,3}(?:\\.\\d{1,3}){3}", ip or ""):
        return {"ok": False, "rtt": None}
    out = subprocess.run(
        ["ping", "-n", "1", "-w", "1000", ip],
        capture_output=True, text=True, shell=True,
    ).stdout
    found = TIME_RE.search(out)
    if found:
        return {"ok": True, "rtt": float(found.group(1).replace(",", "."))}
    if "TTL=" in out.upper():
        return {"ok": True, "rtt": 0.0}
    return {"ok": False, "rtt": None}


def wol(mac):
    """Envía el Magic Packet de Wake-on-LAN por UDP al puerto 9 en difusión."""
    clean = re.sub(r"[^0-9a-fA-F]", "", mac or "")
    if len(clean) != 12:
        return False
    packet = b"\\xff" * 6 + bytes.fromhex(clean) * 16
    sent = False
    for target in ("255.255.255.255", "192.168.255.255"):
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
            sock.sendto(packet, (target, 9))
            sock.close()
            sent = True
        except Exception:
            pass
    return sent


# ---------------------------------------------------------------------------
# Resolución de fabricantes (OUI) por Internet, en el propio agente.
# Se consulta de forma secuencial y con pausa entre peticiones, y se guarda
# el resultado en vendor-cache.json junto al script.
# ---------------------------------------------------------------------------
CACHE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "vendor-cache.json")
try:
    with open(CACHE_FILE, "r", encoding="utf-8") as fh:
        VENDOR_CACHE = json.load(fh)
except Exception:
    VENDOR_CACHE = {}


def _save_cache():
    try:
        with open(CACHE_FILE, "w", encoding="utf-8") as fh:
            json.dump(VENDOR_CACHE, fh, indent=2)
    except Exception:
        pass


def is_private_mac(mac):
    """MAC aleatoria/privada: segundo bit del primer octeto activo."""
    clean = re.sub(r"[^0-9a-fA-F]", "", mac or "")
    if len(clean) < 2:
        return False
    return int(clean[:2], 16) & 0x02 == 0x02


def lookup_vendor(mac):
    clean = re.sub(r"[^0-9a-fA-F]", "", mac or "").upper()
    if len(clean) < 6:
        return ""
    key = clean[:6]
    if key in VENDOR_CACHE:
        return VENDOR_CACHE[key]
    if is_private_mac(mac):
        VENDOR_CACHE[key] = ""
        _save_cache()
        return ""

    vendor = ""
    for url in (
        "https://api.macvendors.com/" + clean,
        "https://api.maclookup.app/v2/macs/" + clean,
    ):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "NetHub-Agent"})
            with urllib.request.urlopen(req, timeout=4) as res:
                body = res.read().decode("utf-8", "ignore").strip()
            if body.startswith("{"):
                data = json.loads(body)
                vendor = (data.get("company") or data.get("vendor") or "").strip()
            else:
                vendor = body
            if vendor and "not found" not in vendor.lower():
                break
            vendor = ""
        except Exception:
            vendor = ""
        time.sleep(0.6)  # pausa para no ser bloqueado por límite de peticiones

    VENDOR_CACHE[key] = vendor
    _save_cache()
    return vendor


def annotate_vendors(hosts):
    for host in hosts:
        if host.get("vendor"):
            continue
        vendor = lookup_vendor(host.get("mac", ""))
        if vendor:
            host["vendor"] = vendor
        elif is_private_mac(host.get("mac", "")):
            host["vendor"] = "MAC privada (Móvil/Portátil)"
        time.sleep(0.2)
    return hosts



class Handler(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")

    def _json(self, payload, code=200):
        body = json.dumps(payload).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self._cors()
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        route = parsed.path.rstrip("/") or "/"
        query = parse_qs(parsed.query)

        if route == "/scan":
            self._json({"devices": scan()})
        elif route == "/ping":
            self._json(ping((query.get("ip") or [""])[0]))
        elif route == "/vendor":
            mac = (query.get("mac") or [""])[0]
            self._json({"mac": mac, "vendor": lookup_vendor(mac)})
        elif route == "/wol":
            ok = wol((query.get("mac") or [""])[0])
            self._json({"ok": ok}, 200 if ok else 400)
        else:
            self._json({"error": "not found"}, 404)

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    print("NetHub agent escuchando en http://localhost:8765 (/scan, /ping, /wol, /vendor)")
    HTTPServer(("127.0.0.1", 8765), Handler).serve_forever()
`;

export const powershellAgentScript = `# nethub-agent.ps1 — agente de escaneo ARP + ping + Wake-on-LAN (PowerShell 5+)
# Uso:  powershell -ExecutionPolicy Bypass -File .\\nethub-agent.ps1
# Endpoints:  /scan   /ping?ip=192.168.1.20   /wol?mac=AA:BB:CC:DD:EE:FF   /vendor?mac=AA:BB:CC:DD:EE:FF
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://localhost:8765/")
$listener.Start()
Write-Host "NetHub agent escuchando en http://localhost:8765 (/scan, /ping, /wol, /vendor)"

# --- Resolución de fabricantes (OUI) por Internet, dentro del propio agente ---
$VendorCacheFile = Join-Path $PSScriptRoot 'vendor-cache.json'
$VendorCache = @{}
if (Test-Path $VendorCacheFile) {
  try {
    (Get-Content $VendorCacheFile -Raw | ConvertFrom-Json).PSObject.Properties |
      ForEach-Object { $VendorCache[$_.Name] = $_.Value }
  } catch {}
}

function Save-VendorCache {
  try { ($VendorCache | ConvertTo-Json -Depth 3) | Set-Content -Path $VendorCacheFile -Encoding UTF8 } catch {}
}

function Test-PrivateMac($mac) {
  $clean = ($mac -replace '[^0-9a-fA-F]', '')
  if ($clean.Length -lt 2) { return $false }
  return (([Convert]::ToInt32($clean.Substring(0, 2), 16) -band 2) -eq 2)
}

function Get-VendorForMac($mac) {
  $clean = ($mac -replace '[^0-9a-fA-F]', '').ToUpper()
  if ($clean.Length -lt 6) { return '' }
  $key = $clean.Substring(0, 6)
  if ($VendorCache.ContainsKey($key)) { return $VendorCache[$key] }
  if (Test-PrivateMac $mac) { $VendorCache[$key] = ''; Save-VendorCache; return '' }

  $vendor = ''
  foreach ($url in @("https://api.macvendors.com/$clean", "https://api.maclookup.app/v2/macs/$clean")) {
    try {
      $resp = Invoke-RestMethod -Uri $url -TimeoutSec 4 -UseBasicParsing
      if ($resp -is [string]) { $vendor = $resp.Trim() }
      elseif ($resp.company) { $vendor = [string]$resp.company }
      elseif ($resp.vendor) { $vendor = [string]$resp.vendor }
      if ($vendor -and $vendor -notmatch '(?i)not found') { break }
      $vendor = ''
    } catch { $vendor = '' }
    Start-Sleep -Milliseconds 600   # pausa entre peticiones para evitar bloqueos
  }

  $VendorCache[$key] = $vendor
  Save-VendorCache
  return $vendor
}

function Add-VendorInfo($rows) {
  foreach ($row in $rows) {
    if (-not $row -or $row.vendor) { continue }
    $vendor = Get-VendorForMac $row.mac
    if ($vendor) { $row.vendor = $vendor }
    elseif (Test-PrivateMac $row.mac) { $row.vendor = 'MAC privada (Móvil/Portátil)' }
    Start-Sleep -Milliseconds 150
  }
  return $rows
}

function Get-NetBiosNameMap {
  $names = @{}
  try {
    (nbtstat -c) | ForEach-Object {
      $line = $_.Trim()
      if ($line -match '^([^\\s<]+)\\s+<\\d+>\\s+\\S+\\s+(\\d{1,3}(\\.\\d{1,3}){3})') {
        $name = $matches[1]
        $ip = $matches[2]
        if ($name -and $ip -and -not $names.ContainsKey($ip)) { $names[$ip] = $name }
      }
    }
  } catch {}
  return $names
}

function Get-LocalDevice {
  $computerName = $env:COMPUTERNAME
  try {
    $config = Get-NetIPConfiguration |
      Where-Object { $_.IPv4Address -and $_.NetAdapter.Status -eq 'Up' -and $_.NetAdapter.HardwareInterface } |
      Sort-Object { if ($_.IPv4DefaultGateway) { 0 } else { 1 } } |
      Select-Object -First 1
    if ($config -and $config.IPv4Address) {
      $ip = $config.IPv4Address.IPAddress
      $adapter = Get-NetAdapter -InterfaceIndex $config.InterfaceIndex -ErrorAction Stop
      $mac = ($adapter.MacAddress -replace '-', ':').ToUpper()
      return @{ ip = $ip; mac = $mac; name = $computerName; type = 'pc'; online = $true; tags = @('Este equipo', 'Local') }
    }
  } catch {}

  try {
    $adapter = Get-NetAdapter |
      Where-Object { $_.Status -eq 'Up' -and $_.MacAddress } |
      Select-Object -First 1
    $ip = [System.Net.Dns]::GetHostAddresses($computerName) |
      Where-Object { $_.AddressFamily -eq 'InterNetwork' -and $_.IPAddressToString -notlike '127.*' } |
      Select-Object -First 1
    if ($adapter -and $ip) {
      $mac = ($adapter.MacAddress -replace '-', ':').ToUpper()
      return @{ ip = $ip.IPAddressToString; mac = $mac; name = $computerName; type = 'pc'; online = $true; tags = @('Este equipo', 'Local') }
    }
  } catch {}
  return $null
}

function Get-ArpDevices {
  $rows = @()
  $nameMap = Get-NetBiosNameMap
  if (Get-Command Get-NetNeighbor -ErrorAction SilentlyContinue) {
    $rows = Get-NetNeighbor -AddressFamily IPv4 |
      Where-Object { $_.State -ne 'Unreachable' -and $_.LinkLayerAddress -notmatch '^(00-00-00|FF-FF-FF)' } |
      ForEach-Object {
        $item = @{ ip = $_.IPAddress; mac = ($_.LinkLayerAddress -replace '-', ':'); online = $true }
        $hostName = $nameMap[$_.IPAddress]
        if ($hostName) { $item.name = $hostName }
        $item
      }
  } else {
    $rows = (arp -a) | ForEach-Object {
      if ($_ -match '(\\d{1,3}(\\.\\d{1,3}){3})\\s+([0-9a-fA-F-]{17})') {
        $item = @{ ip = $matches[1]; mac = ($matches[3].ToUpper() -replace '-', ':'); online = $true }
        $hostName = $nameMap[$matches[1]]
        if ($hostName) { $item.name = $hostName }
        $item
      }
    }
  }
  $local = Get-LocalDevice
  if ($local) {
    $rows = @($rows | Where-Object { $_ -ne $null -and $_.mac -ne $local.mac })
    $rows += $local
  }
  return @($rows | Where-Object { $_ -ne $null })
}

function Invoke-PingHost($ip) {
  if (-not ($ip -match '^\\d{1,3}(\\.\\d{1,3}){3}$')) { return @{ ok = $false; rtt = $null } }
  try {
    $reply = (New-Object System.Net.NetworkInformation.Ping).Send($ip, 1000)
    if ($reply.Status -eq 'Success') { return @{ ok = $true; rtt = [int]$reply.RoundtripTime } }
  } catch {}
  return @{ ok = $false; rtt = $null }
}

function Send-WolPacket($mac) {
  $clean = ($mac -replace '[^0-9a-fA-F]', '')
  if ($clean.Length -ne 12) { return $false }
  try {
    $macBytes = New-Object byte[] 6
    for ($i = 0; $i -lt 6; $i++) { $macBytes[$i] = [Convert]::ToByte($clean.Substring($i * 2, 2), 16) }
    $packet = New-Object System.Collections.Generic.List[byte]
    for ($i = 0; $i -lt 6; $i++) { $packet.Add([byte]0xFF) }
    for ($i = 0; $i -lt 16; $i++) { $packet.AddRange($macBytes) }
    $bytes = $packet.ToArray()
    $udp = New-Object System.Net.Sockets.UdpClient
    $udp.EnableBroadcast = $true
    $udp.Connect([System.Net.IPAddress]::Broadcast, 9)
    [void]$udp.Send($bytes, $bytes.Length)
    $udp.Close()
    return $true
  } catch {}
  return $false
}

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $res = $ctx.Response
  $res.AddHeader("Access-Control-Allow-Origin", "*")
  $res.AddHeader("Access-Control-Allow-Methods", "GET, OPTIONS")
  $res.AddHeader("Access-Control-Allow-Headers", "*")

  if ($ctx.Request.HttpMethod -eq "OPTIONS") {
    $res.StatusCode = 204
    $res.Close()
    continue
  }

  $route = $ctx.Request.Url.AbsolutePath.TrimEnd('/')
  if ($route -eq '') { $route = '/' }
  $payload = $null

  switch ($route) {
    '/scan' { $payload = @{ devices = (Add-VendorInfo (Get-ArpDevices)) } }
    '/ping' { $payload = (Invoke-PingHost $ctx.Request.QueryString['ip']) }
    '/vendor' {
      $mac = $ctx.Request.QueryString['mac']
      $payload = @{ mac = $mac; vendor = (Get-VendorForMac $mac) }
    }
    '/wol'  { $payload = @{ ok = (Send-WolPacket $ctx.Request.QueryString['mac']) } }
    default { $payload = @{ error = 'not found' }; $res.StatusCode = 404 }
  }

  $json = $payload | ConvertTo-Json -Depth 4
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
  $res.ContentType = "application/json"
  $res.ContentLength64 = $bytes.Length
  $res.OutputStream.Write($bytes, 0, $bytes.Length)
  $res.Close()
}
`;
