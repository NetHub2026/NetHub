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
  LayoutGrid,
  Moon,
  Radar,
  RefreshCw,
  MapPin,
  Cable,
  Search,
  Settings as SettingsIcon,
  Sun,
  Users,
  Wifi,
  WifiOff,
  Waypoints,
  BarChart3,
  Gauge,
  Siren,
  Home as HomeIcon,
} from "lucide-react";
import { deviceTypeLabels, type Device, type DeviceType } from "@/lib/devices";
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
  isRandomizedMac,
  newDevices,
  resolveVendorsInBackground,
  saveScanMeta,
  type ScanMeta,
  type ScannerStatus,
} from "@/lib/scanner";
import {
  APP_VERSION,
  applyNativeSettings,
  getDbPath,
  getRuntime,
  nativeScan,
  notifyNative,
  onDesktopScanRequest,
  readLiveTraffic,
  runtimeLabels,
  type Runtime,
  type TrafficSample,
} from "@/lib/desktop";
import {
  defaultSettings,
  loadSettingsAnywhere,
  resolveDark,
  saveSettingsAnywhere,
  type Settings,
} from "@/lib/settings";
import { SettingsModal } from "@/components/network/SettingsModal";
import { UsageView } from "@/components/network/UsageView";
import { HomeTwin } from "@/components/network/HomeTwin";
import { emptyPatternState, evaluatePatterns, type PatternState } from "@/lib/patterns";
import { loadPatternsAnywhere, savePatternsAnywhere } from "@/lib/persistence";
import { SlaView } from "@/components/network/SlaView";
import { AwayMode } from "@/components/network/AwayMode";
import { emptyUsageState, recordUsageScan, type UsageState } from "@/lib/usage";
import {
  addAwayActivity,
  armAway,
  disarmAway,
  emptyAwayState,
  evaluateAway,
  type AwayState,
} from "@/lib/away";
import { appendSlaSample, type SlaSample } from "@/lib/sla";
import { runSpeedTest, speedTestBusy } from "@/lib/speedtest";
import {
  loadUsageAnywhere,
  saveUsageAnywhere,
  loadAwayAnywhere,
  saveAwayAnywhere,
  loadSlaAnywhere,
  saveSlaAnywhere,
} from "@/lib/persistence";
import {
  loadDevicesAnywhere,
  loadDirectoryAnywhere,
  saveDevicesAnywhere,
  saveDirectoryAnywhere,
  loadEventsAnywhere,
  saveEventsAnywhere,
} from "@/lib/persistence";
import { exportInventoryCsv } from "@/lib/backup";
import { ALL_NETWORKS, countByNetwork, detectNetworks, networkOf } from "@/lib/networks";
import { BandwidthChart } from "@/components/network/BandwidthChart";
import { DeviceDetailPanel } from "@/components/network/DeviceDetailPanel";
import { NetworkTabs } from "@/components/network/NetworkTabs";
import { NetworkTopology } from "@/components/network/NetworkTopology";
import { ActivityTimeline } from "@/components/network/ActivityTimeline";
import { appendEvents, diffActivity, type ActivityEvent } from "@/lib/activity";
import { History as HistoryIcon, ShieldCheck as ShieldIcon, HeartPulse } from "lucide-react";
import { SecurityView } from "@/components/network/SecurityView";
import { HealthRadar } from "@/components/network/HealthRadar";
import {
  appendAlerts,
  intruderAlerts,
  ipConflictAlerts,
  playAlertSound,
  type SentinelAlert,
} from "@/lib/sentinel";
import { healthTargets, probeHealth, MAX_HEALTH_SAMPLES, type HealthSample } from "@/lib/health";
import {
  loadAlertsAnywhere,
  saveAlertsAnywhere,
  loadHealthAnywhere,
  saveHealthAnywhere,
} from "@/lib/persistence";
import { SpeedTestPanel } from "@/components/network/SpeedTestPanel";
import { UpdateModal } from "@/components/network/UpdateModal";
import { DeviceTypeIcon } from "@/components/network/DeviceTypeIcon";
import { InventoryIdentityBadge } from "@/components/network/IdentityBadge";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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

/** Etiquetas de conexión: se muestran como icono, no como etiqueta de texto. */
const WIFI_TAGS = ["Wi-Fi", "Wi-Fi 2.4GHz", "Wi-Fi 5GHz", "Wi-Fi 6"];
const WIRED_TAG = "Cableado / Ethernet";

