import { useEffect, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { useDocumentScrollLock } from "@/hooks/use-document-scroll-lock";
import {
  Check,
  Copy,
  ExternalLink,
  Loader2,
  MapPin,
  User,
  Router,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
  Plus,
  Radar,
} from "lucide-react";
import { openExternalUrl } from "@/lib/desktop";
import { deviceTypeLabels, type Device, type DeviceType } from "@/lib/devices";
import { DeviceTypeIcon } from "./DeviceTypeIcon";
import { PingCard } from "./PingCard";
import { activityLabels, formatDateTime, relativeTime, type ActivityEvent } from "@/lib/activity";
import { detectNetworkId, type NetworkDef } from "@/lib/networks";
import { PRIVATE_MAC_LABEL, isRandomizedMac, resolveVendor, suggestedName } from "@/lib/oui";
import { Globe } from "lucide-react";
import {
  detectServices,
  likelyServices,
  type PortScanProgress,
  type ServiceHit,
} from "@/lib/services";
import { VendorIcon } from "./VendorIcon";
import { IdentityDetails, InventoryIdentityIcon } from "./IdentityBadge";
import { cn } from "@/lib/utils";

const connectionTags = ["Cableado / Ethernet", "Wi-Fi", "Wi-Fi 2.4GHz", "Wi-Fi 5GHz", "Wi-Fi 6"];

const quickTagGroups: Array<{ label: string; tags: string[] }> = [
  { label: "Ubicaciones", tags: ["Salón", "Dormitorio", "Cocina", "Despacho", "Entrada"] },
  {
    label: "Conexión",
    tags: connectionTags,
  },
  {
    label: "Uso / Prioridad",
    tags: ["Domótica", "Streaming", "Gaming", "Servidor", "24/7", "Prioridad alta", "Invitados"],
  },
];

interface DeviceDetailPanelProps {
  device: Device | null;
  onClose: () => void;
  onUpdate: (device: Device) => void;
  onDelete: (device: Device) => void;
  /** Subredes detectadas dinámicamente en el inventario. */
  networks?: NetworkDef[];
  /** Personas y ubicaciones ya creadas, reutilizables en cualquier dispositivo. */
  people?: string[];
  locations?: string[];
  onCreatePerson?: (name: string) => void;
  onCreateLocation?: (name: string) => void;
  events?: ActivityEvent[];
}

export function DeviceDetailPanel({
  device,
  onClose,
  onUpdate,
  onDelete,
  networks = [],
  people = [],
  locations = [],
  onCreatePerson,
  onCreateLocation,
  events = [],
}: DeviceDetailPanelProps) {
  const [tagDraft, setTagDraft] = useState("");
  const [portProgress, setPortProgress] = useState<PortScanProgress | null>(null);
  const [personDraft, setPersonDraft] = useState("");
  const [locationDraft, setLocationDraft] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [probing, setProbing] = useState(false);
  const [probeNote, setProbeNote] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [vendorLookup, setVendorLookup] = useState(false);
  const [vendorNote, setVendorNote] = useState<string | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  useDocumentScrollLock(Boolean(device));

  useEffect(() => {
    setTagDraft("");
    setPersonDraft("");
    setLocationDraft("");
    setFeedback(null);
    setProbeNote(null);
    setConfirmDelete(false);
    setVendorNote(null);
  }, [device?.id]);

  if (!device) return null;

  /** Subredes disponibles, incluyendo la del propio dispositivo. */
  const own = device.networkId ?? detectNetworkId(device.ip);
  const networkOptions: NetworkDef[] = networks.some((n) => n.id === own)
    ? networks
    : own
      ? [...networks, { id: own, name: `${own}.x`, hint: `subred ${own}.0/24` }]
      : networks;

  /** Opciones disponibles, incluyendo lo ya asignado a este dispositivo. */
  const withCurrent = (list: string[], current?: string) =>
    current && !list.includes(current) ? [...list, current] : list;
  const personOptions = withCurrent(people, device.person);
  const locationOptions = withCurrent(locations, device.location);

  const assign = (field: "person" | "location", value: string) => {
    const next: Device = { ...device };
    if (value) next[field] = value;
    else delete next[field];
    onUpdate(next);
  };

  const createPerson = () => {
    const value = personDraft.trim();
    if (!value) return;
    onCreatePerson?.(value);
    assign("person", value);
    setPersonDraft("");
  };

  const createLocation = () => {
    const value = locationDraft.trim();
    if (!value) return;
    onCreateLocation?.(value);
    assign("location", value);
    setLocationDraft("");
  };

  const addTag = () => {
    const tag = tagDraft.trim();
    if (!tag || device.tags.includes(tag)) return;
    onUpdate({ ...device, tags: [...device.tags, tag] });
    setTagDraft("");
  };

  const toggleTag = (tag: string) => {
    const active = device.tags.includes(tag);
    const isConnection = connectionTags.includes(tag);
    onUpdate({
      ...device,
      tags: active
        ? device.tags.filter((t) => t !== tag)
        : isConnection
          ? [...device.tags.filter((t) => !connectionTags.includes(t)), tag]
          : [...device.tags, tag],
    });
  };

  const probe = async () => {
    setProbing(true);
    setProbeNote(null);
    setPortProgress({ done: 0, total: 1, found: 0 });
    const { hits, native } = await detectServices(device.ip, setPortProgress);
    onUpdate({ ...device, services: hits, servicesScannedAt: new Date().toISOString() });
    setProbing(false);
    setPortProgress(null);
    setProbeNote(
      hits.length > 0
        ? `${hits.length} puertos abiertos (${native ? "escaneo TCP nativo" : "sondeo desde el navegador"}).`
        : native
          ? "Ningún puerto común está abierto en este equipo."
          : "Ningún servicio ha respondido. El navegador solo puede sondear puertos web; usa la app portable para un escaneo completo.",
    );
  };

  const suggestion = suggestedName(device.mac, device.ip);
  const services: ServiceHit[] =
    device.services && device.services.length > 0
      ? device.services
      : likelyServices(device.ip, device.type);
  const suggested = !device.services || device.services.length === 0;

  const privateMac = isRandomizedMac(device.mac);

  const webService =
    device.services?.find((service) => service.port === 8123 && service.url) ??
    device.services?.find((service) => service.port === 80 && service.url) ??
    device.services?.find((service) => service.port === 443 && service.url) ??
    device.services?.find((service) => service.url) ??
    services.find((service) => service.port === 8123 && service.url) ??
    services.find((service) => service.port === 80 && service.url) ??
    services.find((service) => service.port === 443 && service.url);
  const adminUrl = webService?.url ?? `http://${device.ip}`;

  const showFeedback = (message: string) => {
    setFeedback(message);
    window.setTimeout(() => setFeedback(null), 2200);
  };

  const openAdmin = async () => {
    const opened = await openExternalUrl(adminUrl);
    showFeedback(
      opened ? "Panel web abierto en el navegador." : "No se ha podido abrir el panel web.",
    );
  };

  const copyValue = async (label: "IP" | "MAC", value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      showFeedback(`${label} copiada al portapapeles.`);
    } catch {
      const input = document.createElement("textarea");
      input.value = value;
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      const copied = document.execCommand("copy");
      input.remove();
      showFeedback(
        copied ? `${label} copiada al portapapeles.` : `No se ha podido copiar la ${label}.`,
      );
    }
  };

  const findVendorOnline = async () => {
    setVendorLookup(true);
    setVendorNote(null);
    const resolved = await resolveVendor(device.mac, device.name);
    setVendorLookup(false);
    if (
      !device.manualEdit &&
      !device.identityManual?.vendor &&
      resolved.vendor &&
      resolved.vendor !== device.vendor
    ) {
      onUpdate({ ...device, vendor: resolved.vendor, brand: resolved.brand });
      setVendorNote(`Adaptador (OUI): ${resolved.vendor}.`);
      return;
    }
    setVendorNote(
      privateMac
        ? "La dirección es privada, no hay fabricante que consultar."
        : "El catálogo local no tiene más información para esta MAC.",
    );
  };

  const rows: Array<[string, string]> = [
    ["Dirección IP", device.ip],
    ["Dirección MAC", device.mac + (privateMac ? " · privada" : "")],
    ["Última conexión", device.lastSeen],
    ["Descarga actual", `${device.downstream.toFixed(1)} Mbps`],
    ["Subida actual", `${device.upstream.toFixed(1)} Mbps`],
  ];

  return (
    <DialogPrimitive.Root
      open={Boolean(device)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm overscroll-none" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed right-0 top-0 z-50 flex h-dvh w-full max-w-md flex-col overflow-y-auto overscroll-none border-l border-border bg-card p-6 shadow-2xl outline-none"
          onOpenAutoFocus={() => {
            returnFocusRef.current =
              document.activeElement instanceof HTMLElement ? document.activeElement : null;
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocusRef.current?.focus({ preventScroll: true });
          }}
          onEscapeKeyDown={(event) => {
            if (confirmDelete) {
              event.preventDefault();
              setConfirmDelete(false);
            }
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider",
                    device.status === "online"
                      ? "bg-success/15 text-success"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      device.status === "online" ? "bg-success" : "bg-muted-foreground",
                    )}
                  />
                  {device.status === "online" ? "Activo" : "Inactivo"}
                </span>
                {device.isNew && !device.trusted && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-warning">
                    <Sparkles className="size-3" /> Nuevo
                  </span>
                )}
                {device.trusted && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-success">
                    <ShieldCheck className="size-3" /> Confiable
                  </span>
                )}
              </div>
              <DialogPrimitive.Title className="mt-3 flex items-center gap-2 text-2xl font-semibold">
                <InventoryIdentityIcon device={device} />
                {device.name}
              </DialogPrimitive.Title>
              <p className="font-mono text-sm text-muted-foreground">{device.ip}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Cerrar"
            >
              <X className="size-4" />
            </Button>
          </div>

          {device.isNew && !device.trusted && (
            <div className="mt-4 rounded-xl border border-warning/40 bg-warning/10 p-4">
              <p className="text-sm text-warning">
                Este dispositivo apareció por primera vez en el último escaneo. Si lo reconoces,
                márcalo como conocido para dejar de recibir avisos.
              </p>
              <button
                onClick={() => onUpdate({ ...device, trusted: true, isNew: false })}
                className="mt-3 inline-flex items-center gap-2 rounded-md bg-success px-3 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
              >
                <ShieldCheck className="size-4" /> Marcar como conocido / confiable
              </button>
            </div>
          )}

          <h3 className="mt-8 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Editar dispositivo
          </h3>
          <div className="mt-3 space-y-3 rounded-xl border border-border p-4">
            <label className="block">
              <span className="text-xs text-muted-foreground">Nombre</span>
              <input
                value={device.name}
                onChange={(e) => onUpdate({ ...device, name: e.target.value, manualEdit: true })}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </label>
            <IdentityDetails device={device} />
            <label className="block">
              <span className="text-xs text-muted-foreground">Tipo de dispositivo</span>
              <span className="mt-1 flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 focus-within:border-brand">
                <DeviceTypeIcon type={device.type} className="shrink-0 text-brand" />
                <select
                  value={device.type}
                  onChange={(e) =>
                    onUpdate({
                      ...device,
                      type: e.target.value as DeviceType,
                      manualEdit: true,
                      identityManual: { ...device.identityManual, type: true },
                    })
                  }
                  className="min-w-0 flex-1 rounded-sm bg-popover text-sm text-popover-foreground outline-none"
                >
                  {(Object.keys(deviceTypeLabels) as DeviceType[]).map((t) => (
                    <option key={t} value={t} className="bg-popover text-popover-foreground">
                      {deviceTypeLabels[t]}
                    </option>
                  ))}
                </select>
              </span>
            </label>
            <label className="block">
              <span className="text-xs text-muted-foreground">Fabricante / marca guardado</span>
              <span className="mt-1 flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 focus-within:border-brand">
                <VendorIcon brand={device.brand} className="shrink-0 text-muted-foreground" />
                <input
                  value={device.vendor}
                  onChange={(e) =>
                    onUpdate({
                      ...device,
                      vendor: e.target.value,
                      manualEdit: true,
                      identityManual: { ...device.identityManual, vendor: true },
                    })
                  }
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                />
              </span>
              <button
                type="button"
                onClick={findVendorOnline}
                disabled={vendorLookup}
                className="mt-2 inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:border-brand hover:text-brand disabled:opacity-60"
              >
                {vendorLookup ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Globe className="size-3.5" />
                )}
                Buscar fabricante en el catálogo local
              </button>
              {privateMac && (
                <span className="mt-2 block text-[11px] text-muted-foreground">
                  {PRIVATE_MAC_LABEL}: este equipo oculta su dirección real, así que el fabricante
                  no puede deducirse.
                </span>
              )}
              {vendorNote && (
                <span className="mt-1 block text-[11px] text-muted-foreground">{vendorNote}</span>
              )}
            </label>
            <label className="block">
              <span className="text-xs text-muted-foreground">Red / subred</span>
              <span className="mt-1 flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 focus-within:border-brand">
                <Router className="size-4 shrink-0 text-brand" />
                <select
                  value={device.networkId ?? detectNetworkId(device.ip) ?? ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    const next: Device = { ...device };
                    if (value) next.networkId = value;
                    else delete next.networkId;
                    onUpdate(next);
                  }}
                  className="min-w-0 flex-1 rounded-sm bg-popover text-sm text-popover-foreground outline-none"
                >
                  <option value="" className="bg-popover text-popover-foreground">
                    Sin clasificar
                  </option>
                  {networkOptions.map((net) => (
                    <option
                      key={net.id}
                      value={net.id}
                      className="bg-popover text-popover-foreground"
                    >
                      {net.name} ({net.hint})
                    </option>
                  ))}
                </select>
              </span>
              <span className="mt-1 block text-[11px] text-muted-foreground">
                Detectada automáticamente por la subred; puedes cambiarla a mano.
              </span>
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <span className="text-xs text-muted-foreground">Persona</span>
                <span className="mt-1 flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 focus-within:border-brand">
                  <User className="size-4 shrink-0 text-brand" />
                  <select
                    value={device.person ?? ""}
                    onChange={(e) => assign("person", e.target.value)}
                    aria-label="Persona asignada"
                    className="min-w-0 flex-1 rounded-sm bg-popover text-sm text-popover-foreground outline-none"
                  >
                    <option value="" className="bg-popover text-popover-foreground">
                      Sin asignar
                    </option>
                    {personOptions.map((name) => (
                      <option
                        key={name}
                        value={name}
                        className="bg-popover text-popover-foreground"
                      >
                        {name}
                      </option>
                    ))}
                  </select>
                </span>
                <span className="mt-2 flex gap-2">
                  <input
                    value={personDraft}
                    onChange={(e) => setPersonDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && createPerson()}
                    placeholder="Nueva persona"
                    className="min-w-0 flex-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs outline-none focus:border-brand"
                  />
                  <button
                    type="button"
                    onClick={createPerson}
                    className="inline-flex shrink-0 items-center rounded-md border border-border px-2 py-1.5 text-xs transition-colors hover:border-brand hover:text-brand"
                    aria-label="Crear persona"
                  >
                    <Plus className="size-3.5" />
                  </button>
                </span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Ubicación</span>
                <span className="mt-1 flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 focus-within:border-brand">
                  <MapPin className="size-4 shrink-0 text-brand" />
                  <select
                    value={device.location ?? ""}
                    onChange={(e) => assign("location", e.target.value)}
                    aria-label="Ubicación asignada"
                    className="min-w-0 flex-1 rounded-sm bg-popover text-sm text-popover-foreground outline-none"
                  >
                    <option value="" className="bg-popover text-popover-foreground">
                      Sin asignar
                    </option>
                    {locationOptions.map((name) => (
                      <option
                        key={name}
                        value={name}
                        className="bg-popover text-popover-foreground"
                      >
                        {name}
                      </option>
                    ))}
                  </select>
                </span>
                <span className="mt-2 flex gap-2">
                  <input
                    value={locationDraft}
                    onChange={(e) => setLocationDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && createLocation()}
                    placeholder="Nueva ubicación"
                    className="min-w-0 flex-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs outline-none focus:border-brand"
                  />
                  <button
                    type="button"
                    onClick={createLocation}
                    className="inline-flex shrink-0 items-center rounded-md border border-border px-2 py-1.5 text-xs transition-colors hover:border-brand hover:text-brand"
                    aria-label="Crear ubicación"
                  >
                    <Plus className="size-3.5" />
                  </button>
                </span>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Asignar persona y ubicación es opcional; las que crees quedan disponibles para el
              resto de dispositivos.
            </p>
            <p className="text-xs text-muted-foreground">
              Estos cambios se guardan en tu equipo y no se sobrescriben en escaneos posteriores.
            </p>
          </div>

          <dl className="mt-6 divide-y divide-border rounded-xl border border-border">
            {rows.map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-4 px-4 py-3">
                <dt className="text-sm text-muted-foreground">{label}</dt>
                <dd className="font-mono text-sm">{value}</dd>
              </div>
            ))}
          </dl>

          <h3 className="mt-8 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Historial de presencia
          </h3>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border p-3">
              <p className="text-[11px] text-muted-foreground">Primera detección</p>
              <p className="mt-1 text-sm font-medium">{formatDateTime(device.firstSeenAt)}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-[11px] text-muted-foreground">Última actividad online</p>
              <p className="mt-1 text-sm font-medium">
                {device.status === "online"
                  ? "Online ahora"
                  : device.lastOnlineAt
                    ? relativeTime(device.lastOnlineAt)
                    : "—"}
              </p>
              {device.lastOnlineAt && (
                <p className="text-[11px] text-muted-foreground">
                  {formatDateTime(device.lastOnlineAt)}
                </p>
              )}
            </div>
          </div>
          {(() => {
            const recent = events.filter((e) => e.deviceId === device.id).slice(0, 5);
            return (
              <ul className="mt-3 space-y-1.5">
                {recent.length === 0 && (
                  <li className="text-xs text-muted-foreground">Sin eventos recientes.</li>
                )}
                {recent.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-1.5 text-xs"
                  >
                    <span className="font-medium">
                      {activityLabels[e.kind]}
                      {e.kind === "ip_changed" && e.previousIp
                        ? ` · ${e.previousIp} → ${e.ip}`
                        : ""}
                    </span>
                    <span className="text-muted-foreground" title={formatDateTime(e.at)}>
                      {relativeTime(e.at)}
                    </span>
                  </li>
                ))}
              </ul>
            );
          })()}

          <h3 className="mt-8 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Latencia y encendido remoto
          </h3>
          <PingCard device={device} onUpdate={onUpdate} />

          {suggestion !== device.name && (
            <button
              onClick={() => onUpdate({ ...device, name: suggestion, manualEdit: true })}
              className="mt-3 w-full rounded-xl border border-dashed border-border px-4 py-3 text-left text-xs text-muted-foreground transition-colors hover:border-brand hover:text-foreground"
            >
              Nombre sugerido por fabricante:{" "}
              <span className="font-medium text-foreground">{suggestion}</span> · pulsa para
              aplicarlo
            </button>
          )}

          {device.notes && (
            <p className="mt-4 rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
              {device.notes}
            </p>
          )}

          <div className="mt-8 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Puertos y servicios
            </h3>
            <button
              onClick={probe}
              disabled={probing}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs transition-colors hover:bg-accent disabled:opacity-60"
            >
              {probing ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Radar className="size-3.5" />
              )}
              {probing ? "Escaneando…" : "Escanear puertos"}
            </button>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {device.servicesScannedAt
              ? `Último escaneo: ${new Date(device.servicesScannedAt).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" })}`
              : "Aún no se han escaneado los puertos de este equipo."}
          </p>
          {portProgress && (
            <div className="mt-3">
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-brand transition-all"
                  style={{
                    width: `${Math.round((portProgress.done / portProgress.total) * 100)}%`,
                  }}
                />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {portProgress.done}/{portProgress.total} puertos comprobados · {portProgress.found}{" "}
                abiertos
              </p>
            </div>
          )}
          {suggested && (
            <p className="mt-2 text-xs text-muted-foreground">
              Servicios probables según el tipo de dispositivo. Pulsa «Escanear puertos» para
              comprobarlos.
            </p>
          )}
          <div className="mt-3 space-y-2">
            {services.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Sin servicios conocidos para este dispositivo.
              </p>
            )}
            {services.map((s) => (
              <div
                key={s.port}
                className="flex items-center gap-3 rounded-xl border border-border px-4 py-3"
              >
                <span className="w-14 shrink-0 font-mono text-xs text-muted-foreground">
                  :{s.port}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{s.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {s.hint}
                    {typeof s.rtt === "number" ? ` · ${s.rtt} ms` : ""}
                  </span>
                </span>
                <button
                  type="button"
                  title="Copiar IP:puerto"
                  onClick={() => {
                    void navigator.clipboard?.writeText(`${device.ip}:${s.port}`);
                    showFeedback(`Copiado ${device.ip}:${s.port}`);
                  }}
                  className="shrink-0 rounded-md border border-border p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <Copy className="size-3.5" />
                </button>
                {s.url ? (
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-brand px-2.5 py-1.5 text-xs font-medium text-brand-foreground transition-opacity hover:opacity-90"
                  >
                    Abrir panel web <ExternalLink className="size-3" />
                  </a>
                ) : (
                  <span className="shrink-0 text-[11px] text-muted-foreground">sin panel web</span>
                )}
              </div>
            ))}
          </div>
          {probeNote && (
            <p className="mt-3 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              {probeNote}
            </p>
          )}

          <h3 className="mt-6 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Etiquetas
          </h3>
          <div className="mt-3 space-y-3 rounded-xl border border-border p-4">
            {quickTagGroups.map((group) => (
              <div key={group.label}>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {group.tags.map((tag) => {
                    const active = device.tags.includes(tag);
                    return (
                      <button
                        key={tag}
                        onClick={() => toggleTag(tag)}
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs transition-colors",
                          active
                            ? "border-brand bg-brand/15 text-brand"
                            : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
                        )}
                        aria-pressed={active}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {device.tags.map((tag) => (
              <button
                key={tag}
                onClick={() => onUpdate({ ...device, tags: device.tags.filter((t) => t !== tag) })}
                className="group inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs transition-colors hover:border-destructive hover:text-destructive"
                title="Quitar etiqueta"
              >
                {tag}
                <X className="size-3 opacity-50 group-hover:opacity-100" />
              </button>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTag()}
              placeholder="Nueva etiqueta"
              className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-brand"
            />
            <button
              onClick={addTag}
              className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-2 text-sm font-medium text-brand-foreground transition-opacity hover:opacity-90"
            >
              <Plus className="size-4" /> Añadir
            </button>
          </div>

          <h3 className="mt-8 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Acciones rápidas
          </h3>
          <div className="mt-3 space-y-2">
            <button
              onClick={() => void openAdmin()}
              className="flex w-full items-center gap-3 rounded-xl border border-border px-4 py-3 text-left text-sm transition-colors hover:bg-accent"
            >
              <ExternalLink className="size-4" />
              <span className="min-w-0 flex-1">
                <span className="block">Abrir interfaz web / panel de administración</span>
                <span className="block truncate font-mono text-xs text-muted-foreground">
                  {adminUrl}
                </span>
              </span>
            </button>
            <button
              onClick={() => void copyValue("IP", device.ip)}
              className="flex w-full items-center gap-3 rounded-xl border border-border px-4 py-3 text-left text-sm transition-colors hover:bg-accent"
            >
              <Copy className="size-4" />
              <span className="flex-1">Copiar dirección IP</span>
              <span className="font-mono text-xs text-muted-foreground">{device.ip}</span>
            </button>
            <button
              onClick={() => void copyValue("MAC", device.mac)}
              className="flex w-full items-center gap-3 rounded-xl border border-border px-4 py-3 text-left text-sm transition-colors hover:bg-accent"
            >
              <Copy className="size-4" />
              <span className="flex-1">Copiar dirección MAC</span>
              <span className="font-mono text-xs text-muted-foreground">{device.mac}</span>
            </button>
          </div>
          {feedback && (
            <p
              className="mt-3 flex items-center gap-2 rounded-md bg-success/15 px-3 py-2 text-xs text-success"
              role="status"
            >
              <Check className="size-3.5" /> {feedback}
            </p>
          )}

          <div className="mt-8 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
            {confirmDelete ? (
              <div>
                <p className="text-sm text-destructive">
                  ¿Eliminar «{device.name}» de la lista? Se borrará de los datos guardados; si
                  vuelve a aparecer en un escaneo, se mostrará como nuevo.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => onDelete(device)}
                    className="inline-flex items-center gap-1.5 rounded-md bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground transition-opacity hover:opacity-90"
                  >
                    <Trash2 className="size-4" /> Sí, eliminar
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="rounded-md border border-border px-3 py-2 text-sm transition-colors hover:bg-accent"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex w-full items-center gap-3 text-left text-sm text-destructive"
              >
                <Trash2 className="size-4" />
                <span className="flex-1">Eliminar / olvidar dispositivo</span>
              </button>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
