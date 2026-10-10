import { useEffect, useState } from "react";
import type { Device } from "@/lib/devices";
import { deviceTypeLabels } from "@/lib/devices";
import {
  confidenceLabels,
  deriveIdentity,
  identityManufacturerLabel,
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
      {fact.source === "legacy" ? "Guardado anteriormente · sin verificar" : label}
    </span>
  );
}

export function InventoryIdentityIcon({ device }: { device: Device }) {
  const id = useIdentity(device);
  return <DeviceTypeIcon type={id.type.value ?? device.type} />;
}

export function InventoryDeviceBrand({ device }: { device: Device }) {
  const id = useIdentity(device);
  return <span title={id.vendor.value ? "Marca deducida o indicada manualmente" : "Fabricante del adaptador; la marca del aparato aún no está identificada"}>{identityManufacturerLabel(id)}</span>;
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
          <div key={k} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1">
            <dt className="min-w-0 text-muted-foreground">{k}</dt>
            <ConfidencePill fact={fact} />
            <dd className="col-span-2 min-w-0 break-words" title={v}>
              {v}
            </dd>
          </div>
        ))}
      </dl>
      {macNote && <p className="mt-2 text-[11px] text-muted-foreground">{macNote}</p>}
      <p className="mt-2 text-[10px] text-muted-foreground/70">
        Las sugerencias automáticas se basan en el nombre, los servicios o el catálogo del adaptador.
        Los datos guardados anteriormente no se han podido verificar. El fabricante del adaptador
        puede ser distinto de la marca del aparato.
      </p>
    </div>
  );
}