function connectionOf(device: Device): "wifi" | "wired" | null {
  if (device.tags.some((t) => WIFI_TAGS.includes(t))) return "wifi";
  if (device.tags.includes(WIRED_TAG)) return "wired";
  return null;
}

/** Etiquetas visibles: sin las de conexión (ya representadas con su icono). */
function visibleTags(device: Device): string[] {
  return device.tags.filter((t) => !WIFI_TAGS.includes(t) && t !== WIRED_TAG);
}

function Dashboard() {
  const [items, setItems] = useState<Device[]>([]);
  const [viewMode, setViewMode] = useState<
    "inventory" | "topology" | "activity" | "security" | "health" | "usage" | "sla" | "home"
  >("inventory");
  const [alerts, setAlerts] = useState<SentinelAlert[]>([]);
  const updateAlerts = (fn: (prev: SentinelAlert[]) => SentinelAlert[]) =>
    setAlerts((prev) => {
      const next = fn(prev);
      void saveAlertsAnywhere(next);
      return next;
    });
  const [healthSamples, setHealthSamples] = useState<HealthSample[]>([]);
  const [probing, setProbing] = useState(false);
  /** Uso por equipo (minutos online por día). */
  const [usageState, setUsageState] = useState<UsageState>(emptyUsageState());
  const [patterns, setPatterns] = useState<PatternState>(emptyPatternState());
  const patternsRef = useRef<PatternState>(emptyPatternState());
  const rxRef = useRef<number | null>(null);
  /** Modo Ausente. */
  const [awayState, setAwayState] = useState<AwayState>(emptyAwayState());
  /** Historial del SLA del operador. */
  const [slaSamples, setSlaSamples] = useState<SlaSample[]>([]);
  const [slaRunning, setSlaRunning] = useState(false);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const recordEvents = (added: ActivityEvent[]) => {
    if (added.length === 0) return;
    setEvents((prev) => {
      const next = appendEvents(prev, added);
      void saveEventsAnywhere(next);
      return next;
    });
  };
  const [filter, setFilter] = useState<DeviceType | "all">("all");
  const [query, setQuery] = useState("");
  const [network, setNetwork] = useState<string>(ALL_NETWORKS);
  const [onlyOnline, setOnlyOnline] = useState(false);
  /** Listas de personas y ubicaciones creadas por el usuario. */
  const [directory, setDirectory] = useState<Directory>(emptyDirectory);
  const [personFilter, setPersonFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** Preferencias del usuario (tema, velocidad contratada, alertas…). */
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [systemDark, setSystemDark] = useState(true);
  /** Tráfico real del adaptador de red de este equipo. */
  const [traffic, setTraffic] = useState<TrafficSample>({
    rxMbps: 0,
    txMbps: 0,
    totalMbps: 0,
  });
  const [status, setStatus] = useState<ScannerStatus>("unknown");
  const [scanning, setScanning] = useState(false);
  const [meta, setMeta] = useState<ScanMeta & { detectedCount?: number }>({
    lastScanAt: null,
    source: null,
  });
  const [notice, setNotice] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [runtime, setRuntime] = useState<Runtime>("web");
  const [dbPath, setDbPath] = useState("Almacenamiento del navegador (localStorage)");
  const [updateOpen, setUpdateOpen] = useState(false);
  const [, setCountdown] = useState(120);
  const [autoScanning, setAutoScanning] = useState(false);
  /** Evita escaneos solapados (manual + automático). */
  const busyRef = useRef(false);
  const itemsRef = useRef<Device[]>([]);
  itemsRef.current = items;
  const settingsRef = useRef<Settings>(settings);
  settingsRef.current = settings;
  const awayRef = useRef<AwayState>(awayState);
  awayRef.current = awayState;
  const slaRunningRef = useRef(false);

  /** Test de velocidad para el informe SLA (manual o programado). */
  const runSlaTest = async () => {
    if (slaRunningRef.current || speedTestBusy()) {
      toast.message("Ya hay un test de velocidad en curso");
      return;
    }
    slaRunningRef.current = true;
    setSlaRunning(true);
    try {
      const r = await runSpeedTest();
      setSlaSamples((prev) => {
        const next = appendSlaSample(prev, {
          at: r.at,
          download: r.download,
          upload: r.upload,
          ping: r.ping,
        });
        void saveSlaAnywhere(next);
        return next;
      });
    } catch {
      toast.error("No se pudo completar el test de velocidad");
    } finally {
      slaRunningRef.current = false;
      setSlaRunning(false);
    }
  };

  // Test SLA programado.
  useEffect(() => {
    const minutes = settings.slaIntervalMinutes;
    if (!minutes) return;
    const id = window.setInterval(() => void runSlaTest(), minutes * 60_000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.slaIntervalMinutes]);

  /** Intervalo del auto-escaneo, tomado de la configuración. */
  const autoInterval = settings.scanIntervalSeconds;
  const dark = settings.theme === "auto" ? systemDark : settings.theme === "dark";

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  // Sigue el tema del sistema para la opción «Automático».
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(media.matches);
    const listener = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);

  // Carga las preferencias (settings.json en escritorio, localStorage si no)
  // y las aplica al sistema.
  useEffect(() => {
    setSystemDark(resolveDark("auto"));
    void loadSettingsAnywhere().then((stored) => {
      setSettings(stored);
      setCountdown(stored.scanIntervalSeconds);
      void applyNativeSettings(stored);
    });
  }, []);

  /** Guarda un cambio de preferencias (disco + navegador) y lo aplica al sistema. */
  const updateSettings = (patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      void saveSettingsAnywhere(next);
      void applyNativeSettings(next);
      return next;
    });
  };

  // Telemetría real del adaptador de red: una muestra por segundo.
  useEffect(() => {
    let cancelled = false;
    let last: TrafficSample = { rxMbps: 0, txMbps: 0, totalMbps: 0 };
    const tick = async () => {
      const sample = await readLiveTraffic(last);
      if (cancelled) return;
      last = sample;
      setTraffic(sample);
      rxRef.current = sample.rxMbps;
    };
    void tick();
    const id = window.setInterval(() => void tick(), 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  // Restaura la última lista guardada (archivo local en escritorio, localStorage en web).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const stored = await loadDevicesAnywhere();
      if (cancelled) return;
      if (stored && stored.length > 0) setItems(stored);
      setDirectory(await loadDirectoryAnywhere(stored ?? []));
      setEvents(await loadEventsAnywhere());
      setAlerts(await loadAlertsAnywhere());
      setHealthSamples(await loadHealthAnywhere());
      setUsageState(await loadUsageAnywhere());
      {
        const pt = await loadPatternsAnywhere();
        patternsRef.current = pt;
        setPatterns(pt);
      }
      setAwayState(await loadAwayAnywhere());
      setSlaSamples(await loadSlaAnywhere());
      if (cancelled) return;
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
    setItems((prev) => prev.map((d) => (d.id === id ? { ...d, isNew: false, trusted: true } : d)));

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
    // Aviso nativo de Windows (si está activado en Configuración).
    if (settingsRef.current.notifyNewDevices && fresh[0]) {
      const first = fresh[0];
      void notifyNative(
        fresh.length === 1
          ? "Nuevo dispositivo en tu red"
          : `${fresh.length} dispositivos nuevos en tu red`,
        `${first.name} · ${first.ip} · ${first.vendor}`,
      );
    }
  };

  /** Fusiona el escaneo con la lista conocida y devuelve los dispositivos nuevos. */
  const applyScan = async (devices: Device[], source: NonNullable<ScanMeta["source"]>) => {
    const filtered = settingsRef.current.skipRandomMac
      ? devices.filter(
          (d) => !isRandomizedMac(d.mac) || itemsRef.current.some((k) => k.id === d.id),
        )
      : devices;
    const resolved = await enrichDevicesWithResolvedVendors(filtered);
    const known = new Set(itemsRef.current.map((d) => d.id));
    const wasOnline = new Set(
      itemsRef.current.filter((d) => d.status === "online").map((d) => d.id),
    );
    const merged = mergeScan(itemsRef.current, resolved);
    recordEvents(diffActivity(itemsRef.current, merged));
    setItems(merged);
    void saveDevicesAnywhere(merged);
    const next = { lastScanAt: new Date().toISOString(), source, detectedCount: devices.length };
    setMeta(next);
    saveScanMeta(next);
    resolveVendorsInBackground(resolved, (external) => {
      const byId = new Map(external.map((device) => [device.id, device]));
      setItems((prev) => {
        const updated = prev.map((device) => {
          const fresh = byId.get(device.id);
          if (!fresh || device.manualEdit || !fresh.brand || fresh.brand === "unknown")
            return device;
          return { ...device, vendor: fresh.vendor, brand: fresh.brand };
        });
        void saveDevicesAnywhere(updated);
        return updated;
      });
    });
    // Equipos críticos (24/7) que han dejado de responder.
    if (settingsRef.current.alertCriticalOffline) {
      for (const device of merged) {
        const critical = device.tags.some((t) => /24\/7|cr[ií]tico/i.test(t));
        if (critical && device.status !== "online" && wasOnline.has(device.id)) {
          toast.error(`«${device.name}» ha dejado de responder`, {
            description: `${device.ip} · marcado como equipo crítico 24/7`,
            duration: 12000,
          });
          void notifyNative(
            "Equipo crítico sin respuesta",
            `${device.name} (${device.ip}) ha dejado de responder.`,
          );
        }
      }
    }
    // Nuevos de este escaneo: no estaban registrados antes de fusionar.
    const justFound = merged.filter((d) => !known.has(d.id) && d.isNew && !d.trusted);
    // Sentinel: intrusos y conflictos de IP.
    if (settingsRef.current.intruderAlerts) {
      const conflicts = ipConflictAlerts(itemsRef.current, merged);
      const sentinel = [...conflicts, ...intruderAlerts(justFound)];
      if (sentinel.length > 0) {
        updateAlerts((prev) => appendAlerts(prev, sentinel));
        const critical = conflicts.filter((a) => a.severity === "critical");
        for (const a of conflicts.slice(0, 2)) {
          toast.error(a.title, { description: a.detail, duration: 15000 });
        }
        if (critical[0])
          void notifyNative(`Alerta de seguridad: ${critical[0].title}`, critical[0].detail);
        if (settingsRef.current.alertSound) playAlertSound(critical.length > 0);
      }
    }
    if (justFound.length > 0) announceNew(justFound);
    // Estadísticas de uso por equipo.
    setUsageState((prev) => {
      const nextUsage = recordUsageScan(merged, prev);
      void saveUsageAnywhere(nextUsage);
      return nextUsage;
    });
    // Rutinas aprendidas: anomalías fuera de lo normal.
    {
      const { state: pt, fresh } = evaluatePatterns(patternsRef.current, merged, rxRef.current);
      patternsRef.current = pt;
      setPatterns(pt);
      void savePatternsAnywhere(pt);
      const top = fresh.sort((a, b) => b.score - a.score)[0];
      if (top) {
        toast.warning(`Anomalía: ${top.deviceName}`, {
          description: top.detail,
          duration: 12000,
          action: { label: "Ver casa", onClick: () => setViewMode("home") },
        });
        if (top.score >= 85) {
          void notifyNative(`NetHub · ${top.deviceName}`, top.detail);
          if (settingsRef.current.alertSound) playAlertSound(false);
        }
      }
    }
    // Modo Ausente: armado/desarmado automático y actividad sospechosa.
    {
      let away = awayRef.current;
      const wasArmed = away.armed;
      const evaluation = evaluateAway(away, merged, settingsRef.current.awayAutoArm);
      away = evaluation.state;
      if (evaluation.changed) {
        if (away.armed)
          toast.message("Modo ausente activado", {
            description: "Nadie en casa. NetHub vigila la red.",
          });
        else toast.success("Modo ausente desactivado", { description: "Bienvenido a casa." });
      }
      if (wasArmed && away.armed) {
        const suspicious = merged.filter(
          (d) => !d.trusted && d.status === "online" && (!known.has(d.id) || !wasOnline.has(d.id)),
        );
        for (const d of suspicious.slice(0, 5)) {
          const detail = `${d.name} (${d.ip}) se ha conectado mientras no hay nadie en casa`;
          away = addAwayActivity(away, detail);
          toast.error("Actividad con la casa vacía", { description: detail, duration: 15000 });
          void notifyNative("NetHub · Modo ausente", detail);
        }
        if (suspicious.length > 0 && settingsRef.current.alertSound) playAlertSound(true);
      }
      if (away !== awayRef.current) {
        awayRef.current = away;
        setAwayState(away);
        void saveAwayAnywhere(away);
      }
    }
    return justFound.length;
  };

  /** Health Radar: prueba de 3 puntos. */
  const targets = useMemo(() => healthTargets(items), [items]);
  const targetsRef = useRef(targets);
  targetsRef.current = targets;
  const lastDownRef = useRef(false);
  const runHealthProbe = async () => {
    setProbing(true);
    try {
      const sample = await probeHealth(targetsRef.current);
      const down = sample.gateway === null || sample.internet === null;
      if (down && !lastDownRef.current && settingsRef.current.intruderAlerts) {
        const where =
          sample.gateway === null
            ? "router local / Wi-Fi"
            : `salida a Internet (${settingsRef.current.ispName})`;
        void notifyNative("Corte de conexión detectado", `Fallo en: ${where}`);
        if (settingsRef.current.alertSound) playAlertSound(true);
      }
      lastDownRef.current = down;
      setHealthSamples((prev) => {
        const next = [...prev, sample].slice(-MAX_HEALTH_SAMPLES);
        void saveHealthAnywhere(next);
        return next;
      });
    } finally {
      setProbing(false);
    }
  };
  useEffect(() => {
    if (!hydrated || settings.healthIntervalSeconds <= 0) return;
    const id = window.setInterval(
      () => void runHealthProbe(),
      settings.healthIntervalSeconds * 1000,
    );
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, settings.healthIntervalSeconds]);

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
        await applyScan(native, "native");
        return;
      }
      // 2) Fallback: agente local en http://localhost:8765/scan.
      const devices = await fetchFromAgent();
      setStatus("connected");
      await applyScan(devices, "agent");
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

  // «Escanear ahora» desde el icono del área de notificación (app de escritorio).
  useEffect(() => onDesktopScanRequest(() => void scanRef.current(false)), []);

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

  /** Vacía el inventario por completo (borra escaneos guardados y dispositivos). */
  const resetData = () => {
    clearStoredData();
    clearStoredDirectory();
    setItems([]);
    setDirectory(emptyDirectory);
    setPersonFilter("all");
    setLocationFilter("all");
    setMeta({ lastScanAt: null, source: null });
    void saveDirectoryAnywhere(emptyDirectory);
    void saveDevicesAnywhere([]);
    setEvents([]);
    void saveEventsAnywhere([]);
    setUsageState(emptyUsageState());
    patternsRef.current = emptyPatternState();
    setPatterns(patternsRef.current);
    void savePatternsAnywhere(patternsRef.current);
    void saveUsageAnywhere(emptyUsageState());
    setAwayState(emptyAwayState());
    void saveAwayAnywhere(emptyAwayState());
    setSlaSamples([]);
    void saveSlaAnywhere([]);
    setNotice("Datos borrados: el inventario está vacío. Escanea tu red para empezar.");
  };

  /** Crea una persona o ubicación reutilizable y la guarda. */
  const createPerson = (name: string) =>
    setDirectory((prev) => {
      const next = { ...prev, people: withEntry(prev.people, name) };
      void saveDirectoryAnywhere(next);
      return next;
    });

  const createLocation = (name: string) =>
    setDirectory((prev) => {
      const next = { ...prev, locations: withEntry(prev.locations, name) };
      void saveDirectoryAnywhere(next);
      return next;
    });

  const online = items.filter((d) => d.status === "online");
  const intruders = newDevices(items);
  /** Uso del enlace: descarga real medida sobre la velocidad contratada. */
  const linkUsage = Math.min(
    100,
    Math.round((traffic.rxMbps / Math.max(1, settings.linkSpeedMbps)) * 100),
  );

  /** Sin inventario y ya cargado el almacenamiento: pantalla de bienvenida. */
  const showEmpty = hydrated && items.length === 0;

  const networkCounts = useMemo(() => countByNetwork(items), [items]);
  const detectedNetworks = useMemo(() => detectNetworks(items), [items]);

  /** Personas y ubicaciones disponibles: las creadas más las ya asignadas. */
  const options = useMemo(() => directoryFromDevices(items, directory), [items, directory]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((d) => {
      if (filter !== "all" && d.type !== filter) return false;
      if (network !== ALL_NETWORKS && (networkOf(d) ?? "unknown") !== network) return false;
      if (onlyOnline && d.status !== "online") return false;
      if (personFilter !== "all" && (d.person ?? "") !== personFilter) return false;
      if (locationFilter !== "all" && (d.location ?? "") !== locationFilter) return false;
      if (!q) return true;
      return [d.name, d.ip, d.mac, d.vendor, d.person ?? "", d.location ?? "", ...d.tags]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [items, filter, network, onlyOnline, personFilter, locationFilter, query]);

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
        <div className="mx-auto flex max-w-[1720px] flex-wrap items-center gap-2 sm:gap-4 px-5 py-4 xl:px-8">
          <img
            src="/app-icon.png"
            alt="NetHub"
            width={36}
            height={36}
            className="size-9 rounded-lg"
          />
          <div className="min-w-0 flex-1 basis-1/2 sm:basis-auto">
            <h1 className="text-lg font-semibold leading-none">NetHub</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Red doméstica · {runtimeLabels[runtime]} · v{APP_VERSION} · © 2026 oyogor
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

          <Button
            variant="ghost"
            size="sm"
            onClick={scan}
            disabled={scanning || autoScanning}
            className="inline-flex items-center gap-2 rounded-md h-9 min-w-36 bg-brand px-3.5 py-2 text-sm font-medium text-brand-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {scanning || autoScanning ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Radar className="size-4" />
            )}
            {scanning || autoScanning ? "Escaneando…" : "Escanear red"}
          </Button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="rounded-md border border-border p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Abrir configuración"
            title="Configuración"
          >
            <SettingsIcon className="size-4" />
          </button>
          <button
            onClick={() => updateSettings({ theme: dark ? "light" : "dark" })}
            className="rounded-md border border-border p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label={dark ? "Activar modo claro" : "Activar modo oscuro"}
          >
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1720px] px-5 py-8 xl:px-8">
        <section className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl border border-border bg-card px-5 py-4 text-xs">
          <span className="text-muted-foreground">
            Último escaneo:{" "}
            <span className="font-mono text-foreground">{formatScanTime(meta.lastScanAt)}</span>
            {meta.lastScanAt && meta.detectedCount !== undefined && (
              <span> · {meta.detectedCount} dispositivos detectados</span>
            )}
          </span>
          <span className="min-w-0 max-w-full truncate text-muted-foreground" title={dbPath}>
            Datos en <span className="font-mono text-foreground">{dbPath}</span>
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div
              className="flex max-w-full flex-wrap items-center rounded-md border border-border bg-muted/40 p-0.5"
              aria-label="Vista del panel"
            >
              <button
                type="button"
                onClick={() => setViewMode("inventory")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors",
                  viewMode === "inventory"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <LayoutGrid className="size-3.5" />
                Inventario
              </button>
              <button
                type="button"
                onClick={() => setViewMode("topology")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors",
                  viewMode === "topology"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Waypoints className="size-3.5" />
                Topología de red
              </button>
              <button
                type="button"
                onClick={() => setViewMode("activity")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors",
                  viewMode === "activity"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <HistoryIcon className="size-3.5" />
                Actividad
              </button>
              <button
                type="button"
                onClick={() => setViewMode("security")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors",
                  viewMode === "security"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <ShieldIcon className="size-3.5" />
                Seguridad
              </button>
              <button
                type="button"
                onClick={() => setViewMode("health")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors",
                  viewMode === "health"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <HeartPulse className="size-3.5" />
                Health Radar
              </button>
              <button
                type="button"
                onClick={() => setViewMode("home")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors",
                  viewMode === "home"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <HomeIcon className="size-3.5" />
                Mi casa
              </button>
              <button
                type="button"
                onClick={() => setViewMode("usage")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors",
                  viewMode === "usage"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <BarChart3 className="size-3.5" />
                Uso
              </button>
              <button
                type="button"
                onClick={() => setViewMode("sla")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors",
                  viewMode === "sla"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Gauge className="size-3.5" />
                Operador
              </button>
            </div>
            {awayState.armed && (
              <span className="inline-flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-2.5 py-1.5 text-xs font-medium text-destructive">
                <Siren className="size-3.5" />
                Modo ausente activo
              </span>
            )}
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
                  Visto{intruders.length > 1 ? "s" : ""} por primera vez en el último escaneo:{" "}
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
              Escanea tu red para descubrir automáticamente PCs, consolas, Smart TVs, Home Assistant
              e IoT.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <Button
                variant="ghost"
                onClick={scan}
                disabled={scanning || autoScanning}
                className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2.5 text-sm font-medium text-brand-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {scanning || autoScanning ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Radar className="size-4" />
                )}
                {scanning || autoScanning ? "Escaneando…" : "Escanear red"}
              </Button>
            </div>
          </section>
        )}

        {!showEmpty && viewMode === "inventory" && (
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
                value={`${traffic.rxMbps.toFixed(1)} Mbps`}
                hint={`subida ${traffic.txMbps.toFixed(1)} Mbps · en tiempo real`}
              />
              <Stat
                icon={<Activity className="size-4" />}
                label="Uso del enlace"
                value={`${linkUsage}%`}
                hint={`sobre ${settings.linkSpeedMbps} Mbps contratados`}
              />
            </section>

            <section className="mt-6 rounded-2xl border border-border bg-card p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-base font-semibold">Tráfico en tiempo real (últimos 60 s)</h2>
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
                Las subredes se detectan solas a partir de las IP encontradas; puedes cambiar la red
                de un equipo en su ficha de detalle.
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
                  Dispositivos <span className="text-muted-foreground">({visible.length})</span>
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
                <span className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm focus-within:border-brand">
                  <Users className="size-4 shrink-0 text-muted-foreground" />
                  <select
                    value={personFilter}
                    onChange={(e) => setPersonFilter(e.target.value)}
                    aria-label="Filtrar por persona"
                    className="bg-popover text-sm text-popover-foreground outline-none"
                  >
                    <option value="all" className="bg-popover text-popover-foreground">
                      Todas las personas
                    </option>
                    {options.people.map((name) => (
                      <option
                        key={name}
                        value={name}
                        className="bg-popover text-popover-foreground"
                      >
                        {name}
                      </option>
                    ))}
                    <option value="" className="bg-popover text-popover-foreground">
                      Sin persona
                    </option>
                  </select>
                </span>
                <span className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm focus-within:border-brand">
                  <MapPin className="size-4 shrink-0 text-muted-foreground" />
                  <select
                    value={locationFilter}
                    onChange={(e) => setLocationFilter(e.target.value)}
                    aria-label="Filtrar por ubicación"
                    className="bg-popover text-sm text-popover-foreground outline-none"
                  >
                    <option value="all" className="bg-popover text-popover-foreground">
                      Todas las ubicaciones
                    </option>
                    {options.locations.map((name) => (
                      <option
                        key={name}
                        value={name}
                        className="bg-popover text-popover-foreground"
                      >
                        {name}
                      </option>
                    ))}
                    <option value="" className="bg-popover text-popover-foreground">
                      Sin ubicación
                    </option>
                  </select>
                </span>
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

              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
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
                        <InventoryIdentityBadge device={d} />
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
                      {(d.person || d.location) && (
                        <span className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                          {d.location && (
                            <span className="inline-flex min-w-0 items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-muted-foreground">
                              <MapPin className="size-3 shrink-0" />
                              <span className="truncate">{d.location}</span>
                            </span>
                          )}
                          {d.person && (
                            <span className="inline-flex min-w-0 items-center gap-1 text-muted-foreground">
                              <Users className="size-3 shrink-0" />
                              <span className="truncate">{d.person}</span>
                            </span>
                          )}
                        </span>
                      )}
                      <span className="mt-1.5 flex flex-wrap gap-1.5">
                        {d.isNew && !d.trusted && (
                          <Badge className="bg-warning/15 text-warning">Nuevo</Badge>
                        )}
                        {d.trusted && (
                          <Badge className="bg-success/15 text-success">Confiable</Badge>
                        )}
                        {d.blocked && (
                          <Badge className="bg-destructive/15 text-destructive">Bloqueado</Badge>
                        )}
                        {d.prioritized && <Badge className="bg-warning/15 text-warning">QoS</Badge>}
                        {visibleTags(d)
                          .slice(0, 2)
                          .map((t) => (
                            <Badge key={t} className="bg-muted text-muted-foreground">
                              {t}
                            </Badge>
                          ))}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1.5 self-stretch">
                      <ConnectionIcon device={d} />
                      <span className="mt-auto text-right">
                        <span className="block font-mono text-sm">{d.downstream.toFixed(1)}</span>
                        <span className="block text-[11px] text-muted-foreground">Mbps</span>
                      </span>
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

        {!showEmpty && viewMode === "topology" && (
          <NetworkTopology
            devices={items}
            networks={detectedNetworks}
            onSelectDevice={setSelectedId}
          />
        )}
        {viewMode === "security" && (
          <div className="space-y-8">
            <AwayMode
              state={awayState}
              devices={items}
              autoArm={settings.awayAutoArm}
              onToggleAutoArm={(v) => updateSettings({ awayAutoArm: v })}
              onArm={() =>
                setAwayState((prev) => {
                  const next = armAway(prev);
                  void saveAwayAnywhere(next);
                  return next;
                })
              }
              onDisarm={() =>
                setAwayState((prev) => {
                  const next = disarmAway(prev, new Date(), "Desarmado a mano");
                  void saveAwayAnywhere(next);
                  return next;
                })
              }
              onToggleWatched={(id) =>
                setAwayState((prev) => {
                  const watchedIds = prev.watchedIds.includes(id)
                    ? prev.watchedIds.filter((x) => x !== id)
                    : [...prev.watchedIds, id];
                  const next = { ...prev, watchedIds };
                  void saveAwayAnywhere(next);
                  return next;
                })
              }
              onSelectDevice={(id) => {
                if (items.some((d) => d.id === id)) setSelectedId(id);
              }}
            />
            <SecurityView
              devices={items}
              alerts={alerts}
              gatewayIp={targets[0]?.ip ?? "192.168.1.1"}
              onSelectDevice={(id) => {
                if (items.some((d) => d.id === id)) setSelectedId(id);
              }}
              onTrust={markKnown}
              onResolveAlert={(id) =>
                updateAlerts((prev) =>
                  prev.map((a) => (a.id === id ? { ...a, resolved: true } : a)),
                )
              }
              onClearAlerts={() => updateAlerts(() => [])}
            />
          </div>
        )}
        {viewMode === "health" && (
          <HealthRadar
            samples={healthSamples}
            targets={targets}
            isp={settings.ispName}
            probing={probing}
            intervalSeconds={settings.healthIntervalSeconds}
            onProbeNow={() => void runHealthProbe()}
          />
        )}
        {viewMode === "activity" && (
          <ActivityTimeline
            events={events}
            onSelectDevice={(id) => {
              if (items.some((d) => d.id === id)) setSelectedId(id);
            }}
            onClear={() => {
              setEvents([]);
              void saveEventsAnywhere([]);
            }}
          />
        )}
        {viewMode === "home" && (
          <HomeTwin
            devices={items}
            patterns={patterns}
            rxMbps={traffic.rxMbps}
            onSelectDevice={(id) => {
              if (items.some((d) => d.id === id)) setSelectedId(id);
            }}
          />
        )}
        {viewMode === "usage" && (
          <UsageView
            devices={items}
            usage={usageState}
            onSelectDevice={(id) => {
              if (items.some((d) => d.id === id)) setSelectedId(id);
            }}
          />
        )}
        {viewMode === "sla" && (
          <SlaView
            samples={slaSamples}
            healthSamples={healthSamples}
            contracted={settings.linkSpeedMbps}
            isp={settings.ispName}
            running={slaRunning}
            intervalMinutes={settings.slaIntervalMinutes}
            onTestNow={() => void runSlaTest()}
            onIntervalChange={(minutes) => updateSettings({ slaIntervalMinutes: minutes })}
          />
        )}
      </main>

      <DeviceDetailPanel
        events={events}
        device={selected}
        onClose={() => setSelectedId(null)}
        onUpdate={update}
        onDelete={remove}
        networks={detectedNetworks}
        people={options.people}
        locations={options.locations}
        onCreatePerson={createPerson}
        onCreateLocation={createLocation}
      />

      <UpdateModal open={updateOpen} onClose={() => setUpdateOpen(false)} />

      <SettingsModal
        open={settingsOpen}
        settings={settings}
        onClose={() => setSettingsOpen(false)}
        onChange={updateSettings}
        onReset={() => {
          resetData();
          setSettingsOpen(false);
        }}
      />
    </div>
  );
}

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

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
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
      <p className="mt-3 text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

/** Icono del tipo de conexión (Wi-Fi o cable) en la esquina de cada tarjeta. */
function ConnectionIcon({ device }: { device: Device }) {
  const kind = connectionOf(device);
  if (kind === null) return null;
  return kind === "wifi" ? (
    <Wifi className="size-4 text-muted-foreground" aria-label="Wi-Fi" />
  ) : (
    <Cable className="size-4 text-muted-foreground" aria-label="Cableado / Ethernet" />
  );
}
