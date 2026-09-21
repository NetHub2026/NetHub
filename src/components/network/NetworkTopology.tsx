import { useMemo, useState } from "react";
import {
  Cable,
  ChevronDown,
  ChevronRight,
  Globe2,
  Network,
  Router,
  Wifi,
} from "lucide-react";
import type { Device } from "@/lib/devices";
import {
  UNKNOWN_NETWORK,
  networkOf,
  type NetworkDef,
} from "@/lib/networks";
import { cn } from "@/lib/utils";
import { DeviceTypeIcon } from "./DeviceTypeIcon";

interface NetworkTopologyProps {
  devices: Device[];
  networks: NetworkDef[];
  onSelectDevice: (id: string) => void;
}

const WIFI_TAGS = ["Wi-Fi", "Wi-Fi 2.4GHz", "Wi-Fi 5GHz", "Wi-Fi 6"];
const WIRED_TAG = "Cableado / Ethernet";

function connectionOf(device: Device): "wifi" | "wired" | null {
  if (device.tags.some((tag) => WIFI_TAGS.includes(tag))) return "wifi";
  if (device.tags.includes(WIRED_TAG)) return "wired";
  return null;
}

function isNetworkDevice(device: Device): boolean {
  return (
    device.type === "router" ||
    /router|access point|punto de acceso|repetidor|extensor|mesh|archer/i.test(
      `${device.name} ${device.vendor} ${device.tags.join(" ")}`,
    )
  );
}

function gatewayIp(networkId: string): string {
  return /^\d{1,3}(\.\d{1,3}){2}$/.test(networkId) ? `${networkId}.1` : "Puerta de enlace";
}

export function NetworkTopology({
  devices,
  networks,
  onSelectDevice,
}: NetworkTopologyProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  const branches = useMemo(() => {
    const knownIds = new Set(networks.map((network) => network.id));
    const definitions = [...networks];
    if (devices.some((device) => !networkOf(device) || networkOf(device) === UNKNOWN_NETWORK)) {
      definitions.push({
        id: UNKNOWN_NETWORK,
        name: "Sin clasificar",
        hint: "red pendiente de identificar",
      });
    }

    return definitions.map((definition) => {
      const branchDevices = devices.filter((device) => {
        const id = networkOf(device) ?? UNKNOWN_NETWORK;
        return id === definition.id || (!knownIds.has(id) && definition.id === UNKNOWN_NETWORK);
      });
      const infrastructure = branchDevices.filter(isNetworkDevice);
      const leaves = branchDevices.filter((device) => !isNetworkDevice(device));
      return {
        definition,
        infrastructure,
        leaves,
        online: branchDevices.filter((device) => device.status === "online").length,
        total: branchDevices.length,
      };
    });
  }, [devices, networks]);

  const online = devices.filter((device) => device.status === "online").length;

  const toggleBranch = (id: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 className="text-base font-semibold">Topología de red</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {branches.length} {branches.length === 1 ? "red detectada" : "redes detectadas"} · {online} de {devices.length} equipos activos
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground">
          <span className="size-2 rounded-full bg-success" /> Estado en vivo
        </span>
      </div>

      <div className="min-h-[560px] overflow-x-auto bg-muted/20 px-5 py-8 lg:px-8">
        <div className="mx-auto min-w-[720px] max-w-[1600px]">
          <div className="relative mx-auto flex w-64 items-center gap-3 rounded-lg border border-brand/40 bg-card px-4 py-3 shadow-sm">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-brand/15 text-brand">
              <Globe2 className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">Internet</span>
              <span className="block text-xs text-muted-foreground">Puerta de enlace</span>
            </span>
            <span className="ml-auto size-2 rounded-full bg-success" />
          </div>

          <div className="mx-auto h-10 w-px bg-border" />
          <div className="relative grid items-start gap-6 lg:grid-cols-2 2xl:grid-cols-3">
            <div className="absolute left-[8%] right-[8%] top-0 h-px bg-border" />
            {branches.map(({ definition, infrastructure, leaves, online: active, total }) => {
              const isCollapsed = collapsed.has(definition.id);
              const primaryRouter = infrastructure[0];
              return (
                <div key={definition.id} className="relative min-w-0 pt-7">
                  <div className="absolute left-1/2 top-0 h-7 w-px bg-border" />
                  <button
                    type="button"
                    onClick={() => toggleBranch(definition.id)}
                    aria-expanded={!isCollapsed}
                    className="relative flex w-full items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left shadow-sm transition-colors hover:border-brand"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-brand/15 text-brand">
                      <Router className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {primaryRouter?.name ?? definition.name}
                      </span>
                      <span className="block truncate font-mono text-xs text-muted-foreground">
                        {primaryRouter?.ip ?? gatewayIp(definition.id)} · {definition.name}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block text-sm font-semibold">{active}/{total}</span>
                      <span className="block text-[10px] text-muted-foreground">activos</span>
                    </span>
                    {isCollapsed ? (
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                    )}
                  </button>

                  {!isCollapsed && (
                    <div className="relative ml-5 border-l border-border pb-2 pl-5 pt-4">
                      {infrastructure.map((device) => (
                        <DeviceNode
                          key={device.id}
                          device={device}
                          router
                          onSelect={onSelectDevice}
                        />
                      ))}
                      {leaves.map((device) => (
                        <DeviceNode key={device.id} device={device} onSelect={onSelectDevice} />
                      ))}
                      {total === 0 && (
                        <div className="relative py-3 pl-1 text-xs text-muted-foreground">
                          <span className="absolute -left-5 top-1/2 h-px w-4 bg-border" />
                          Ningún equipo detectado en esta rama
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function DeviceNode({
  device,
  router = false,
  onSelect,
}: {
  device: Device;
  router?: boolean;
  onSelect: (id: string) => void;
}) {
  const connection = connectionOf(device);
  return (
    <button
      type="button"
      onClick={() => onSelect(device.id)}
      className="relative mb-2 flex w-full items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5 text-left transition-colors hover:border-brand hover:bg-accent"
    >
      <span className="absolute -left-5 top-1/2 h-px w-4 bg-border" />
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-md",
          device.status === "online" ? "bg-brand/15 text-brand" : "bg-muted text-muted-foreground",
        )}
      >
        {router ? <Network className="size-4" /> : <DeviceTypeIcon type={device.type} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{device.name}</span>
          {device.isNew && !device.trusted && (
            <span className="rounded bg-warning/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-warning">
              Nuevo
            </span>
          )}
        </span>
        <span className="block truncate font-mono text-[11px] text-muted-foreground">
          {device.ip} · {device.vendor}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {connection === "wifi" && <Wifi className="size-3.5 text-muted-foreground" />}
        {connection === "wired" && <Cable className="size-3.5 text-muted-foreground" />}
        <span
          className={cn(
            "size-2 rounded-full",
            device.status === "online" ? "bg-success" : "bg-muted-foreground",
          )}
          aria-label={device.status === "online" ? "Activo" : "Inactivo"}
        />
      </span>
    </button>
  );
}