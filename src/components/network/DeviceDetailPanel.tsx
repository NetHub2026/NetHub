import { useEffect, useState } from "react";
import {
  Ban,
  ExternalLink,
  Gauge,
  Loader2,
  RotateCw,
  ShieldCheck,
  Sparkles,
  X,
  Plus,
  Radar,
} from "lucide-react";
import { deviceTypeLabels, type Device } from "@/lib/devices";
import { isRandomizedMac, suggestedName } from "@/lib/oui";
import { detectServices, likelyServices, type ServiceHit } from "@/lib/services";
import { VendorIcon } from "./VendorIcon";
import { cn } from "@/lib/utils";

interface DeviceDetailPanelProps {
  device: Device | null;
  onClose: () => void;
  onUpdate: (device: Device) => void;
}

export function DeviceDetailPanel({ device, onClose, onUpdate }: DeviceDetailPanelProps) {
  const [tagDraft, setTagDraft] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [probing, setProbing] = useState(false);
  const [probeNote, setProbeNote] = useState<string | null>(null);

  useEffect(() => {
    setTagDraft("");
    setFeedback(null);
    setProbeNote(null);
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

  const rows: Array<[string, string]> = [
    ["Tipo", deviceTypeLabels[device.type]],
    ["Dirección IP", device.ip],
    ["Dirección MAC", device.mac + (isRandomizedMac(device.mac) ? " (aleatoria)" : "")],
    ["Fabricante", device.vendor],
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
            <h2 className="mt-3 text-2xl font-semibold">{device.name}</h2>
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

        <dl className="mt-6 divide-y divide-border rounded-xl border border-border">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-4 px-4 py-3">
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="font-mono text-sm">{value}</dd>
            </div>
          ))}
        </dl>

        {device.notes && (
          <p className="mt-4 rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            {device.notes}
          </p>
        )}

        <h3 className="mt-6 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Etiquetas
        </h3>
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
