import { evaluateWatches, normalizeWatch } from "../src/lib/device-watch";
import type { Device } from "../src/lib/devices";
import { deviceTypeLabels } from "../src/lib/devices";
import { loadIeeeRegistry } from "../src/lib/identity";
import { parseHostsJson, mergeScan } from "../src/lib/scanner";
import { appendEvents, diffActivity } from "../src/lib/activity";
import { evaluatePatterns, reviewAnomaly } from "../src/lib/patterns";
import { recordUsageScan } from "../src/lib/usage";
import { sanitizeSpeedHistory } from "../src/lib/speed-history";
import { unifyDevices, separateDevice, type MergeChoices } from "../src/lib/device-unification";
import { StateStore, normalizeState } from "./storage";
import { discoverInterfaces, scanNetwork, ping, TrafficSampler } from "./network";
import type { ServerState, ServerSnapshot, NetworkInterface, ServerSettings } from "./types";
import { measureSpeed } from "./speed";
export const EDITABLE_FIELDS = [
  "watch",
  "name",
  "vendor",
  "type",
  "person",
  "location",
  "notes",
  "tags",
  "connectionSource",
  "identityManual",
  "manualEdit",
  "roomPosition",
  "trusted",
  "isNew",
  "networkId",
  "brand",
  "latency",
  "services",
  "servicesScannedAt",
] as const;
type Options = {
  demo?: boolean;
  interfaces?: () => Promise<NetworkInterface[]>;
  scan?: typeof scanNetwork;
  ping?: typeof ping;
  now?: () => Date;
};
export class Monitor {
  state!: ServerState;
  readonly startedAt = new Date().toISOString();
  interfaces: NetworkInterface[] = [];
  scanning = false;
  speedRunning = false;
  speedProgress: { phase: string; value: number; progress: number } | null = null;
  traffic = { rxMbps: 0, txMbps: 0, available: false, at: Date.now() };
  private trafficSampler = new TrafficSampler();
  private queue: Promise<unknown> = Promise.resolve();
  private timers: ReturnType<typeof setInterval>[] = [];
  private ticking = false;
  private lastScan = 0;
  private lastHealth = 0;
  private lastSpeed = Date.now();
  private nextBackup = Date.now() + 24 * 3600_000;
  constructor(
    readonly store: StateStore,
    readonly options: Options = {},
  ) {}
  async init() {
    this.state = await this.store.load();
    await loadIeeeRegistry();
    this.interfaces = this.options.demo
      ? [
          {
            name: "demo",
            address: "192.168.50.2",
            cidr: "192.168.50.2/24",
            gateway: "192.168.50.1",
          },
        ]
      : await (this.options.interfaces ?? discoverInterfaces)();
    if (!this.state.settings.interfaceName && this.interfaces.length === 1)
      this.state.settings.interfaceName = this.interfaces[0]!.name;
    await this.store.save(this.state);
  }
  selectedNetwork() {
    return this.interfaces.find((n) => n.name === this.state.settings.interfaceName);
  }
  snapshot(): ServerSnapshot {
    return structuredClone({
      ...this.state,
      server: {
        version: "0.1.0",
        startedAt: this.startedAt,
        demo: Boolean(this.options.demo),
        scanning: this.scanning,
        speedRunning: this.speedRunning,
        speedProgress: this.speedProgress,
        interfaces: this.interfaces,
        traffic: this.traffic,
      },
    });
  }
  mutate(fn: (draft: ServerState) => void | Promise<void>): Promise<void> {
    const job = this.queue.then(async () => {
      const next = structuredClone(this.state);
      await fn(next);
      next.revision++;
      await this.store.save(next);
      this.state = next;
    });
    this.queue = job.catch(() => {});
    return job;
  }
  start() {
    if (this.timers.length) return;
    this.timers.push(
      setInterval(
        () => void this.tick().catch((error) => console.error("Monitor:", error.message)),
        1000,
      ),
    );
    void this.tick().catch((error) => console.error("Monitor:", error.message));
  }
  async stop() {
    for (const timer of this.timers) clearInterval(timer);
    this.timers = [];
    while (this.ticking || this.scanning || this.speedRunning)
      await new Promise((r) => setTimeout(r, 25));
    await this.queue;
  }
  async tick() {
    if (this.ticking) return;
    this.ticking = true;
    try {
      this.traffic = this.options.demo
        ? { rxMbps: 0, txMbps: 0, available: false, at: Date.now() }
        : await this.trafficSampler.read(this.selectedNetwork());
      const now = Date.now(),
        settings = this.state.settings;
      if (
        settings.scanIntervalSeconds &&
        now - this.lastScan >= settings.scanIntervalSeconds * 1000
      ) {
        this.lastScan = now;
        await this.scan();
      }
      if (
        settings.healthIntervalSeconds &&
        now - this.lastHealth >= settings.healthIntervalSeconds * 1000
      ) {
        this.lastHealth = now;
        await this.health();
      }
      if (
        settings.speedIntervalMinutes &&
        now - this.lastSpeed >= settings.speedIntervalMinutes * 60_000 &&
        !this.speedRunning
      ) {
        this.lastSpeed = now;
        void this.speed().catch(() => {});
      }
      if (now >= this.nextBackup) {
        await this.store.backup();
        this.nextBackup = now + 24 * 3600_000;
      }
    } finally {
      this.ticking = false;
    }
  }
  async scan() {
    if (this.scanning) return;
    this.scanning = true;
    try {
      const network = this.selectedNetwork();
      if (!network) throw new Error("Selecciona una interfaz de red en Configuración.");
      const raw = this.options.demo
        ? [
            {
              ip: "192.168.50.1",
              mac: "02:00:00:00:00:01",
              name: "Router de ejemplo",
              type: "router",
            },
            { ip: "192.168.50.2", mac: "02:00:00:00:00:02", name: "NAS de ejemplo", type: "nas" },
            {
              ip: "192.168.50.20",
              mac: "02:00:00:00:00:20",
              name: "Teléfono de ejemplo",
              type: "smartphone",
            },
          ]
        : await (this.options.scan ?? scanNetwork)(network);
      const scanned = parseHostsJson(raw);
      const self = scanned.find((d) => d.ip === network.address);
      if (self) {
        self.name = "NetHub Server";
        self.type = "nas"; /* A LAN scan cannot infer cable versus Wi-Fi. */
      }
      await this.mutate((draft) => {
        const watched = evaluateWatches(
          mergeScan(draft.devices, scanned),
          this.options.now?.() ?? new Date(),
        );
        const merged = watched.devices;
        const now = this.options.now?.() ?? new Date();
        draft.events = appendEvents(draft.events, [
          ...diffActivity(draft.devices, merged),
          ...watched.events,
        ]);
        draft.devices = merged;
        draft.usage = recordUsageScan(merged, draft.usage, now);
        draft.patterns = evaluatePatterns(
          draft.patterns,
          merged,
          this.traffic.available ? this.traffic.rxMbps : null,
          now,
        ).state;
        draft.lastScanAt = now.toISOString();
        draft.lastScanError = null;
      });
    } catch (error) {
      await this.mutate((draft) => {
        draft.lastScanError = (error as Error).message;
      });
    } finally {
      this.scanning = false;
    }
  }
  async health() {
    try {
      const network = this.selectedNetwork();
      if (!network?.gateway)
        throw new Error("No se detectó una puerta de enlace en la interfaz seleccionada.");
      const targets = [network.gateway, "8.8.8.8", "1.1.1.1"];
      const results = this.options.demo
        ? targets.map(() => ({ ok: true, rtt: 12 }))
        : await Promise.all(targets.map((ip) => (this.options.ping ?? ping)(ip, true)));
      await this.mutate((draft) => {
        draft.health = [
          ...draft.health,
          {
            at: new Date().toISOString(),
            gateway: results[0]!.ok ? results[0]!.rtt : null,
            secondary: results[1]!.ok ? results[1]!.rtt : null,
            internet: results[2]!.ok ? results[2]!.rtt : null,
          },
        ].slice(-2880);
        draft.lastHealthError = null;
      });
    } catch (error) {
      await this.mutate((draft) => {
        draft.lastHealthError = (error as Error).message;
      });
    }
  }
  async speed() {
    if (this.speedRunning) throw new Error("Ya hay una prueba en curso.");
    if (this.options.demo)
      throw new Error("Las pruebas de velocidad reales están desactivadas en la demostración.");
    this.speedRunning = true;
    this.lastSpeed = Date.now();
    try {
      const result = await measureSpeed((progress) => {
        this.speedProgress = progress;
      });
      await this.mutate((draft) => {
        draft.speedHistory = sanitizeSpeedHistory([result, ...draft.speedHistory]);
        draft.lastSpeedError = null;
      });
    } catch (error) {
      await this.mutate((draft) => {
        draft.lastSpeedError = (error as Error).message;
      });
    } finally {
      this.speedRunning = false;
      this.speedProgress = null;
    }
  }
  async editDevice(
    id: string,
    changes: Record<string, unknown>,
    expected: Record<string, unknown>,
  ) {
    const keys = Object.keys(changes);
    if (!keys.length || keys.some((key) => !(EDITABLE_FIELDS as readonly string[]).includes(key)))
      throw new Error("Campos de dispositivo no válidos.");
    await this.mutate((draft) => {
      const device = draft.devices.find((d) => d.id === id);
      if (!device) throw new Error("Dispositivo no encontrado.");
      for (const key of keys)
        if (
          JSON.stringify((device as unknown as Record<string, unknown>)[key] ?? null) !==
          JSON.stringify(expected[key] ?? null)
        )
          throw Object.assign(
            new Error("La ficha cambió en otro dispositivo. Actualiza y vuelve a editar."),
            { status: 409 },
          );
      validateDeviceChanges(changes);
      Object.assign(device, changes);
      if (keys.includes("watch")) delete device.watchState;
      for (const key of ["person", "location"] as const)
        if (device[key]?.trim()) {
          const directory = key === "person" ? "people" : "locations";
          if (!draft.settings[directory].includes(device[key]!))
            draft.settings[directory].push(device[key]!);
        }
    });
  }
  async importData(value: unknown) {
    const parsed = (Array.isArray(value) ? { devices: value } : value) as Record<string, unknown>;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !Array.isArray(parsed["devices"]) ||
      parsed["devices"].length > 5000
    )
      throw new Error("Selecciona un JSON de NetHub válido (máximo 5000 fichas).");
    const imported = normalizeState(parsed);
    await this.mutate(async (draft) => {
      await this.store.backup();
      Object.assign(draft, {
        devices: imported.devices,
        events: imported.events,
        patterns: imported.patterns,
        usage: imported.usage,
        health: imported.health,
        speedHistory: imported.speedHistory,
        lastScanAt: null,
      });
      draft.settings = {
        ...draft.settings,
        people: imported.settings.people,
        locations: imported.settings.locations,
        speedHistoryLimit: imported.settings.speedHistoryLimit,
      };
    });
    this.lastScan = 0;
  }
  async unify(primary: string, other: string, choices: MergeChoices) {
    await this.mutate((draft) => {
      if (
        !draft.devices.some((d) => d.id === primary) ||
        !draft.devices.some((d) => d.id === other) ||
        primary === other
      )
        throw new Error("Selecciona dos fichas distintas.");
      draft.devices = unifyDevices(draft.devices, primary, other, choices);
    });
  }
  async separate(id: string) {
    await this.mutate((draft) => {
      draft.devices = separateDevice(draft.devices, id);
    });
  }
  async remove(id: string) {
    await this.mutate((draft) => {
      draft.devices = draft.devices.filter((d) => d.id !== id);
    });
  }
  async review(id: string, reviewed: boolean) {
    await this.mutate((draft) => {
      draft.patterns = reviewAnomaly(draft.patterns, id, reviewed);
    });
  }
  async settings(changes: Partial<ServerSettings>) {
    const keys = Object.keys(changes);
    if (
      keys.some(
        (k) =>
          ![
            "scanIntervalSeconds",
            "healthIntervalSeconds",
            "speedIntervalMinutes",
            "interfaceName",
            "contractedMbps",
            "speedHistoryLimit",
          ].includes(k),
      )
    )
      throw new Error("Preferencia no válida.");
    for (const [key, allowed] of [
      ["scanIntervalSeconds", [0, 30, 60, 120, 300, 600]],
      ["healthIntervalSeconds", [0, 15, 30, 60, 120]],
      ["speedIntervalMinutes", [0, 120, 360, 720, 1440]],
    ] as const)
      if (key in changes && !allowed.includes(changes[key] as never))
        throw new Error("Intervalo no válido.");
    if (
      changes.speedHistoryLimit !== undefined &&
      ![10, 25, 50, 100].includes(changes.speedHistoryLimit)
    )
      throw new Error("Límite de historial no válido.");
    if (this.options.demo && changes.speedIntervalMinutes)
      throw new Error("Pruebas reales desactivadas en la demostración.");
    if (
      changes.interfaceName !== undefined &&
      !this.interfaces.some((n) => n.name === changes.interfaceName)
    )
      throw new Error("Interfaz de red no disponible.");
    if (
      changes.contractedMbps !== undefined &&
      (!Number.isFinite(changes.contractedMbps) ||
        changes.contractedMbps < 0 ||
        changes.contractedMbps > 100000)
    )
      throw new Error("Velocidad contratada no válida.");
    await this.mutate((draft) => {
      draft.settings = { ...draft.settings, ...changes };
    });
    if (changes.interfaceName !== undefined) {
      this.trafficSampler.reset();
      this.lastScan = 0;
      this.lastHealth = 0;
    }
  }
  async directory(kind: "people" | "locations", previous: string | null, replacement: string) {
    if (
      typeof replacement !== "string" ||
      replacement.length > 100 ||
      (typeof previous !== "string" && previous !== null)
    )
      throw new Error("Nombre no válido.");
    const name = replacement.trim();
    await this.mutate((draft) => {
      const names = draft.settings[kind];
      if (
        name &&
        names.some((n) => n !== previous && n.toLocaleLowerCase() === name.toLocaleLowerCase())
      )
        throw new Error("Ese nombre ya existe.");
      draft.settings[kind] = [
        ...new Set([...names.filter((n) => n !== previous), ...(name ? [name] : [])]),
      ];
      if (previous !== null)
        for (const d of draft.devices) {
          const field = kind === "people" ? "person" : "location";
          if (d[field] === previous) {
            d[field] = name;
            if (field === "location" && d.roomPosition) d.roomPosition.room = name;
          }
        }
    });
  }
}
function validateDeviceChanges(changes: Record<string, unknown>) {
  for (const [key, value] of Object.entries(changes)) {
    if (key === "watch" && value !== null && !normalizeWatch(value))
      throw new Error("Vigilancia no válida.");
    if (
      [
        "name",
        "vendor",
        "person",
        "location",
        "notes",
        "networkId",
        "brand",
        "servicesScannedAt",
      ].includes(key) &&
      value !== null &&
      (typeof value !== "string" || value.length > (key === "notes" ? 4000 : 200))
    )
      throw new Error("Texto de dispositivo no válido.");
    if (key === "name" && (typeof value !== "string" || !value.trim()))
      throw new Error("El nombre no puede estar vacío.");
    if (key === "type" && (typeof value !== "string" || !Object.hasOwn(deviceTypeLabels, value)))
      throw new Error("Tipo no válido.");
    if (["trusted", "isNew", "manualEdit"].includes(key) && typeof value !== "boolean")
      throw new Error("Valor no válido.");
    if (
      key === "latency" &&
      (!Array.isArray(value) ||
        value.length > 30 ||
        value.some(
          (v) =>
            !v ||
            typeof v.at !== "string" ||
            (v.rtt !== null && (!Number.isFinite(v.rtt) || v.rtt < 0)),
        ))
    )
      throw new Error("Latencia no válida.");
    if (
      key === "services" &&
      (!Array.isArray(value) ||
        value.length > 30 ||
        value.some(
          (v) =>
            !v ||
            !Number.isInteger(v.port) ||
            v.port < 1 ||
            v.port > 65535 ||
            typeof v.label !== "string" ||
            typeof v.hint !== "string" ||
            (v.url !== null && (typeof v.url !== "string" || !/^https?:\/\//.test(v.url))),
        ))
    )
      throw new Error("Servicios no válidos.");
    if (
      key === "tags" &&
      (!Array.isArray(value) ||
        value.length > 40 ||
        value.some((t) => typeof t !== "string" || t.length > 100))
    )
      throw new Error("Etiquetas no válidas.");
    if (
      key === "connectionSource" &&
      value !== null &&
      !["manual", "local", "router"].includes(String(value))
    )
      throw new Error("Conexión no válida.");
    if (
      key === "identityManual" &&
      value !== null &&
      (!value ||
        typeof value !== "object" ||
        Object.entries(value).some(
          ([k, v]) => !["type", "vendor"].includes(k) || typeof v !== "boolean",
        ))
    )
      throw new Error("Identificación no válida.");
    if (key === "roomPosition" && value !== null) {
      const p = value as Device["roomPosition"];
      if (
        !p ||
        typeof p.room !== "string" ||
        p.room.length > 100 ||
        !Number.isFinite(p.x) ||
        !Number.isFinite(p.y) ||
        p.x < 0 ||
        p.x > 100 ||
        p.y < 0 ||
        p.y > 100
      )
        throw new Error("Posición no válida.");
    }
  }
}
