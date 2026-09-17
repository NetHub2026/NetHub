import { type Device, type DeviceType } from "./devices";
import { lookupOui, normalizeMac, suggestedName } from "./oui";

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
}

function guessType(name: string, vendor: string): DeviceType {
  const text = `${name} ${vendor}`.toLowerCase();
  if (/playstation|xbox|nintendo|switch|steam|sony interactive|valve|microsoft/.test(text))
    return "console";
  if (/tv|roku|chromecast|firestick|bravia|lg electronics|samsung/.test(text)) return "tv";
  if (/home.?assistant|hass|raspberry/.test(text)) return "home-assistant";
  if (/pc|desktop|laptop|macbook|apple|asus|msi|lenovo|dell|intel/.test(text)) return "pc";
  return "iot";
}

function makeDevice(ip: string, mac: string, extra: Partial<Device> = {}): Device {
  const normalizedMac = normalizeMac(mac);
  const oui = lookupOui(normalizedMac);
  const vendor = extra.vendor || oui.vendor;
  const name = extra.name || suggestedName(normalizedMac, ip);
  return {
    id: normalizedMac || ip,
    name,
    type: extra.type ?? guessType(name, vendor),
    ip,
    mac: normalizedMac,
    status: extra.status ?? "online",
    vendor,
    brand: oui.brand,
    lastSeen: extra.lastSeen ?? "Detectado en el último escaneo",
    downstream: extra.downstream ?? 0,
    upstream: extra.upstream ?? 0,
    tags: extra.tags ?? ["Escaneado"],
  };
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
    const device = makeDevice(ip, mac, extra);
    found.set(device.id, device);
  }
  return [...found.values()].sort((a, b) => a.ip.localeCompare(b.ip, undefined, { numeric: true }));
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
      return { ...fresh, firstSeenAt: now, isNew: true, trusted: false };
    }
    const brand = old.brand ?? fresh.brand;
    const result: Device = {
      ...old,
      ip: fresh.ip,
      status: fresh.status,
      lastSeen: fresh.lastSeen,
      vendor: old.vendor || fresh.vendor,
      firstSeenAt: old.firstSeenAt ?? now,
      isNew: old.trusted ? false : (old.isNew ?? false),
      ...(brand ? { brand } : {}),
    };
    return result;
  });

  const missing = previous
    .filter((d) => !seen.has(d.id))
    .map((d) => ({ ...d, status: "offline" as const, downstream: 0, upstream: 0 }));

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
    return raw ? (JSON.parse(raw) as Device[]) : null;
  } catch {
    return null;
  }
}

export function saveDevices(devices: Device[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(devices));
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

export const pythonAgentScript = `# nethub_agent.py — agente de escaneo ARP para Windows
# Requisitos: Python 3.9+ (no necesita dependencias externas)
# Uso:  python nethub_agent.py     ->  http://localhost:8765/scan
import json, re, subprocess
from http.server import BaseHTTPRequestHandler, HTTPServer

IP_RE = re.compile(r"(\\d{1,3}(?:\\.\\d{1,3}){3})")
MAC_RE = re.compile(r"([0-9a-fA-F]{2}(?:[:-][0-9a-fA-F]{2}){5})")


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
    return hosts


class Handler(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        if self.path.rstrip("/") != "/scan":
            self.send_response(404)
            self._cors()
            self.end_headers()
            return
        body = json.dumps({"devices": scan()}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self._cors()
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    print("NetHub agent escuchando en http://localhost:8765/scan")
    HTTPServer(("127.0.0.1", 8765), Handler).serve_forever()
`;

export const powershellAgentScript = `# nethub-agent.ps1 — agente de escaneo ARP para Windows (PowerShell 5+)
# Uso:  powershell -ExecutionPolicy Bypass -File .\\nethub-agent.ps1
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://localhost:8765/")
$listener.Start()
Write-Host "NetHub agent escuchando en http://localhost:8765/scan"

function Get-ArpDevices {
  $rows = @()
  if (Get-Command Get-NetNeighbor -ErrorAction SilentlyContinue) {
    $rows = Get-NetNeighbor -AddressFamily IPv4 |
      Where-Object { $_.State -ne 'Unreachable' -and $_.LinkLayerAddress -notmatch '^(00-00-00|FF-FF-FF)' } |
      ForEach-Object {
        @{ ip = $_.IPAddress; mac = ($_.LinkLayerAddress -replace '-', ':'); online = $true }
      }
  } else {
    $rows = (arp -a) | ForEach-Object {
      if ($_ -match '(\\d{1,3}(\\.\\d{1,3}){3})\\s+([0-9a-fA-F-]{17})') {
        @{ ip = $matches[1]; mac = ($matches[3].ToUpper() -replace '-', ':'); online = $true }
      }
    }
  }
  return @($rows | Where-Object { $_ -ne $null })
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

  if ($ctx.Request.Url.AbsolutePath.TrimEnd('/') -ne "/scan") {
    $res.StatusCode = 404
    $res.Close()
    continue
  }

  $json = @{ devices = (Get-ArpDevices) } | ConvertTo-Json -Depth 4
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
  $res.ContentType = "application/json"
  $res.ContentLength64 = $bytes.Length
  $res.OutputStream.Write($bytes, 0, $bytes.Length)
  $res.Close()
}
`;
