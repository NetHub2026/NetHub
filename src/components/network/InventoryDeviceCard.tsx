import type { Device } from "@/lib/devices";
import { cn } from "@/lib/utils";
import { MapPin, Users, Wifi, Cable } from "lucide-react";
import { InventoryIdentityIcon, InventoryDeviceBrand } from "./IdentityBadge";
import { connectionOf, CONNECTION_TAGS } from "@/lib/connections";
const visibleTags = (device: Device) => device.tags.filter((t) => !CONNECTION_TAGS.includes(t));
export function InventoryDeviceCard({
  device: d,
  onSelect,
  trafficAvailable = true,
}: {
  device: Device;
  onSelect: (id: string) => void;
  trafficAvailable?: boolean;
}) {
  return (
    <button
      onClick={() => onSelect(d.id)}
      className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-brand"
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-lg",
          d.status === "online" ? "bg-brand/15 text-brand" : "bg-muted text-muted-foreground",
        )}
      >
        <InventoryIdentityIcon device={d} />
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
          {d.ip} · <InventoryDeviceBrand device={d} />
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
          {d.isNew && !d.trusted && <Badge className="bg-warning/15 text-warning">Nuevo</Badge>}
          {d.blocked && <Badge className="bg-destructive/15 text-destructive">Bloqueado</Badge>}
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
          <span className="block font-mono text-sm">
            {trafficAvailable ? d.downstream.toFixed(1) : "—"}
          </span>
          <span className="block text-[11px] text-muted-foreground">Mbps</span>
        </span>
      </span>
    </button>
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
