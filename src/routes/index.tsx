import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDownUp,
  Gamepad2,
  HouseWifi,
  Laptop,
  Loader2,
  Moon,
  Radar,
  Radio,
  RotateCcw,
  Search,
  Settings2,
  Sun,
  Tv,
  Upload,
  Wifi,
  WifiOff,
} from "lucide-react";
import {
  bandwidthSeries,
  deviceTypeLabels,
  devices as seedDevices,
  type Device,
  type DeviceType,
} from "@/lib/devices";
import {
  clearStoredData,
  fetchFromAgent,
  formatScanTime,
  loadScanMeta,
  loadStoredDevices,
  saveDevices,
  saveScanMeta,
  type ScanMeta,
  type ScannerStatus,
} from "@/lib/scanner";
import { BandwidthChart } from "@/components/network/BandwidthChart";
import { DeviceDetailPanel } from "@/components/network/DeviceDetailPanel";
import { ImportDevicesModal } from "@/components/network/ImportDevicesModal";
import { ScannerSetupModal } from "@/components/network/ScannerSetupModal";
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
      {
        property: "og:description",
        content:
          "Vista general de la red, filtros por tipo de dispositivo y panel de detalle con control y etiquetado.",
      },
    ],
  }),
  component: Dashboard,
});

const typeIcons: Record<DeviceType, React.ReactNode> = {
  pc: <Laptop className="size-4" />,
  console: <Gamepad2 className="size-4" />,
  tv: <Tv className="size-4" />,
  "home-assistant": <HouseWifi className="size-4" />,
  iot: <Radio className="size-4" />,
};

const filters: Array<{ value: DeviceType | "all"; label: string }> = [
  { value: "all", label: "Todos" },
  ...(Object.keys(deviceTypeLabels) as DeviceType[]).map((t) => ({
    value: t,
    label: deviceTypeLabels[t],
  })),
];

function Dashboard() {
  const [items, setItems] = useState<Device[]>(seedDevices);
  const [filter, setFilter] = useState<DeviceType | "all">("all");
  const [query, setQuery] = useState("");
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

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  // Restaura la última lista guardada en este navegador.
  useEffect(() => {
    const stored = loadStoredDevices();
    if (stored && stored.length > 0) setItems(stored);
    setMeta(loadScanMeta());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveDevices(items);
  }, [items, hydrated]);

  const applyScan = (devices: Device[], source: NonNullable<ScanMeta["source"]>) => {
    setItems(devices);
    const next: ScanMeta = { lastScanAt: new Date().toISOString(), source };
    setMeta(next);
    saveScanMeta(next);
    saveDevices(devices);
  };

  const scan = async () => {
    setScanning(true);
    setStatus("checking");
    setNotice(null);
    try {
      const devices = await fetchFromAgent();
      setStatus("connected");
      applyScan(devices, "agent");
      setNotice(`Escaneo completado: ${devices.length} dispositivos detectados.`);
    } catch {
      setStatus("disconnected");
      setNotice(
        "No se ha podido contactar con el agente local en http://localhost:8765/scan. Configúralo o importa los datos manualmente.",
      );
    } finally {
      setScanning(false);
    }
  };

  const resetDemo = () => {
    clearStoredData();
    setItems(seedDevices);
    setMeta({ lastScanAt: null, source: null });
    setNotice("Datos guardados borrados. Se muestra de nuevo la red de ejemplo.");
  };

  const online = items.filter((d) => d.status === "online");
  const totalDown = online.reduce((sum, d) => sum + d.downstream, 0);
  const totalUp = online.reduce((sum, d) => sum + d.upstream, 0);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((d) => {
      if (filter !== "all" && d.type !== filter) return false;
      if (onlyOnline && d.status !== "online") return false;
      if (!q) return true;
      return [d.name, d.ip, d.mac, d.vendor, ...d.tags]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [items, filter, onlyOnline, query]);

  const selected = items.find((d) => d.id === selectedId) ?? null;

  const update = (device: Device) =>
    setItems((prev) => prev.map((d) => (d.id === device.id ? device : d)));

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
              Red doméstica · 192.168.1.0/24
            </p>
          </div>
          <span className="hidden items-center gap-2 rounded-full bg-success/15 px-3 py-1 text-xs font-medium text-success sm:inline-flex">
            <span className="size-1.5 animate-pulse rounded-full bg-success" />
            Router en línea
          </span>
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
                {f.value !== "all" && typeIcons[f.value]}
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
                  {typeIcons[d.type]}
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
                  <span className="mt-0.5 block truncate font-mono text-xs text-muted-foreground">
                    {d.ip} · {d.vendor}
                  </span>
                  <span className="mt-1.5 flex flex-wrap gap-1.5">
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
      />
    </div>
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
