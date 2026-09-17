import type { Device } from "./devices";
import { parseHostsJson } from "./scanner";

const CSV_COLUMNS = [
  "id",
  "name",
  "type",
  "ip",
  "mac",
  "status",
  "vendor",
  "brand",
  "networkId",
  "tags",
  "notes",
  "trusted",
  "blocked",
  "prioritized",
] as const;

function csvCell(value: unknown): string {
  const text = value === undefined || value === null ? "" : String(value);
  return /[",;\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function devicesToCsv(devices: Device[]): string {
  const rows = devices.map((d) =>
    [
      d.id,
      d.name,
      d.type,
      d.ip,
      d.mac,
      d.status,
      d.vendor,
      d.brand ?? "",
      d.networkId ?? "",
      d.tags.join(" | "),
      d.notes ?? "",
      d.trusted ? "sí" : "",
      d.blocked ? "sí" : "",
      d.prioritized ? "sí" : "",
    ]
      .map(csvCell)
      .join(","),
  );
  return [CSV_COLUMNS.join(","), ...rows].join("\n");
}

export function devicesToJson(devices: Device[]): string {
  return JSON.stringify({ app: "NetHub", exportedAt: new Date().toISOString(), devices }, null, 2);
}

function download(content: string, filename: string, mime: string) {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function stamp(): string {
  return new Date().toISOString().slice(0, 10);
}

export function exportInventoryJson(devices: Device[]) {
  download(devicesToJson(devices), `nethub-inventario-${stamp()}.json`, "application/json");
}

export function exportInventoryCsv(devices: Device[]) {
  download(devicesToCsv(devices), `nethub-inventario-${stamp()}.csv`, "text/csv");
}

/* ------------------------------------------------------------------ */
/* Restauración                                                        */
/* ------------------------------------------------------------------ */

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === "," || char === ";") {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells.map((c) => c.trim());
}

/** Convierte un CSV exportado por NetHub en dispositivos completos. */
export function parseBackupCsv(text: string): Device[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const header = splitCsvLine(lines[0]!).map((h) => h.toLowerCase());
  const index = (name: string) => header.indexOf(name);
  const devices: Device[] = [];

  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    const at = (name: string) => {
      const i = index(name);
      return i >= 0 ? (cells[i] ?? "") : "";
    };
    const ip = at("ip");
    const mac = at("mac");
    if (!ip && !mac) continue;
    const tags = at("tags")
      .split(/\s*\|\s*|\s*;\s*/)
      .map((t) => t.trim())
      .filter(Boolean);
    const device: Device = {
      id: at("id") || mac || ip,
      name: at("name") || ip,
      type: (at("type") || "other") as Device["type"],
      ip,
      mac,
      status: at("status") === "offline" ? "offline" : "online",
      vendor: at("vendor") || "Fabricante desconocido",
      lastSeen: "Restaurado desde copia de seguridad",
      downstream: 0,
      upstream: 0,
      tags,
      manualEdit: true,
    };
    const brand = at("brand");
    if (brand) device.brand = brand as NonNullable<Device["brand"]>;
    const networkId = at("networkid");
    if (networkId) device.networkId = networkId;
    const notes = at("notes");
    if (notes) device.notes = notes;
    if (at("trusted")) device.trusted = true;
    if (at("blocked")) device.blocked = true;
    if (at("prioritized")) device.prioritized = true;
    devices.push(device);
  }
  return devices;
}

/** Detecta el formato (JSON de copia, JSON de hosts o CSV) y devuelve dispositivos. */
export function parseBackup(text: string, filename = ""): Device[] {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      const list = Array.isArray(parsed)
        ? parsed
        : ((parsed as { devices?: unknown[] }).devices ?? []);
      const full = (list as Device[]).filter((d) => d && d.mac !== undefined && d.name !== undefined);
      if (full.length > 0 && full[0]!.type !== undefined) return full;
      return parseHostsJson(parsed);
    } catch {
      return [];
    }
  }
  if (filename.toLowerCase().endsWith(".csv") || /(^|\n)id,name,type,/i.test(trimmed)) {
    return parseBackupCsv(trimmed);
  }
  return parseBackupCsv(trimmed);
}
