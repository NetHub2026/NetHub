import { useEffect, useState } from "react";
import {
  Ban,
  ExternalLink,
  Gauge,
  Loader2,
  RotateCw,
  Router,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
  Plus,
  Radar,
} from "lucide-react";
import { deviceTypeLabels, type Device, type DeviceType } from "@/lib/devices";
import { DeviceTypeIcon } from "./DeviceTypeIcon";
import { PingCard } from "./PingCard";
import { detectNetworkId, networks } from "@/lib/networks";
import {
  PRIVATE_MAC_LABEL,
  isRandomizedMac,
  resolveVendor,
  suggestedName,
} from "@/lib/oui";
import { Globe } from "lucide-react";
import { detectServices, likelyServices, type ServiceHit } from "@/lib/services";
import { VendorIcon } from "./VendorIcon";
import { cn } from "@/lib/utils";

const quickTagGroups: Array<{ label: string; tags: string[] }> = [
  { label: "Ubicaciones", tags: ["Salón", "Dormitorio", "Cocina", "Despacho", "Entrada"] },
  {
    label: "Conexión",
    tags: ["Cableado / Ethernet", "Wi-Fi 2.4GHz", "Wi-Fi 5GHz", "Wi-Fi 6"],
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
}

export function DeviceDetailPanel({
  device,
  onClose,
  onUpdate,
  onDelete,
}: DeviceDetailPanelProps) {
  const [tagDraft, setTagDraft] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [probing, setProbing] = useState(false);
  const [probeNote, setProbeNote] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [vendorLookup, setVendorLookup] = useState(false);
  const [vendorNote, setVendorNote] = useState<string | null>(null);

  useEffect(() => {
    setTagDraft("");
    setFeedback(null);
    setProbeNote(null);
    setConfirmDelete(false);
    setVendorNote(null);
  }, [device?.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!device) return null;

  const addTag = () => {
    const tag = tagDraft.trim();
    if (!tag || device.tags.includes(tag)) return;
    onUpdate({ ...device, tags: [...device.tags, tag] });
    setTagDraft("");
  };

  const toggleTag = (tag: string) => {
    const active = device.tags.includes(tag);
    onUpdate({
      ...device,
      tags: active ? device.tags.filter((t) => t !== tag) : [...device.tags, tag],
    });
  };

  const probe = async () => {
    setProbing(true);
    setProbeNote(null);
    const hits = await detectServices(device.ip);
    onUpdate({ ...device, services: hits, servicesScannedAt: new Date().toISOString() });
    setProbing(false);
    setProbeNote(
      hits.length > 0
        ? `${hits.length} servicios abiertos detectados.`
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

  const rows: Array<[string, string]> = [
    ["Dirección IP", device.ip],
    ["Dirección MAC", device.mac + (privateMac ? " · privada" : "")],
    ["Última conexión", device.lastSeen],
    ["Descarga actual", `${device.downstream.toFixed(1)} Mbps`],
    ["Subida actual", `${device.upstream.toFixed(1)} Mbps`],
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        aria-label="Cerrar detalle"
        onClick={onClose}
        className="absolute inset-0 bg-background/70 backdrop-blur-sm"
      />
      <aside className="relative flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-border bg-card p-6 shadow-2xl">
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
            <h2 className="mt-3 flex items-center gap-2 text-2xl font-semibold">
              <DeviceTypeIcon type={device.type} className="size-6 text-brand" />
              {device.name}
            </h2>
            <p className="font-mono text-sm text-muted-foreground">{device.ip}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Cerrar"
          >
            <X className="size-4" />
          </button>
        </div>

        {device.isNew && !device.trusted && (
          <div className="mt-4 rounded-xl border border-warning/40 bg-warning/10 p-4">
            <p className="text-sm text-warning">
              Este dispositivo apareció por primera vez en el último escaneo. Si lo
              reconoces, márcalo como conocido para dejar de recibir avisos.
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
              onChange={(e) =>
                onUpdate({ ...device, name: e.target.value, manualEdit: true })
              }
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </label>
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
            <span className="text-xs text-muted-foreground">Fabricante / marca</span>
            <span className="mt-1 flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 focus-within:border-brand">
              <VendorIcon brand={device.brand} className="shrink-0 text-muted-foreground" />
              <input
                value={device.vendor}
                onChange={(e) =>
                  onUpdate({ ...device, vendor: e.target.value, manualEdit: true })
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
              Buscar fabricante en Internet
            </button>
            {privateMac && (
              <span className="mt-2 block text-[11px] text-muted-foreground">
                {PRIVATE_MAC_LABEL}: este equipo oculta su dirección real, así que el
                fabricante no puede deducirse.
              </span>
            )}
            {vendorNote && (
              <span className="mt-1 block text-[11px] text-muted-foreground">
                {vendorNote}
              </span>
            )}
          </label>
          <label className="block">
            <span className="text-xs text-muted-foreground">Red / router</span>
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
                {networks.map((net) => (
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
          <p className="text-xs text-muted-foreground">
            Estos cambios se guardan en tu equipo y no se sobrescriben en escaneos
            posteriores.
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
            {probing ? "Sondeando…" : "Detectar"}
          </button>
        </div>
        {suggested && (
          <p className="mt-2 text-xs text-muted-foreground">
            Servicios probables según el tipo de dispositivo. Pulsa «Detectar» para
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
                </span>
              </span>
              {s.url ? (
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-brand px-2.5 py-1.5 text-xs font-medium text-brand-foreground transition-opacity hover:opacity-90"
                >
                  Abrir <ExternalLink className="size-3" />
                </a>
              ) : (
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  sin panel web
                </span>
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
              onClick={() =>
                onUpdate({ ...device, tags: device.tags.filter((t) => t !== tag) })
              }
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
          Control
        </h3>
        <div className="mt-3 space-y-2">
          <ControlRow
            icon={<Ban className="size-4" />}
            label="Bloquear acceso a internet"
            active={!!device.blocked}
            onToggle={() => onUpdate({ ...device, blocked: !device.blocked })}
          />
          <ControlRow
            icon={<Gauge className="size-4" />}
            label="Priorizar ancho de banda (QoS)"
            active={!!device.prioritized}
            onToggle={() => onUpdate({ ...device, prioritized: !device.prioritized })}
          />
          <button
            onClick={() => setFeedback(`Orden de reinicio enviada a ${device.name}.`)}
            className="flex w-full items-center gap-3 rounded-xl border border-border px-4 py-3 text-left text-sm transition-colors hover:bg-accent"
          >
            <RotateCw className="size-4" />
            Reiniciar dispositivo
          </button>
        </div>
        {feedback && (
          <p className="mt-3 rounded-md bg-success/15 px-3 py-2 text-xs text-success">
            {feedback}
          </p>
        )}
        <p className="mt-4 text-xs text-muted-foreground">
          Las acciones de control se aplican de forma local en esta demo y están
          preparadas para conectarse al router o a Home Assistant.
        </p>

        <div className="mt-8 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
          {confirmDelete ? (
            <div>
              <p className="text-sm text-destructive">
                ¿Eliminar «{device.name}» de la lista? Se borrará de los datos guardados;
                si vuelve a aparecer en un escaneo, se mostrará como nuevo.
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
      </aside>
    </div>
  );
}

function ControlRow({
  icon,
  label,
  active,
  onToggle,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex w-full items-center gap-3 rounded-xl border border-border px-4 py-3 text-left text-sm transition-colors hover:bg-accent"
      aria-pressed={active}
    >
      {icon}
      <span className="flex-1">{label}</span>
      <span
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors",
          active ? "bg-brand" : "bg-muted",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-4 rounded-full bg-background transition-all",
            active ? "left-[1.15rem]" : "left-0.5",
          )}
        />
      </span>
    </button>
  );
}
