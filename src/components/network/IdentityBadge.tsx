import { useEffect, useState } from "react";
import type { Device } from "@/lib/devices";
import { deviceTypeLabels } from "@/lib/devices";
import {
  confidenceLabels,
  deriveIdentity,
  isRegistryLoaded,
  loadIeeeRegistry,
  onRegistryLoaded,
  sourceLabels,
  type IdentityFact,
} from "@/lib/identity";
import { cn } from "@/lib/utils";
import { DeviceTypeIcon } from "./DeviceTypeIcon";

/** Carga el catálogo IEEE local tras el primer render y vuelve a pintar al terminar. */
export function useIdentity(device: Device) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (isRegistryLoaded()) return;
    const off = onRegistryLoaded(() => setTick((n) => n + 1));
    void loadIeeeRegistry();
    return () => {
      off();
    };
  }, []);
  return deriveIdentity(device);
}

const tone = {
  confirmed: "border-success/40 text-success",
  probable: "border-border text-muted-foreground",
  unknown: "border-dashed border-border text-muted-foreground/70",
} as const;

export function ConfidencePill({
  fact,
  className,
}: {
  fact: IdentityFact<unknown>;
  className?: string;
}) {
  const label = confidenceLabels[fact.confidence];
  const source = fact.source ? sourceLabels[fact.source] : null;
  return (
    <span
      title={source ? `${label} · fuente: ${source}` : label}
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-1.5 py-px text-[10px] leading-4",
        tone[fact.confidence],
        className,
      )}
    >
      {label}
      {source && <span className="ml-1 opacity-70">· {source}</span>}
    </span>
  );
}

/** Etiqueta compacta para la lista del inventario: solo el tipo y su fiabilidad. */
export function InventoryIdentityBadge({ device }: { device: Device }) {
  const id = useIdentity(device);
  return (
    <span
      title={`Tipo: ${id.type.value ? deviceTypeLabels[id.type.value] : "Desconocido"} · ${id.type.source === "legacy" ? sourceLabels.legacy : confidenceLabels[id.type.confidence]}`}
      className={cn(
        "shrink-0 rounded-full border px-1.5 text-[10px] leading-4",
        tone[id.type.confidence],
      )}
    >
      {id.type.source === "legacy"
        ? "Legado / no verificado"
        : confidenceLabels[id.type.confidence]}
    </span>
  );
}

export function InventoryIdentityIcon({ device }: { device: Device }) {
  const id = useIdentity(device);
  return <DeviceTypeIcon type={id.type.value ?? device.type} />;
}

export function InventoryDeviceBrand({ device }: { device: Device }) {
  const id = useIdentity(device);
  return <>{id.vendor.value ? `Marca: ${id.vendor.value}` : "Marca desconocida"}</>;
}

/** Bloque de la ficha: tipo, marca y adaptador con su procedencia. */
export function IdentityDetails({ device }: { device: Device }) {
  const id = useIdentity(device);
  const macNote =
    id.macKind === "local"
      ? "MAC privada o administrada localmente: no indica fabricante."
      : id.macKind === "invalid"
        ? "MAC no válida: no se puede consultar el catálogo."
        : id.macKind === "multicast"
          ? "Dirección de grupo (multicast): no corresponde a un aparato."
          : null;
  const rows: Array<[string, string, IdentityFact<unknown>]> = [
    ["Tipo", id.type.value ? deviceTypeLabels[id.type.value] : "Desconocido", id.type],
    ["Marca del aparato", id.vendor.value ?? "Desconocido", id.vendor],
    ["Adaptador (OUI)", id.adapterVendor.value ?? "Desconocido", id.adapterVendor],
  ];
  return (
    <div className="rounded-md border border-border bg-muted/20 p-3">
      <p className="text-xs font-medium text-muted-foreground">Identificación automática</p>
      <dl className="mt-2 space-y-1.5 text-xs">
        {rows.map(([k, v, fact]) => (
          <div key={k} className="flex items-center gap-2">
            <dt className="w-28 shrink-0 text-muted-foreground">{k}</dt>
            <dd className="min-w-0 flex-1 truncate" title={v}>
              {v}
            </dd>
            <ConfidencePill fact={fact} />
          </div>
        ))}
      </dl>
      {macNote && <p className="mt-2 text-[11px] text-muted-foreground">{macNote}</p>}
      <p className="mt-2 text-[10px] text-muted-foreground/70">
        El OUI identifica al fabricante del adaptador, no la marca del aparato.
      </p>
    </div>
  );
}
