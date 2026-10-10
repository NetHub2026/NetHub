import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Toaster, toast } from "sonner";
import {
  Search,
  Radar,
  Server,
  LogOut,
  Settings,
  Activity,
  House,
  Gauge,
  Network,
  LockKeyhole,
  LoaderCircle,
  Download,
  ShieldCheck,
  Users,
  MapPin,
} from "lucide-react";
import type { Device, DeviceType } from "../src/lib/devices";
import { deviceTypeLabels } from "../src/lib/devices";
import { detectNetworks } from "../src/lib/networks";
import {
  arrangeInventory,
  type InventorySort,
  type InventoryGroup,
} from "../src/lib/inventory-view";
import { InventorySummary } from "../src/components/network/InventorySummary";
import { DeviceTypeFilter } from "../src/components/network/DeviceTypeFilter";
import { DeviceTypeIcon } from "../src/components/network/DeviceTypeIcon";
import { InventoryViewControls } from "../src/components/network/InventoryViewControls";
import { DeviceDetailPanel } from "../src/components/network/DeviceDetailPanel";
import { DirectoryManager } from "../src/components/network/DirectoryManager";
import { ActivityTimeline } from "../src/components/network/ActivityTimeline";
import { HomeTwin } from "../src/components/network/HomeTwin";
import { UsageView } from "../src/components/network/UsageView";
import { BandwidthChart } from "../src/components/network/BandwidthChart";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "../src/components/ui/dialog";
import { healthStats } from "../src/lib/health";
import { slaCsv } from "../src/lib/sla";
import { connectionOf, wifiBand } from "../src/lib/connections";
import type { ServerSnapshot, ServerSettings } from "../server/types";
import "./style.css";
import { commonServices, serviceUrl } from "../src/lib/services";

let csrf = "";
let latest: ServerSnapshot | null = null;
async function api<T>(path: string, data?: unknown): Promise<T> {
  const response = await fetch("/api/" + path, {
    method: data === undefined ? "GET" : "POST",
    headers:
      data === undefined ? {} : { "Content-Type": "application/json", "X-NetHub-CSRF": csrf },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    credentials: "same-origin",
  });
  const value = await response.json();
  if (!response.ok)
    throw Object.assign(new Error(value.error ?? "No se pudo completar la solicitud."), {
      status: response.status,
    });
  return value as T;
}
const serverPing: typeof import("../src/lib/ping").pingIp = async (ip) => {
  const result = await api<{ ok: boolean; rtt: number | null }>("ping", { ip });
  return { rtt: result.rtt, reachable: result.ok, at: new Date().toISOString(), source: "native" };
};
const serverWake: typeof import("../src/lib/wol").wakeDevice = async (mac) => {
  const device = latest?.devices.find(
    (d) => d.mac === mac || d.networkEntries?.some((e) => e.mac === mac),
  );
  if (!device) throw new Error("Dispositivo no encontrado.");
  await api("wol", { id: device.id });
  return {
    ok: true,
    message:
      "Magic Packet enviado desde el NAS (UDP 9). El equipo debe tener Wake-on-LAN habilitado.",
  };
};
const serverProbe: typeof import("../src/lib/services").detectServices = async (ip, onProgress) => {
  const results = await api<Array<{ port: number; open: boolean; rtt: number | null }>>("ports", {
    ip,
    ports: commonServices.map((d) => d.port),
  });
  const hits = results
    .filter((r) => r.open)
    .flatMap((r) => {
      const def = commonServices.find((d) => d.port === r.port);
      return def
        ? [{ port: r.port, label: def.label, hint: def.hint, url: serviceUrl(ip, def), rtt: r.rtt }]
        : [];
    });
  onProgress?.({ done: commonServices.length, total: commonServices.length, found: hits.length });
  return { hits, native: true };
};
const editable = [
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
type View = "inventory" | "home" | "activity" | "status" | "performance" | "usage" | "settings";
const views: Array<[View, string, typeof Server]> = [
  ["inventory", "Inventario", Network],
  ["home", "Casa", House],
  ["activity", "Actividad", Activity],
  ["status", "Estado", ShieldCheck],
  ["performance", "Rendimiento", Gauge],
  ["usage", "Uso", Users],
  ["settings", "Configuración", Settings],
];
const date = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })
    : "Pendiente";
