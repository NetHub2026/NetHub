import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Activity,
  ArrowDownUp,
  FileSpreadsheet,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Loader2,
  Moon,
  Radar,
  RefreshCw,
  RotateCcw,

  MapPin,
  Search,
  Sun,
  Timer,
  Users,
  Wifi,
  WifiOff,
} from "lucide-react";
import {
  deviceTypeLabels,
  type Device,
  type DeviceType,
} from "@/lib/devices";
import {
  clearStoredDirectory,
  directoryFromDevices,
  emptyDirectory,
  withEntry,
  type Directory,
} from "@/lib/directory";
import {
  clearStoredData,
  fetchFromAgent,
  formatScanTime,
  enrichDevicesWithResolvedVendors,
  loadScanMeta,
  mergeScan,
  newDevices,
  resolveVendorsInBackground,
  saveScanMeta,
  type ScanMeta,
  type ScannerStatus,
} from "@/lib/scanner";
import {
  APP_VERSION,
  getDbPath,
  getRuntime,
  nativeScan,
  runtimeLabels,
  type Runtime,
} from "@/lib/desktop";
import {
  loadDevicesAnywhere,
  loadDirectoryAnywhere,
  saveDevicesAnywhere,
  saveDirectoryAnywhere,
} from "@/lib/persistence";
import { exportInventoryCsv } from "@/lib/backup";
import {
  ALL_NETWORKS,
  countByNetwork,
  detectNetworks,
  networkOf,
} from "@/lib/networks";
import { BandwidthChart } from "@/components/network/BandwidthChart";
import { DeviceDetailPanel } from "@/components/network/DeviceDetailPanel";
import { NetworkTabs } from "@/components/network/NetworkTabs";
import { SpeedTestPanel } from "@/components/network/SpeedTestPanel";
import { UpdateModal } from "@/components/network/UpdateModal";
import { VendorIcon } from "@/components/network/VendorIcon";
import { DeviceTypeIcon } from "@/components/network/DeviceTypeIcon";

import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NetHub — Panel de red doméstica" },
      {
        name: "description",
        content:
          "Monitoriza y gestiona los dispositivos de tu red doméstica: PCs, consolas, Smart TVs, Home Assistant e IoT, con consumo de ancho de banda y control por dispositivo.",
      },
      { property: "og:title", content: "NetHub — Panel de red doméstica" },
      { property: "og:type", content: "website" },
      {
        property: "og:description",
        content:
          "Vista general de la red, filtros por tipo de dispositivo y panel de detalle con control y etiquetado.",
      },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

const filters: Array<{ value: DeviceType | "all"; label: string }> = [
  { value: "all", label: "Todos" },
  ...(Object.keys(deviceTypeLabels) as DeviceType[]).map((t) => ({
    value: t,
    label: deviceTypeLabels[t],
  })),
];

/** Intervalos disponibles para la monitorización automática (en segundos). */
const autoOptions: Array<{ value: number; label: string }> = [
  { value: 120, label: "Cada 2 min" },
  { value: 300, label: "Cada 5 min" },
  { value: 0, label: "Desactivado" },
];

