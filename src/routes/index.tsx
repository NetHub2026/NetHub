import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDownUp,
  Download,
  FileSpreadsheet,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Loader2,
  Moon,
  Package,
  Radar,
  RotateCcw,
  Search,
  Settings2,
  Sun,
  Upload,
  Wifi,
  WifiOff,
} from "lucide-react";
import {
  bandwidthSeries,
  deviceTypeLabels,
  type Device,
  type DeviceType,
} from "@/lib/devices";
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
  downloadDevicesJson,
  getDbPath,
  getRuntime,
  nativeScan,
  runtimeLabels,
  type Runtime,
} from "@/lib/desktop";
import { loadDevicesAnywhere, saveDevicesAnywhere } from "@/lib/persistence";
import { exportInventoryCsv, exportInventoryJson } from "@/lib/backup";
import { ALL_NETWORKS, countByNetwork, networkOf } from "@/lib/networks";
import { BandwidthChart } from "@/components/network/BandwidthChart";
import { DeviceDetailPanel } from "@/components/network/DeviceDetailPanel";
import {
  ImportDevicesModal,
  type RestoreMode,
} from "@/components/network/ImportDevicesModal";
import { NetworkTabs } from "@/components/network/NetworkTabs";
import { PackageAppModal } from "@/components/network/PackageAppModal";
import { ScannerSetupModal } from "@/components/network/ScannerSetupModal";
import { SpeedTestPanel } from "@/components/network/SpeedTestPanel";
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
  const [setupOpen, setSetupOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [packageOpen, setPackageOpen] = useState(false);
  const [runtime, setRuntime] = useState<Runtime>("web");
  const [dbPath, setDbPath] = useState("Almacenamiento del navegador (localStorage)");

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

  /** Fusiona el escaneo con la lista conocida y devuelve cuántos son nuevos. */
  const applyScan = async (devices: Device[], source: NonNullable<ScanMeta["source"]>) => {
    const resolved = await enrichDevicesWithResolvedVendors(devices);
    const merged = mergeScan(items, resolved);
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
    return newDevices(merged).length;
  };

  const trustAll = () =>
    setItems((prev) => prev.map((d) => (d.isNew ? { ...d, isNew: false, trusted: true } : d)));

  const scan = async () => {
    setScanning(true);
    setStatus("checking");
    setNotice(null);
    try {
      // 1) En escritorio (Tauri/Electron): escaneo ARP nativo del sistema.
      const native = await nativeScan();
      if (native && native.length > 0) {
        setStatus("connected");
        const fresh = await applyScan(native, "native");
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
      setNotice(
        `Escaneo completado: ${devices.length} dispositivos detectados` +
          (fresh > 0 ? ` · ${fresh} nuevos.` : "."),
      );
    } catch {
      setStatus("disconnected");
      setNotice(
        "No se ha podido escanear la red. Inicia el agente local (http://localhost:8765/scan), usa la app portable o importa los datos manualmente.",
      );
    } finally {
      setScanning(false);
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

  const networkCounts = useMemo(() => countByNetwork(items), [items]);

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

  /** Restaura una copia de seguridad, fusionando o reemplazando el inventario. */
  const restore = (backup: Device[], mode: RestoreMode) => {
    const next =
      mode === "replace"
        ? backup
        : (() => {
            const byId = new Map(items.map((d) => [d.id, d]));
            for (const device of backup) {
              const existing = byId.get(device.id);
              byId.set(device.id, existing ? { ...existing, ...device } : device);
            }
            return [...byId.values()];
          })();
    setItems(next);
    void saveDevicesAnywhere(next);
    setNotice(
      mode === "replace"
        ? `Copia restaurada: el inventario se ha reemplazado con ${backup.length} dispositivos.`
        : `Copia restaurada: ${backup.length} dispositivos fusionados con tu inventario (${next.length} en total).`,
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-4">
          <div className="flex size-9 items-center justify-center rounded-lg bg-brand text-brand-foreground">
            <Wifi className="size-5" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-semibold leading-none">NetHub</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Red doméstica · {runtimeLabels[runtime]}
            </p>
          </div>
          <StatusPill status={status} />
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
            onClick={() => setImportOpen(true)}
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Upload className="size-4" />
            <span className="hidden sm:inline">Importar</span>
          </button>
          <button
            onClick={() => setSetupOpen(true)}
            className="rounded-md border border-border p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Configurar escáner Windows"
            title="Configurar escáner Windows"
          >
            <Settings2 className="size-4" />
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
          <div className="ml-auto flex flex-wrap gap-2">
            <button
              onClick={() => setPackageOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-brand px-3 py-1.5 font-medium text-brand transition-colors hover:bg-brand/10"
            >
              <Package className="size-3.5" />
              Empaquetar App Portable
            </button>
            <button
              onClick={() => {
                exportInventoryJson(items);
                setNotice(
                  `Inventario exportado en JSON con ${items.length} dispositivos, etiquetas y notas incluidas.`,
                );
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Download className="size-3.5" />
              Exportar inventario (JSON)
            </button>
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
              onClick={() => downloadDevicesJson(items)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Download className="size-3.5" />
              devices-db.json
            </button>
            <button
              onClick={resetDemo}
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
            <h2 className="text-base font-semibold">Ancho de banda (24 h)</h2>
            <p className="text-xs text-muted-foreground">
              Datos simulados · listo para conectar a la API del router
            </p>
          </div>
          <BandwidthChart data={bandwidthSeries} />
        </section>

        <SpeedTestPanel />

        <section className="mt-8">
          <h2 className="text-base font-semibold">Redes y routers</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Cada equipo se clasifica por su subred; puedes cambiar su red en la ficha de
            detalle.
          </p>
          <div className="mt-3">
            <NetworkTabs value={network} counts={networkCounts} onChange={setNetwork} />
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
      </main>

      <DeviceDetailPanel
        device={selected}
        onClose={() => setSelectedId(null)}
        onUpdate={update}
        onDelete={remove}
      />
      <ScannerSetupModal open={setupOpen} onClose={() => setSetupOpen(false)} />
      <ImportDevicesModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={(devices, source) => {
          void (async () => {
            const fresh = await applyScan(devices, source);
            setNotice(
              `Importados ${devices.length} dispositivos y guardados localmente` +
                (fresh > 0 ? ` · ${fresh} nuevos.` : "."),
            );
          })();
        }}
        onRestore={restore}
      />
      <PackageAppModal
        open={packageOpen}
        onClose={() => setPackageOpen(false)}
        dbPath={dbPath}
        runtimeLabel={runtimeLabels[runtime]}
      />
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
