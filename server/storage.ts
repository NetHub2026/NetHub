import { mkdir, readFile, open, rename, copyFile, readdir, unlink, lstat } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import type { ServerState } from "./types";
import { emptyPatternState, sanitizePatterns } from "../src/lib/patterns";
import { sanitizeEvents } from "../src/lib/activity";
import { emptyUsageState, sanitizeUsage } from "../src/lib/usage";
import { sanitizeDevices } from "../src/lib/scanner";
import { sanitizeSpeedHistory, speedHistoryLimit } from "../src/lib/speed-history";
import type { Device } from "../src/lib/devices";
import { activityLabels } from "../src/lib/activity";
function storedDevices(value: unknown): Device[] {
  if (!Array.isArray(value)) throw new Error("Inventario no válido.");
  let count = 0;
  const normalize = (items: any[], depth: number): Device[] => {
    if (depth > 4) throw new Error("Demasiadas fichas anidadas.");
    const ids = new Set<string>();
    return sanitizeDevices(
      items.map((item) => {
        if (
          ++count > 5000 ||
          !item ||
          typeof item !== "object" ||
          ["id", "name", "ip", "mac"].some(
            (k) => typeof item[k] !== "string" || item[k].length > 200,
          ) ||
          !item.id ||
          ["__proto__", "constructor", "prototype"].includes(item.id) ||
          ids.has(item.id)
        )
          throw new Error("Ficha de inventario no válida.");
        ids.add(item.id);
        for (const key of ["vendor", "person", "location", "notes", "networkId", "lastSeen"])
          if (item[key] !== undefined && item[key] !== null && typeof item[key] !== "string")
            throw new Error("Texto de ficha no válido.");
        const device = {
          ...item,
          vendor: item.vendor ?? "",
          lastSeen: item.lastSeen ?? "",
          status: item.status === "online" ? "online" : "offline",
          downstream: 0,
          upstream: 0,
          tags: Array.isArray(item.tags)
            ? item.tags.filter((t: unknown) => typeof t === "string").slice(0, 40)
            : [],
        } as Device;
        if (item.networkEntries !== undefined) {
          if (!Array.isArray(item.networkEntries))
            throw new Error("Conexiones asociadas no válidas.");
          device.networkEntries = normalize(item.networkEntries, depth + 1);
        }
        if (item.services !== undefined)
          device.services = Array.isArray(item.services)
            ? item.services
                .filter(
                  (s: any) =>
                    s &&
                    Number.isInteger(s.port) &&
                    s.port > 0 &&
                    s.port < 65536 &&
                    typeof s.label === "string" &&
                    typeof s.hint === "string" &&
                    (s.url === null || (typeof s.url === "string" && /^https?:\/\//.test(s.url))),
                )
                .slice(0, 30)
            : [];
        if (item.latency !== undefined)
          device.latency = Array.isArray(item.latency)
            ? item.latency
                .filter(
                  (s: any) =>
                    s &&
                    typeof s.at === "string" &&
                    (s.rtt === null || (Number.isFinite(s.rtt) && s.rtt >= 0)),
                )
                .slice(-30)
            : [];
        if (item.roomPosition !== undefined) {
          const p = item.roomPosition;
          if (
            !p ||
            typeof p.room !== "string" ||
            !Number.isFinite(p.x) ||
            !Number.isFinite(p.y) ||
            p.x < 0 ||
            p.x > 100 ||
            p.y < 0 ||
            p.y > 100
          )
            delete device.roomPosition;
        }
        return device;
      }),
    );
  };
  return normalize(value, 0);
}
export function emptyState(): ServerState {
  return {
    schema: 1,
    revision: 0,
    devices: [],
    events: [],
    patterns: emptyPatternState(),
    usage: emptyUsageState(),
    health: [],
    speedHistory: [],
    settings: {
      scanIntervalSeconds: 30,
      healthIntervalSeconds: 30,
      speedIntervalMinutes: 0,
      speedHistoryLimit: 10,
      interfaceName: "",
      contractedMbps: 0,
      people: [],
      locations: [],
    },
    lastScanAt: null,
    lastScanError: null,
    lastHealthError: null,
    lastSpeedError: null,
  };
}
export function normalizeState(parsed: Record<string, any>): ServerState {
  const base = emptyState(),
    settings = parsed["settings"] ?? {};
  const names = (value: unknown) =>
    Array.isArray(value)
      ? [
          ...new Set(
            value
              .filter((v) => typeof v === "string" && v.trim() && v.length <= 100)
              .map((v) => v.trim()),
          ),
        ].slice(0, 200)
      : [];
  const interval = (value: unknown, allowed: number[], fallback: number) =>
    allowed.includes(Number(value)) ? Number(value) : fallback;
  const recent = Array.isArray(parsed["speedHistory"]) ? parsed["speedHistory"] : [];
  const history =
    parsed["speedHistoryUnified"] === true
      ? recent
      : [
          ...recent,
          ...(Array.isArray(parsed["sla"])
            ? parsed["sla"]
                .filter((r) => r && typeof r === "object")
                .map((r) => ({
                  ...r,
                  jitter: 0,
                  peakDownload: r.download,
                  peakUpload: r.upload,
                  migratedSla: true,
                }))
            : []),
        ];
  return {
    ...base,
    revision:
      Number.isSafeInteger(parsed["revision"]) && parsed["revision"] >= 0 ? parsed["revision"] : 0,
    devices: storedDevices(parsed["devices"]),
    events: sanitizeEvents(parsed["events"]).filter(
      (e) =>
        Object.hasOwn(activityLabels, e.kind) &&
        typeof e.id === "string" &&
        typeof e.name === "string" &&
        typeof e.ip === "string",
    ),
    usage: sanitizeUsage(parsed["usage"]),
    patterns: sanitizePatterns(parsed["patterns"]),
    speedHistory: sanitizeSpeedHistory(history),
    health: Array.isArray(parsed["health"])
      ? parsed["health"]
          .filter(
            (s: any) =>
              s &&
              typeof s.at === "string" &&
              Number.isFinite(Date.parse(s.at)) &&
              ["gateway", "secondary", "internet"].every(
                (k) => s[k] === null || (Number.isFinite(s[k]) && s[k] >= 0),
              ),
          )
          .slice(-2880)
      : [],
    settings: {
      scanIntervalSeconds: interval(settings.scanIntervalSeconds, [0, 30, 60, 120, 300, 600], 30),
      healthIntervalSeconds: interval(settings.healthIntervalSeconds, [0, 15, 30, 60, 120], 30),
      speedIntervalMinutes: interval(settings.speedIntervalMinutes, [0, 120, 360, 720, 1440], 0),
      speedHistoryLimit: speedHistoryLimit(
        settings.speedHistoryLimit ?? parsed["speedHistoryLimit"],
      ),
      interfaceName:
        typeof settings.interfaceName === "string" &&
        /^[a-zA-Z0-9_.:-]{0,40}$/.test(settings.interfaceName)
          ? settings.interfaceName
          : "",
      contractedMbps:
        typeof settings.contractedMbps === "number" &&
        Number.isFinite(settings.contractedMbps) &&
        settings.contractedMbps >= 0 &&
        settings.contractedMbps <= 100000
          ? settings.contractedMbps
          : 0,
      people: names(settings.people ?? parsed["people"]),
      locations: names(settings.locations ?? parsed["locations"]),
    },
    ...Object.fromEntries(
      ["lastScanAt", "lastScanError", "lastHealthError", "lastSpeedError"].map((k) => [
        k,
        typeof parsed[k] === "string" ? parsed[k].slice(0, 1000) : null,
      ]),
    ),
  };
}
export class StateStore {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(readonly directory: string) {}
  async load(): Promise<ServerState> {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    try {
      const parsed = JSON.parse(await readFile(join(this.directory, "server-state.json"), "utf8"));
      if (parsed.schema !== 1 || !Array.isArray(parsed.devices))
        throw new Error("Formato de datos de servidor incompatible.");
      return normalizeState(parsed);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyState();
      throw new Error(
        "No se pudo leer server-state.json. Se conserva el archivo: restaura una copia o corrige su formato antes de iniciar.",
      );
    }
  }
  save(state: ServerState): Promise<void> {
    const json = JSON.stringify(state, null, 2);
    const write = this.queue.then(async () => {
      const target = join(this.directory, "server-state.json");
      const temporary = target + ".tmp";
      const file = await open(temporary, "w", 0o600);
      try {
        await file.writeFile(json);
        await file.sync();
      } finally {
        await file.close();
      }
      await rename(temporary, target);
    });
    this.queue = write.catch(() => {});
    return write;
  }
  async listBackups() {
    await this.queue;
    const directory = join(this.directory, "backups");
    let names: string[];
    try {
      names = await readdir(directory);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
    const entries = [];
    for (const id of names
      .filter((n) => /^state-[0-9TZ-]+-[a-f0-9-]{36}\.json$/.test(n))
      .sort()
      .reverse()) {
      try {
        const data = JSON.parse(await readFile(join(directory, id), "utf8"));
        const info = await lstat(join(directory, id));
        if (!info.isFile()) continue;
        if (Array.isArray(data.devices))
          entries.push({
            id,
            at: info.mtime.toISOString(),
            devices: data.devices.length,
            bytes: info.size,
          });
      } catch {
        /* Damaged versions are not offered for restoration. */
      }
    }
    return entries;
  }
  async readBackup(id: string): Promise<unknown> {
    if (!/^state-[0-9TZ-]+-[a-f0-9-]{36}\.json$/.test(id)) throw new Error("Copia no válida.");
    await this.queue;
    const filename = join(this.directory, "backups", id);
    if (!(await lstat(filename)).isFile()) throw new Error("Copia no válida.");
    const parsed = JSON.parse(await readFile(filename, "utf8"));
    normalizeState(parsed);
    return parsed;
  }
  backup(): Promise<void> {
    const copy = this.queue.then(async () => {
      const target = join(this.directory, "server-state.backup.json");
      const temporary = target + ".tmp";
      await copyFile(join(this.directory, "server-state.json"), temporary);
      const file = await open(temporary, "r+");
      try {
        await file.sync();
      } finally {
        await file.close();
      }
      await rename(temporary, target);
      const archive = join(this.directory, "backups");
      await mkdir(archive, { recursive: true, mode: 0o700 });
      const name = `state-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID()}.json`;
      const archivedTemporary = join(archive, name + ".tmp");
      await copyFile(target, archivedTemporary);
      const archivedFile = await open(archivedTemporary, "r+");
      try {
        await archivedFile.sync();
      } finally {
        await archivedFile.close();
      }
      await rename(archivedTemporary, join(archive, name));
      const versions = (await readdir(archive))
        .filter((entry) => /^state-[0-9TZ-]+-[a-f0-9-]{36}\.json$/.test(entry))
        .sort()
        .reverse();
      for (const expired of versions.slice(7)) await unlink(join(archive, expired));
    });
    this.queue = copy.catch(() => {});
    return copy;
  }
}