function App() {
  const [session, setSession] = useState<"checking" | "login" | "ready">("checking");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [state, setState] = useState<ServerSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [view, setView] = useState<View>("inventory");
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [types, setTypes] = useState<DeviceType[]>([]);
  const [order, setOrder] = useState<InventorySort>("ip");
  const [group, setGroup] = useState<InventoryGroup>("none");
  const [person, setPerson] = useState("");
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState("all");
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const pending = useRef(0);
  const mounted = useRef(true);
  const apply = (value: ServerSnapshot) => {
    latest = value;
    setState(value);
    setConnected(true);
  };
  const refresh = async () => {
    try {
      const value = await api<ServerSnapshot>("state");
      if (!pending.current && mounted.current) apply(value);
    } catch (error) {
      if (mounted.current) setConnected(false);
      if ((error as { status?: number }).status === 401) setSession("login");
    }
  };
  useEffect(() => {
    mounted.current = true;
    void api<{ csrf: string }>("session")
      .then((value) => {
        csrf = value.csrf;
        setSession("ready");
      })
      .catch(() => setSession("login"));
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (session !== "ready") return;
    void refresh();
    const timer = setInterval(() => void refresh(), 2000);
    return () => clearInterval(timer);
  }, [session]);
  const mutate = (path: string, data: unknown) => {
    pending.current++;
    const job = queue.current.then(async () => {
      try {
        const value = await api<ServerSnapshot>(path, data);
        if (value.server && pending.current === 1) apply(value);
        else await refresh();
        return true;
      } catch (error) {
        toast.error((error as Error).message);
        if ((error as { status?: number }).status === 401) setSession("login");
        return false;
      } finally {
        pending.current--;
        if (!pending.current) await refresh();
      }
    });
    queue.current = job;
    return job;
  };
  const update = (device: Device) => {
    const previous = latest?.devices.find((d) => d.id === device.id);
    if (!previous) return;
    const changes: Record<string, unknown> = {},
      expected: Record<string, unknown> = {};
    for (const field of editable)
      if (JSON.stringify(previous[field] ?? null) !== JSON.stringify(device[field] ?? null)) {
        changes[field] = device[field] ?? null;
        expected[field] = previous[field] ?? null;
      }
    if (!Object.keys(changes).length) return;
    const optimistic = {
      ...latest!,
      devices: latest!.devices.map((d) => (d.id === device.id ? device : d)),
    };
    latest = optimistic;
    setState(optimistic);
    void mutate("device", { id: device.id, changes, expected });
  };
  const networks = useMemo(() => detectNetworks(state?.devices ?? []), [state?.devices]);
  const devices = state?.devices ?? [];
  const filtered = devices.filter(
    (d) =>
      (!query ||
        `${d.name} ${d.ip} ${d.mac} ${d.vendor}`
          .toLocaleLowerCase()
          .includes(query.toLocaleLowerCase())) &&
      (!types.length || types.includes(d.type)) &&
      (!person || d.person === person) &&
      (!location || d.location === location) &&
      (status === "all" || d.status === status),
  );
  const groups = arrangeInventory(filtered, order, group);
  const chosen = devices.find((d) => d.id === selected) ?? null;
  const download = async () => {
    const data = await api<unknown>("export");
    saveDownload(JSON.stringify(data, null, 2), "nethub-server-backup.json", "application/json");
  };
  if (session === "checking")
    return (
      <div className="grid min-h-screen place-items-center bg-background text-foreground">
        <LoaderCircle className="size-7 animate-spin" />
      </div>
    );
  if (session === "login")
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-5 py-10 text-foreground">
        <section className="w-full max-w-sm rounded-2xl border border-border bg-card p-7">
          <img src="/app-icon.png" alt="" className="mb-5 size-14" />
          <h1 className="text-2xl font-semibold">NetHub Server</h1>
          <p className="mt-2 text-sm text-muted-foreground">Tu red, vigilada desde el NAS.</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setLoggingIn(true);
              setLoginError("");
              try {
                const result = await api<{ csrf: string }>("login", { password });
                csrf = result.csrf;
                setPassword("");
                setSession("ready");
              } catch (error) {
                setLoginError((error as Error).message);
              } finally {
                setLoggingIn(false);
              }
            }}
            className="mt-7 space-y-4"
          >
            <label className="block text-sm">
              Contraseña
              <input
                aria-label="Contraseña"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2.5"
              />
            </label>
            {loginError && (
              <p role="alert" className="text-sm text-destructive">
                {loginError}
              </p>
            )}
            <button
              disabled={loggingIn}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 font-medium text-primary-foreground"
            >
              <LockKeyhole className="size-4" />
              {loggingIn ? "Entrando…" : "Entrar"}
            </button>
          </form>
          <p className="mt-5 text-xs text-muted-foreground">
            Usa la contraseña configurada en la instalación del NAS.
          </p>
        </section>
      </main>
    );
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster richColors theme="dark" />
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <img src="/app-icon.png" alt="" className="size-9" />
          <div className="mr-auto">
            <h1 className="font-semibold">
              NetHub{" "}
              <span className="text-xs font-normal text-muted-foreground">
                Server {state?.server.version ?? ""}
              </span>
            </h1>
            <p className="text-[11px] text-muted-foreground">
              Monitorización 24 horas desde el NAS
            </p>
          </div>
          <span className={`text-xs ${connected ? "text-success" : "text-warning"}`}>
            {connected ? "Conectado" : "Sin conexión"}
          </span>
          <button
            onClick={() => void mutate("scan", {})}
            disabled={!connected || state?.server.scanning}
            className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            <Radar className="size-4" />
            {state?.server.scanning ? "Escaneando…" : "Escanear"}
          </button>
          <button
            aria-label="Cerrar sesión"
            onClick={async () => {
              await api("logout", {});
              latest = null;
              setState(null);
              csrf = "";
              setSession("login");
            }}
            className="rounded-md p-2 text-muted-foreground hover:bg-muted"
          >
            <LogOut className="size-4" />
          </button>
        </div>
        <nav
          aria-label="Secciones de NetHub"
          className="mx-auto flex max-w-[1600px] gap-1 overflow-x-auto px-4 pb-2 sm:px-6"
        >
          {views.map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => setView(id)}
              aria-current={view === id ? "page" : undefined}
              className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-xs ${view === id ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted"}`}
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-[1600px] space-y-5 px-4 py-5 sm:px-6">
        {state?.server.demo && (
          <p className="rounded-lg border border-warning/50 bg-warning/10 px-4 py-3 text-sm text-warning">
            Demostración con datos de ejemplo. No se escanea tu red ni se realizan pruebas de
            velocidad.
          </p>
        )}
        {!connected && (
          <p role="alert" className="rounded-lg border border-warning p-3 text-sm text-warning">
            No se puede contactar con el NAS. Los datos mostrados corresponden a la última
            sincronización.
          </p>
        )}
        {!state ? (
          <p>Cargando inventario…</p>
        ) : (
          <>
            {state.lastScanError && (
              <p
                role="alert"
                className="rounded-lg border border-warning/50 bg-warning/10 px-4 py-3 text-sm text-warning"
              >
                {state.lastScanError}
              </p>
            )}
            {view === "inventory" && (
              <>
                <InventorySummary devices={devices} networks={networks.length} />
                <div className="flex flex-wrap items-center gap-2">
                  <label className="relative min-w-[180px] flex-1">
                    <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
                    <input
                      aria-label="Buscar dispositivos"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Buscar nombre, IP, MAC…"
                      className="w-full rounded-lg border border-border bg-card py-2.5 pl-9 pr-3 text-sm"
                    />
                  </label>
                  <DeviceTypeFilter value={types} onChange={setTypes} />
                  <InventoryViewControls
                    order={order}
                    grouping={group}
                    onChange={(patch) => {
                      if (patch.inventorySort) setOrder(patch.inventorySort);
                      if (patch.inventoryGroup) setGroup(patch.inventoryGroup);
                    }}
                  />
                  <Filter
                    label="Personas"
                    value={person}
                    onChange={setPerson}
                    all="Todas las personas"
                    options={state.settings.people}
                  />
                  <Filter
                    label="Ubicaciones"
                    value={location}
                    onChange={setLocation}
                    all="Todas las ubicaciones"
                    options={state.settings.locations}
                  />
                  <select
                    aria-label="Estado del dispositivo"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="rounded-lg border border-border bg-card p-2.5 text-sm"
                  >
                    <option value="all">Todos los estados</option>
                    <option value="online">Activos</option>
                    <option value="offline">Inactivos</option>
                  </select>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    {filtered.length} de {devices.length} dispositivos
                  </span>
                  <span>Último escaneo: {date(state.lastScanAt)}</span>
                </div>
                {groups.map((g) => (
                  <section key={g.key}>
                    {g.label && (
                      <h2 className="mb-3 mt-5 text-sm font-semibold">
                        {g.label} · {g.devices.length}
                      </h2>
                    )}
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {g.devices.map((d) => (
                        <button
                          key={d.id}
                          onClick={() => setSelected(d.id)}
                          className="flex min-w-0 items-center gap-3 rounded-xl border border-border bg-card p-4 text-left hover:border-primary/60"
                        >
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                            <DeviceTypeIcon type={d.type} className="size-5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                              <span className="truncate text-sm font-semibold">{d.name}</span>
                              <span
                                className={`size-1.5 shrink-0 rounded-full ${d.status === "online" ? "bg-success" : "bg-muted-foreground"}`}
                              />
                              {d.isNew && !d.trusted && (
                                <span className="rounded bg-warning/15 px-1.5 py-0.5 text-[10px] text-warning">
                                  Nuevo
                                </span>
                              )}
                            </span>
                            <span className="mt-1 block truncate font-mono text-xs text-muted-foreground">
                              {d.ip} · {deviceTypeLabels[d.type]}
                            </span>
                            <span className="mt-1 block truncate text-xs text-muted-foreground">
                              {[
                                d.person,
                                d.location,
                                connectionOf(d) === "wired"
                                  ? "Cable"
                                  : connectionOf(d) === "wifi"
                                    ? `Wi-Fi${wifiBand(d) ? " " + wifiBand(d) + " GHz" : ""}`
                                    : null,
                              ]
                                .filter(Boolean)
                                .join(" · ") || "Sin persona ni ubicación"}
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>
                ))}
                {!filtered.length && (
                  <p className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
                    {devices.length
                      ? "No hay dispositivos que coincidan con los filtros."
                      : "El inventario aparecerá al completar el primer escaneo."}
                  </p>
                )}
              </>
            )}
            {view === "home" && (
              <HomeTwin
                monitoringHost="este NAS"
                devices={devices}
                patterns={state.patterns}
                rxMbps={state.server.traffic.rxMbps}
                onUpdateDevice={update}
                onSelectDevice={setSelected}
                onReviewAnomaly={(id, reviewed) => void mutate("review", { id, reviewed })}
                onOpenPerformance={() => setView("performance")}
              />
            )}
            {view === "activity" && (
              <ActivityTimeline
                events={state.events}
                onSelectDevice={setSelected}
                onClear={() => void mutate("clear-events", {})}
              />
            )}
            {view === "usage" && (
              <UsageView devices={devices} usage={state.usage} onSelectDevice={setSelected} />
            )}
            {view === "status" && <Status state={state} />}
            {view === "performance" && (
              <Performance
                state={state}
                onTest={() => void mutate("speed", {})}
                onSettings={(patch) => void mutate("settings", patch)}
              />
            )}
            {view === "settings" && (
              <section className="space-y-5">
                <div className="rounded-xl border border-border bg-card p-5">
                  <h2 className="mb-4 text-lg font-semibold">Monitor del NAS</h2>
                  <p className="mb-5 text-sm text-muted-foreground">
                    El servicio realiza estas tareas aunque no haya ningún navegador abierto.
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-2 text-sm">
                      Interfaz de red
                      <select
                        aria-label="Interfaz de red"
                        value={state.settings.interfaceName}
                        onChange={(e) => void mutate("settings", { interfaceName: e.target.value })}
                        className="rounded-lg border border-border bg-background p-2"
                      >
                        <option value="">Seleccionar interfaz…</option>
                        {state.server.interfaces.map((n) => (
                          <option key={n.name + "-" + n.address} value={n.name}>
                            {n.name} · {n.cidr}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Interval
                      label="Escaneo de dispositivos"
                      value={state.settings.scanIntervalSeconds}
                      options={[
                        [0, "Desactivado"],
                        [30, "Cada 30 segundos"],
                        [60, "Cada minuto"],
                        [120, "Cada 2 minutos"],
                        [300, "Cada 5 minutos"],
                        [600, "Cada 10 minutos"],
                      ]}
                      onChange={(value) => void mutate("settings", { scanIntervalSeconds: value })}
                    />
                    <Interval
                      label="Comprobación de conectividad"
                      value={state.settings.healthIntervalSeconds}
                      options={[
                        [0, "Desactivado"],
                        [15, "Cada 15 segundos"],
                        [30, "Cada 30 segundos"],
                        [60, "Cada minuto"],
                        [120, "Cada 2 minutos"],
                      ]}
                      onChange={(value) =>
                        void mutate("settings", { healthIntervalSeconds: value })
                      }
                    />
                    <label className="grid gap-2 text-sm">
                      Velocidad contratada (Mbps)
                      <input
                        aria-label="Velocidad contratada"
                        type="number"
                        min="0"
                        max="100000"
                        defaultValue={state.settings.contractedMbps}
                        key={state.settings.contractedMbps}
                        onBlur={(e) =>
                          void mutate("settings", { contractedMbps: Number(e.target.value) })
                        }
                        className="rounded-lg border border-border bg-background p-2"
                      />
                    </label>
                  </div>
                  <p className="mt-4 text-xs text-muted-foreground">
                    La detección cubre la red local de la interfaz seleccionada. Redes aisladas,
                    VLAN y equipos dormidos pueden requerir otra fuente de información.
                  </p>
                </div>
                <div className="grid gap-5 lg:grid-cols-2">
                  {(["people", "locations"] as const).map((kind) => (
                    <div key={kind} className="rounded-xl border border-border bg-card p-5">
                      <DirectoryManager
                        kind={kind}
                        names={state.settings[kind]}
                        devices={devices}
                        onCreate={(replacement) =>
                          void mutate("directory", { kind, previous: null, replacement })
                        }
                        onChange={(previous, replacement) =>
                          void mutate("directory", { kind, previous, replacement })
                        }
                      />
                    </div>
                  ))}
                </div>
                <div className="rounded-xl border border-border bg-card p-5">
                  <h2 className="text-lg font-semibold">Datos y copias</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Inventario, posiciones, actividad, rutinas y hasta 100 pruebas de velocidad se
                    guardan en el NAS. Se crea una copia adicional cada 24 horas.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <label className="cursor-pointer rounded-lg border border-border px-3 py-2 text-sm">
                      Importar JSON
                      <input
                        aria-label="Importar JSON de NetHub"
                        type="file"
                        accept=".json,application/json"
                        className="sr-only"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (!file) return;
                          if (file.size > 10 * 1024 * 1024) {
                            toast.error("El archivo supera los 10 MB.");
                            return;
                          }
                          try {
                            const data = JSON.parse(await file.text());
                            if (
                              !window.confirm(
                                "¿Sustituir los datos del NAS por este JSON? Se guardará una copia previa en el NAS. Las tareas y la contraseña del servidor se conservarán.",
                              )
                            )
                              return;
                            void mutate("import", { data });
                          } catch {
                            toast.error("No se pudo leer el JSON.");
                          }
                        }}
                      />
                    </label>
                    <button
                      onClick={() => void download().catch((error) => toast.error(error.message))}
                      className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                    >
                      <Download className="size-4" />
                      Descargar copia
                    </button>
                    <button
                      onClick={() =>
                        void mutate("backup", {}).then((ok) => {
                          if (ok) toast.message("Copia creada en el NAS.");
                        })
                      }
                      className="rounded-lg border border-border px-3 py-2 text-sm"
                    >
                      Crear copia en el NAS
                    </button>
                  </div>
                  <p className="mt-4 text-xs text-muted-foreground">
                    Para cambiar la contraseña, actualiza el archivo configurado en Docker y
                    reinicia el contenedor. Para acceso desde fuera de casa, utiliza una VPN o un
                    proxy HTTPS autenticado.
                  </p>
                </div>
              </section>
            )}
          </>
        )}
      </main>
      <DeviceDetailPanel
        measurePing={serverPing}
        sendWake={serverWake}
        probeServices={serverProbe}
        storageLabel="el NAS"
        pingSourceLabel={state?.server.demo ? "dato de ejemplo" : "NAS (ICMP real)"}
        deviceTrafficAvailable={false}
        device={chosen}
        devices={devices}
        networks={networks}
        people={state?.settings.people ?? []}
        locations={state?.settings.locations ?? []}
        events={state?.events ?? []}
        onClose={() => setSelected(null)}
        onUpdate={update}
        onDelete={(device) => {
          void mutate("remove", { id: device.id });
          setSelected(null);
        }}
        onCreatePerson={(replacement) =>
          void mutate("directory", { kind: "people", previous: null, replacement })
        }
        onCreateLocation={(replacement) =>
          void mutate("directory", { kind: "locations", previous: null, replacement })
        }
        onUnify={(otherId, choices) => {
          if (chosen) void mutate("unify", { id: chosen.id, otherId, choices });
        }}
        onSeparate={() => {
          if (chosen) void mutate("separate", { id: chosen.id });
        }}
      />
    </div>
  );
}
function Filter({
  label,
  value,
  onChange,
  all,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  all: string;
  options: string[];
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-border bg-card p-2.5 text-sm"
    >
      <option value="">{all}</option>
      {options.map((name) => (
        <option key={name} value={name}>
          {name}
        </option>
      ))}
    </select>
  );
}
function Interval({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: number;
  options: Array<[number, string]>;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid gap-2 text-sm">
      {label}
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="rounded-lg border border-border bg-background p-2"
      >
        {options.map(([n, text]) => (
          <option key={n} value={n}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}
function Status({ state }: { state: ServerSnapshot }) {
  const latest = state.health.at(-1),
    stats = healthStats(state.health);
  return (
    <section className="space-y-5">
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold">Conectividad desde el NAS</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Se comprueba si los destinos responden a ping. Una falta de respuesta también puede
          deberse a un filtro de ICMP.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {(
            [
              ["Router", latest?.gateway],
              ["Referencia 8.8.8.8", latest?.secondary],
              ["Internet 1.1.1.1", latest?.internet],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="rounded-lg border border-border p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-2 text-xl font-semibold">
                {value === undefined
                  ? "Pendiente"
                  : value === null
                    ? "Sin respuesta"
                    : `${value} ms`}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Última comprobación: {date(latest?.at ?? null)} · {state.health.length} muestras guardadas
        </p>
        {state.lastHealthError && (
          <p className="mt-3 text-sm text-warning">{state.lastHealthError}</p>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric
          label="Muestras con respuesta de Internet"
          value={state.health.length ? `${stats.uptime}%` : "—"}
        />
        <Metric
          label="Latencia media"
          value={stats.avgInternet === null ? "—" : `${stats.avgInternet} ms`}
        />
        <Metric label="Microcortes observados" value={String(stats.microcuts)} />
      </div>
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">Servicio continuo</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Iniciado: {date(state.server.startedAt)}. El NAS sigue monitorizando cuando cierras esta
          página.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Último escaneo: {date(state.lastScanAt)}. El resumen se sincroniza cada 2 segundos
          mientras la página está abierta.
        </p>
      </div>
    </section>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}
function Performance({
  state,
  onTest,
  onSettings,
}: {
  state: ServerSnapshot;
  onTest: () => void;
  onSettings: (patch: Partial<ServerSettings>) => void;
}) {
  const limit = state.settings.speedHistoryLimit;
  const [confirm, setConfirm] = useState(false);
  const history = state.speedHistory,
    latest = history[0],
    progress = state.server.speedProgress;
  const average = history.length
    ? history.reduce((n, r) => n + r.download, 0) / history.length
    : null;
  return (
    <section className="space-y-5">
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 text-lg font-semibold">Tráfico del NAS</h2>
        <BandwidthChart
          sample={{
            ...state.server.traffic,
            totalMbps: state.server.traffic.rxMbps + state.server.traffic.txMbps,
          }}
        />
        <p className="mt-3 text-xs text-muted-foreground">
          Incluye el tráfico local y de Internet de la interfaz seleccionada. No representa el
          tráfico de todos los dispositivos.
        </p>
      </div>
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Prueba de velocidad desde el NAS</h2>
          <button
            disabled={state.server.speedRunning || state.server.demo}
            onClick={() => setConfirm(true)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {state.server.speedRunning ? "Midiendo…" : "Iniciar prueba"}
          </button>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          La prueba se ejecuta en el NAS y su resultado se comparte con todos tus dispositivos.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Metric label="Última descarga" value={latest ? `${latest.download} Mbps` : "—"} />
          <Metric label="Última subida" value={latest ? `${latest.upload} Mbps` : "—"} />
          <Metric
            label="Latencia / jitter"
            value={latest ? `${latest.ping} / ${latest.migratedSla ? "—" : latest.jitter} ms` : "—"}
          />
        </div>
        {progress && (
          <div className="mt-4">
            <p className="text-sm">
              {progress.phase === "latency"
                ? "Latencia"
                : progress.phase === "download"
                  ? "Descarga"
                  : "Subida"}{" "}
              · {progress.value.toFixed(1)} {progress.phase === "latency" ? "ms" : "Mbps"}
            </p>
            <progress
              aria-label="Progreso del test"
              max="1"
              value={progress.progress}
              className="mt-2 w-full"
            />
          </div>
        )}
        {state.lastSpeedError && (
          <p className="mt-4 text-sm text-warning">{state.lastSpeedError}</p>
        )}
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Interval
            label="Pruebas automáticas"
            value={state.settings.speedIntervalMinutes}
            options={[
              [0, "Desactivadas"],
              [120, "Cada 2 horas"],
              [360, "Cada 6 horas"],
              [720, "Cada 12 horas"],
              [1440, "Una vez al día"],
            ]}
            onChange={(value) => {
              if (value && state.server.demo) {
                toast.message("Pruebas reales desactivadas en la demostración.");
                return;
              }
              if (
                value &&
                !window.confirm(
                  "Las pruebas programadas consumen ancho de banda y envían tráfico a Cloudflare desde el NAS. ¿Activarlas?",
                )
              )
                return;
              onSettings({ speedIntervalMinutes: value });
            }}
          />
          <div className="self-end text-sm text-muted-foreground">
            Media guardada: {average === null ? "—" : average.toFixed(1) + " Mbps"}
            {state.settings.contractedMbps > 0 && average !== null
              ? ` · ${Math.round((average / state.settings.contractedMbps) * 100)}% de ${state.settings.contractedMbps} Mbps contratados`
              : ""}
          </div>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Las pruebas automáticas están desactivadas inicialmente. Utilizan Cloudflare y pueden
          consumir varios GB por prueba en conexiones rápidas.
        </p>
      </div>
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h2 className="mr-auto text-sm font-semibold">
            Historial compartido · {history.length} de 100 resultados
          </h2>
          <select
            aria-label="Resultados del historial"
            value={limit}
            onChange={(e) => onSettings({ speedHistoryLimit: Number(e.target.value) })}
            className="rounded border border-border bg-background p-2 text-xs"
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>
                Últimos {n}
              </option>
            ))}
          </select>
          <button
            className="rounded border border-border px-3 py-2 text-xs"
            disabled={!history.length}
            onClick={() =>
              saveDownload(
                slaCsv([...history].reverse(), state.settings.contractedMbps),
                "nethub-server-tests.csv",
                "text/csv;charset=utf-8",
              )
            }
          >
            Informe CSV
          </button>
        </div>
        <div className="space-y-2">
          {history.slice(0, limit).map((r) => (
            <div
              key={r.at}
              className="flex flex-wrap justify-between gap-2 rounded-lg border border-border p-3 text-xs"
            >
              <span>{date(r.at)}</span>
              <span className="font-mono">
                ↓ {r.download} Mbps · ↑ {r.upload} Mbps · {r.ping} ms
              </span>
            </div>
          ))}
          {!history.length && (
            <p className="py-5 text-center text-sm text-muted-foreground">
              Todavía no hay pruebas guardadas.
            </p>
          )}
        </div>
      </div>
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogTitle>¿Medir la conexión del NAS?</DialogTitle>
          <DialogDescription>
            NetHub enviará y recibirá tráfico de prueba con Cloudflare. Puede consumir varios GB y
            afectar temporalmente a otras conexiones. El inventario no se envía.
          </DialogDescription>
          <div className="flex justify-end gap-3">
            <button
              className="rounded border border-border px-3 py-2 text-sm"
              onClick={() => setConfirm(false)}
            >
              Cancelar
            </button>
            <button
              className="rounded bg-primary px-3 py-2 text-sm text-primary-foreground"
              onClick={() => {
                setConfirm(false);
                onTest();
              }}
            >
              Iniciar prueba
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
function saveDownload(content: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
createRoot(document.getElementById("root")!).render(<App />);