const AUTO_KEY = "nethub.autoscan.v1";

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function Dashboard() {
  const [items, setItems] = useState<Device[]>([]);
  const [filter, setFilter] = useState<DeviceType | "all">("all");
  const [query, setQuery] = useState("");
  const [network, setNetwork] = useState<string>(ALL_NETWORKS);
  const [onlyOnline, setOnlyOnline] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dark, setDark] = useState(true);
  const [status, setStatus] = useState<ScannerStatus>("unknown");
  const [scanning, setScanning] = useState(false);
  const [meta, setMeta] = useState<ScanMeta>({ lastScanAt: null, source: null });
  const [notice, setNotice] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [runtime, setRuntime] = useState<Runtime>("web");
  const [dbPath, setDbPath] = useState("Almacenamiento del navegador (localStorage)");
  const [updateOpen, setUpdateOpen] = useState(false);
  /** Monitorización automática: intervalo en segundos (0 = desactivada). */
  const [autoInterval, setAutoInterval] = useState(120);
  const [countdown, setCountdown] = useState(120);
  const [autoScanning, setAutoScanning] = useState(false);
  /** Evita escaneos solapados (manual + automático). */
  const busyRef = useRef(false);
  const itemsRef = useRef<Device[]>([]);
  itemsRef.current = items;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  // Restaura la última lista guardada (archivo local en escritorio, localStorage en web).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const stored = await loadDevicesAnywhere();
      if (cancelled) return;
      if (stored && stored.length > 0) setItems(stored);
      setMeta(loadScanMeta());
      setRuntime(getRuntime());
      setDbPath(await getDbPath());
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (hydrated) void saveDevicesAnywhere(items);
  }, [items, hydrated]);

  /** Marca un dispositivo como reconocido (quita la insignia «Nuevo»). */
  const markKnown = (id: string) =>
    setItems((prev) =>
      prev.map((d) => (d.id === id ? { ...d, isNew: false, trusted: true } : d)),
    );

  /** Avisa de los dispositivos recién detectados con acceso directo a su ficha. */
  const announceNew = (fresh: Device[]) => {
    for (const device of fresh.slice(0, 3)) {
      toast.warning(`Nuevo dispositivo detectado: ${device.name}`, {
        description: `${device.ip} · ${device.vendor}`,
        duration: 12000,
        action: {
          label: "Ver ficha",
          onClick: () => setSelectedId(device.id),
        },
        cancel: {
          label: "Reconocer",
          onClick: () => markKnown(device.id),
        },
      });
    }
    if (fresh.length > 3) {
      toast.warning(`Y ${fresh.length - 3} dispositivos nuevos más en tu red.`);
    }
  };

  /** Fusiona el escaneo con la lista conocida y devuelve los dispositivos nuevos. */
  const applyScan = async (devices: Device[], source: NonNullable<ScanMeta["source"]>) => {
    const resolved = await enrichDevicesWithResolvedVendors(devices);
    const known = new Set(itemsRef.current.map((d) => d.id));
    const merged = mergeScan(itemsRef.current, resolved);
    setItems(merged);
    void saveDevicesAnywhere(merged);
    const next: ScanMeta = { lastScanAt: new Date().toISOString(), source };
    setMeta(next);
    saveScanMeta(next);
    resolveVendorsInBackground(resolved, (external) => {
      const byId = new Map(external.map((device) => [device.id, device]));
      setItems((prev) => {
        const updated = prev.map((device) => {
          const fresh = byId.get(device.id);
          if (!fresh || device.manualEdit || !fresh.brand || fresh.brand === "unknown") return device;
          return { ...device, vendor: fresh.vendor, brand: fresh.brand };
        });
        void saveDevicesAnywhere(updated);
        return updated;
      });
    });
    // Nuevos de este escaneo: no estaban registrados antes de fusionar.
    const justFound = merged.filter((d) => !known.has(d.id) && d.isNew && !d.trusted);
    if (justFound.length > 0) announceNew(justFound);
    return justFound.length;
  };

  const trustAll = () =>
    setItems((prev) => prev.map((d) => (d.isNew ? { ...d, isNew: false, trusted: true } : d)));

  /**
   * Escaneo de red. En modo silencioso (auto-escaneo) no toca los avisos de la
   * interfaz ni los filtros: solo actualiza estados y registra los nuevos.
   */
  const runScan = async (silent = false) => {
    if (busyRef.current) return;
    busyRef.current = true;
    if (silent) setAutoScanning(true);
    else {
      setScanning(true);
      setStatus("checking");
      setNotice(null);
    }
    try {
      // 1) En escritorio (Tauri/Electron): escaneo ARP nativo del sistema.
      const native = await nativeScan();
      if (native && native.length > 0) {
        setStatus("connected");
        const fresh = await applyScan(native, "native");
        if (!silent)
          setNotice(
            `Escaneo nativo completado: ${native.length} dispositivos detectados` +
              (fresh > 0 ? ` · ${fresh} nuevos.` : "."),
          );
        return;
      }
      // 2) Fallback: agente local en http://localhost:8765/scan.
      const devices = await fetchFromAgent();
      setStatus("connected");
      const fresh = await applyScan(devices, "agent");
      if (!silent)
        setNotice(
          `Escaneo completado: ${devices.length} dispositivos detectados` +
            (fresh > 0 ? ` · ${fresh} nuevos.` : "."),
        );
    } catch {
      setStatus("disconnected");
      if (!silent)
        setNotice(
          "No se ha podido escanear la red. Inicia el agente local (http://localhost:8765/scan), usa la app portable o importa los datos manualmente.",
        );
    } finally {
      busyRef.current = false;
      setScanning(false);
      setAutoScanning(false);
    }
  };

  const scan = () => void runScan(false);

  const scanRef = useRef(runScan);
  scanRef.current = runScan;

  // Recupera el intervalo guardado de monitorización automática.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(AUTO_KEY);
      if (raw !== null) {
        const value = Number(raw);
        if (autoOptions.some((o) => o.value === value)) {
          setAutoInterval(value);
          setCountdown(value);
        }
      }
    } catch {
      /* sin almacenamiento */
    }
  }, []);

  // Cuenta atrás y disparo del escaneo periódico en segundo plano.
  useEffect(() => {
    if (!hydrated || autoInterval === 0) {
      setCountdown(0);
      return;
    }
    setCountdown(autoInterval);
    const id = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          void scanRef.current(true);
          return autoInterval;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [autoInterval, hydrated]);

  const changeAutoInterval = (value: number) => {
    setAutoInterval(value);
    setCountdown(value);
    try {
      window.localStorage.setItem(AUTO_KEY, String(value));
    } catch {
      /* sin almacenamiento */
    }
  };

  /** Vacía el inventario por completo (borra escaneos guardados y dispositivos). */
  const resetData = () => {
    clearStoredData();
    setItems([]);
    setMeta({ lastScanAt: null, source: null });
    void saveDevicesAnywhere([]);
    setNotice("Datos borrados: el inventario está vacío. Escanea tu red para empezar.");
  };

  const online = items.filter((d) => d.status === "online");
  const totalDown = online.reduce((sum, d) => sum + d.downstream, 0);
  const totalUp = online.reduce((sum, d) => sum + d.upstream, 0);
  const intruders = newDevices(items);

  /** Sin inventario y ya cargado el almacenamiento: pantalla de bienvenida. */
  const showEmpty = hydrated && items.length === 0;

  const networkCounts = useMemo(() => countByNetwork(items), [items]);
  const detectedNetworks = useMemo(() => detectNetworks(items), [items]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((d) => {
      if (filter !== "all" && d.type !== filter) return false;
      if (network !== ALL_NETWORKS && (networkOf(d) ?? "unknown") !== network) return false;
      if (onlyOnline && d.status !== "online") return false;
      if (!q) return true;
      return [d.name, d.ip, d.mac, d.vendor, ...d.tags]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [items, filter, network, onlyOnline, query]);

  const selected = items.find((d) => d.id === selectedId) ?? null;

  const update = (device: Device) =>
    setItems((prev) => prev.map((d) => (d.id === device.id ? device : d)));

  /** Olvida el dispositivo: desaparece de la lista y del almacenamiento local. */
  const remove = (device: Device) => {
    const next = items.filter((d) => d.id !== device.id);
    setItems(next);
    void saveDevicesAnywhere(next);
    setSelectedId(null);
    setNotice(
      `«${device.name}» eliminado de la lista. Si vuelve a aparecer en un escaneo se marcará como nuevo.`,
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-4">
          <img
            src="/app-icon.png"
            alt="NetHub"
            width={36}
            height={36}
            className="size-9 rounded-lg"
          />
          <div className="flex-1">
            <h1 className="text-lg font-semibold leading-none">NetHub</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Red doméstica · {runtimeLabels[runtime]} · v{APP_VERSION}
            </p>
          </div>
          <StatusPill status={status} />
          <button
            onClick={() => setUpdateOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <RefreshCw className="size-4" />
            Actualizaciones
          </button>

          <button
            onClick={scan}
            disabled={scanning}
            className="inline-flex items-center gap-2 rounded-md bg-brand px-3.5 py-2 text-sm font-medium text-brand-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {scanning ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Radar className="size-4" />
            )}
            {scanning ? "Escaneando…" : "Escanear red"}
          </button>
          <button
            onClick={() => setDark((v) => !v)}
            className="rounded-md border border-border p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label={dark ? "Activar modo claro" : "Activar modo oscuro"}
          >
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8">
        <section className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl border border-border bg-card px-5 py-4 text-xs">
          <span className="text-muted-foreground">
            Último escaneo:{" "}
            <span className="font-mono text-foreground">
              {formatScanTime(meta.lastScanAt)}
            </span>
            {meta.source && (
              <span className="text-muted-foreground"> · origen: {sourceLabels[meta.source]}</span>
            )}
          </span>
          <span className="min-w-0 max-w-full truncate text-muted-foreground" title={dbPath}>
            Datos en <span className="font-mono text-foreground">{dbPath}</span>
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-muted-foreground">
              {autoInterval > 0 ? (
                <span className="relative flex size-2">
                  <span
                    className={cn(
                      "absolute inline-flex size-2 rounded-full bg-brand opacity-75",
                      autoScanning ? "animate-ping" : "animate-pulse",
                    )}
                  />
                  <span className="relative inline-flex size-2 rounded-full bg-brand" />
                </span>
              ) : (
                <Timer className="size-3.5" />
              )}
              <span className="font-mono">
                {autoInterval === 0
                  ? "Auto-escaneo en pausa"
                  : autoScanning
                    ? "Escaneando en segundo plano…"
                    : `Próximo escaneo en ${formatCountdown(countdown)}`}
              </span>
              <select
                value={autoInterval}
                onChange={(e) => changeAutoInterval(Number(e.target.value))}
                aria-label="Intervalo de monitorización automática"
                className="rounded border border-input bg-popover px-1.5 py-0.5 text-xs text-popover-foreground outline-none focus:border-brand"
              >
                {autoOptions.map((o) => (
                  <option key={o.value} value={o.value} className="bg-popover text-popover-foreground">
                    {o.label}
                  </option>
                ))}
              </select>
            </span>
            <button
              onClick={() => {
                exportInventoryCsv(items);
                setNotice(
                  `Inventario exportado en CSV con ${items.length} dispositivos, listo para hoja de cálculo.`,
                );
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <FileSpreadsheet className="size-3.5" />
              Exportar inventario (CSV)
            </button>
            <button
              onClick={resetData}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <RotateCcw className="size-3.5" />
              Restablecer
            </button>
          </div>
        </section>

        {notice && (
          <p className="mb-6 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            {notice}
          </p>
        )}

        {intruders.length > 0 && (
          <section className="mb-6 rounded-2xl border border-warning/40 bg-warning/10 p-5">
            <div className="flex flex-wrap items-start gap-4">
              <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warning" />
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold text-warning">
                  {intruders.length} dispositivo{intruders.length > 1 ? "s" : ""} nuevo
                  {intruders.length > 1 ? "s" : ""} en tu red
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Visto{intruders.length > 1 ? "s" : ""} por primera vez en el último
                  escaneo:{" "}
                  {intruders
                    .slice(0, 4)
                    .map((d) => `${d.name} (${d.ip})`)
                    .join(", ")}
                  {intruders.length > 4 ? "…" : ""}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedId(intruders[0]!.id)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-warning/50 px-3 py-1.5 text-xs text-warning transition-colors hover:bg-warning/15"
                  >
                    <Sparkles className="size-3.5" /> Revisar el primero
                  </button>
                  <button
                    onClick={trustAll}
                    className="inline-flex items-center gap-1.5 rounded-md bg-success px-3 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-90"
                  >
                    <ShieldCheck className="size-3.5" /> Marcar todos como conocidos
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {showEmpty && (
          <section className="rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-brand/15 text-brand">
              <Radar className="size-7" />
            </div>
            <h2 className="mt-4 text-lg font-semibold">Todavía no hay dispositivos</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Escanea tu red para descubrir automáticamente PCs, consolas, Smart TVs,
              Home Assistant e IoT.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={scan}
                disabled={scanning}
                className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2.5 text-sm font-medium text-brand-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {scanning ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Radar className="size-4" />
                )}
                {scanning ? "Escaneando…" : "Escanear red"}
              </button>
            </div>
          </section>
        )}

        {!showEmpty && (
          <>
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                icon={<Wifi className="size-4" />}
            label="Dispositivos activos"
            value={`${online.length}`}
            hint={`de ${items.length} conocidos`}
            accent
          />
          <Stat
            icon={<WifiOff className="size-4" />}
            label="Inactivos"
            value={`${items.length - online.length}`}
            hint="sin conexión reciente"
          />
          <Stat
            icon={<ArrowDownUp className="size-4" />}
            label="Descarga total"
            value={`${totalDown.toFixed(0)} Mbps`}
            hint={`subida ${totalUp.toFixed(0)} Mbps`}
          />
          <Stat
            icon={<Activity className="size-4" />}
            label="Uso del enlace"
            value={`${Math.min(100, Math.round((totalDown / 600) * 100))}%`}
            hint="sobre 600 Mbps contratados"
          />
        </section>

        <section className="mt-6 rounded-2xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold">
              Tráfico en tiempo real (últimos 60 s)
            </h2>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-2 animate-ping rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
              En vivo
            </span>
          </div>
          <BandwidthChart />
        </section>

        <SpeedTestPanel />

        <section className="mt-8">
          <h2 className="text-base font-semibold">Redes detectadas</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Las subredes se detectan solas a partir de las IP encontradas; puedes cambiar
            la red de un equipo en su ficha de detalle.
          </p>
          <div className="mt-3">
            <NetworkTabs
              value={network}
              counts={networkCounts}
              networks={detectedNetworks}
              onChange={setNetwork}
            />
          </div>
        </section>

        <section className="mt-8">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="mr-auto text-base font-semibold">
              Dispositivos{" "}
              <span className="text-muted-foreground">({visible.length})</span>
            </h2>
            <label className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar nombre, IP, MAC…"
                className="w-56 rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-brand"
              />
            </label>
            <button
              onClick={() => setOnlyOnline((v) => !v)}
              className={cn(
                "rounded-md border px-3 py-2 text-sm transition-colors",
                onlyOnline
                  ? "border-brand bg-brand/10 text-brand"
                  : "border-border text-muted-foreground hover:bg-accent",
              )}
            >
              Solo activos
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {filters.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                  filter === f.value
                    ? "border-brand bg-brand text-brand-foreground"
                    : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {f.value !== "all" && <DeviceTypeIcon type={f.value} />}
                {f.label}
              </button>
            ))}
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {visible.map((d) => (
              <button
                key={d.id}
                onClick={() => setSelectedId(d.id)}
                className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-brand"
              >
                <span
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-lg",
                    d.status === "online"
                      ? "bg-brand/15 text-brand"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  <DeviceTypeIcon type={d.type} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-medium">{d.name}</span>
                    <span
                      className={cn(
                        "size-1.5 shrink-0 rounded-full",
                        d.status === "online" ? "bg-success" : "bg-muted-foreground",
                      )}
                    />
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5 truncate font-mono text-xs text-muted-foreground">
                    <VendorIcon brand={d.brand} className="size-3.5 shrink-0" />
                    <span className="truncate">
                      {d.ip} · {d.vendor}
                    </span>
                  </span>
                  <span className="mt-1.5 flex flex-wrap gap-1.5">
                    {d.isNew && !d.trusted && (
                      <Badge className="bg-warning/15 text-warning">Nuevo</Badge>
                    )}
                    {d.trusted && (
                      <Badge className="bg-success/15 text-success">Confiable</Badge>
                    )}
                    {d.blocked && (
                      <Badge className="bg-destructive/15 text-destructive">
                        Bloqueado
                      </Badge>
                    )}
                    {d.prioritized && (
                      <Badge className="bg-warning/15 text-warning">QoS</Badge>
                    )}
                    {d.tags.slice(0, 2).map((t) => (
                      <Badge key={t} className="bg-muted text-muted-foreground">
                        {t}
                      </Badge>
                    ))}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-mono text-sm">
                    {d.downstream.toFixed(1)}
                  </span>
                  <span className="block text-[11px] text-muted-foreground">Mbps</span>
                </span>
              </button>
            ))}
          </div>

          {visible.length === 0 && (
            <p className="mt-8 text-center text-sm text-muted-foreground">
              Ningún dispositivo coincide con los filtros aplicados.
            </p>
          )}
            </section>
          </>
        )}
      </main>

      <DeviceDetailPanel
        device={selected}
        onClose={() => setSelectedId(null)}
        onUpdate={update}
        onDelete={remove}
        networks={detectedNetworks}
      />

      <UpdateModal open={updateOpen} onClose={() => setUpdateOpen(false)} />
    </div>

  );
}

const sourceLabels: Record<NonNullable<ScanMeta["source"]>, string> = {
  agent: "agente local",
  native: "escaneo nativo",
  arp: "arp -a importado",
  json: "archivo JSON",
  demo: "datos de ejemplo",
};

function StatusPill({ status }: { status: ScannerStatus }) {
  const map: Record<ScannerStatus, { label: string; className: string; dot: string }> = {
    unknown: {
      label: "Escáner sin comprobar",
      className: "bg-muted text-muted-foreground",
      dot: "bg-muted-foreground",
    },
    checking: {
      label: "Comprobando…",
      className: "bg-warning/15 text-warning",
      dot: "bg-warning animate-pulse",
    },
    connected: {
      label: "Conectado",
      className: "bg-success/15 text-success",
      dot: "bg-success",
    },
    disconnected: {
      label: "Desconectado",
      className: "bg-destructive/15 text-destructive",
      dot: "bg-destructive",
    },
  };
  const s = map[status];
  return (
    <span
      className={cn(
        "hidden items-center gap-2 rounded-full px-3 py-1 text-xs font-medium md:inline-flex",
        s.className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}

function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        className,
      )}
    >
      {children}
    </span>
  );
}

function Stat({
  icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div
        className={cn(
          "flex size-8 items-center justify-center rounded-lg",
          accent ? "bg-brand/15 text-brand" : "bg-muted text-muted-foreground",
        )}
      >
        {icon}
      </div>
      <p className="mt-3 text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
