import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { networkInterfaces } from "node:os";
import { readFile } from "node:fs/promises";
import type { NetworkInterface } from "./types";
const exec = promisify(execFile);
const macPattern = /^[0-9a-f]{2}(?::[0-9a-f]{2}){5}$/i;
export function privateIp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parts = value.split(".");
  if (parts.length !== 4 || parts.some((p) => !/^\d{1,3}$/.test(p) || Number(p) > 255))
    return false;
  const [a, b] = parts.map(Number);
  return a === 10 || (a === 192 && b === 168) || (a === 172 && b! >= 16 && b! <= 31);
}
export function inSubnet(ip: string, cidr: string): boolean {
  if (!privateIp(ip)) return false;
  const [address, prefix] = cidr.split("/");
  const bits = Number(prefix);
  if (!address || !privateIp(address) || !Number.isInteger(bits) || bits < 1 || bits > 32)
    return false;
  const number = (s: string) => s.split(".").reduce((n, p) => (n << 8) | Number(p), 0) >>> 0;
  const mask = bits === 32 ? 0xffffffff : (0xffffffff << (32 - bits)) >>> 0;
  return (number(ip) & mask) === (number(address) & mask);
}
export async function discoverInterfaces(): Promise<NetworkInterface[]> {
  let routes: Array<{ dev?: string; gateway?: string }> = [];
  try {
    routes = JSON.parse(
      (await exec("ip", ["-j", "-4", "route", "show", "default"], { timeout: 3000 })).stdout,
    );
  } catch {
    /* shown as no gateway */
  }
  const result: NetworkInterface[] = [];
  for (const [name, addresses] of Object.entries(networkInterfaces())) {
    if (!/^[a-zA-Z0-9_.:-]{1,40}$/.test(name) || /^(lo|docker|veth|br-|tun|tap)/.test(name))
      continue;
    for (const address of addresses ?? []) {
      if (
        address.internal ||
        address.family !== "IPv4" ||
        !privateIp(address.address) ||
        !address.cidr
      )
        continue;
      const route = routes.find((r) => r.dev === name && privateIp(r.gateway));
      result.push({
        name,
        address: address.address,
        cidr: address.cidr,
        gateway: route?.gateway ?? null,
      });
    }
  }
  return result;
}
export function parseArpScan(output: string, network: NetworkInterface) {
  const found = new Map<string, { ip: string; mac: string; online: boolean }>();
  for (const line of output.split(/\r?\n/)) {
    const [ip, mac] = line.trim().split(/\s+/);
    if (
      ip &&
      mac &&
      inSubnet(ip, network.cidr) &&
      macPattern.test(mac) &&
      mac !== "ff:ff:ff:ff:ff:ff"
    )
      found.set(mac.toLowerCase(), { ip, mac: mac.toLowerCase(), online: true });
  }
  return [...found.values()];
}
export async function scanNetwork(network: NetworkInterface) {
  const prefix = Number(network.cidr.split("/")[1]);
  if (!Number.isInteger(prefix) || prefix < 22)
    throw new Error(
      "La subred es demasiado grande para el escaneo automático (máximo 1024 direcciones). Selecciona una interfaz con una subred más pequeña.",
    );
  const { stdout } = await exec(
    "arp-scan",
    ["--interface", network.name, "--localnet", "--retry=2", "--timeout=500", "--quiet"],
    { timeout: 30000, maxBuffer: 2 * 1024 * 1024 },
  );
  const devices = parseArpScan(stdout, network);
  let mac = "";
  try {
    mac = (await readFile(`/sys/class/net/${network.name}/address`, "utf8")).trim();
  } catch {
    /* unavailable */
  }
  if (macPattern.test(mac)) devices.push({ ip: network.address, mac, online: true });
  return devices;
}
export async function ping(
  ip: string,
  publicTarget = false,
): Promise<{ ok: boolean; rtt: number | null }> {
  if (!privateIp(ip) && !(publicTarget && ["1.1.1.1", "8.8.8.8"].includes(ip)))
    throw new Error("Dirección de destino no permitida.");
  try {
    const { stdout } = await exec("ping", ["-n", "-c", "1", "-W", "2", ip], { timeout: 3000 });
    const time = stdout.match(/time[=<]([\d.]+)\s*ms/i);
    return { ok: true, rtt: time ? Number(time[1]) : null };
  } catch {
    return { ok: false, rtt: null };
  }
}
export class TrafficSampler {
  private previous: { rx: number; tx: number; at: number } | null = null;
  async read(network: NetworkInterface | undefined) {
    const unavailable = { rxMbps: 0, txMbps: 0, available: false, at: Date.now() };
    if (!network) {
      this.previous = null;
      return unavailable;
    }
    try {
      const [rx, tx] = await Promise.all(
        ["rx_bytes", "tx_bytes"].map((key) =>
          readFile(`/sys/class/net/${network.name}/statistics/${key}`, "utf8").then(Number),
        ),
      );
      const current = { rx: rx!, tx: tx!, at: performance.now() };
      const old = this.previous;
      this.previous = current;
      if (
        !old ||
        !Number.isFinite(old.rx) ||
        !Number.isFinite(old.tx) ||
        !Number.isFinite(current.rx) ||
        !Number.isFinite(current.tx) ||
        current.rx < old.rx ||
        current.tx < old.tx ||
        current.at <= old.at
      )
        return unavailable;
      return {
        rxMbps: ((current.rx - old.rx) * 8) / (current.at - old.at) / 1000,
        txMbps: ((current.tx - old.tx) * 8) / (current.at - old.at) / 1000,
        available: true,
        at: Date.now(),
      };
    } catch {
      this.previous = null;
      return unavailable;
    }
  }
  reset() {
    this.previous = null;
  }
}
