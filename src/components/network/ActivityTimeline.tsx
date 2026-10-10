import { useMemo, useState } from "react";
import { ArrowLeftRight, History, Search, Sparkles, Trash2, Wifi, WifiOff } from "lucide-react";
import {
  activityLabels,
  dayLabel,
  relativeTime,
  type ActivityEvent,
  type ActivityKind,
} from "@/lib/activity";
import { DeviceTypeIcon } from "./DeviceTypeIcon";
import { cn } from "@/lib/utils";

const kindStyle: Record<ActivityKind, { icon: typeof Wifi; cls: string }> = {
  watch_offline: { icon: WifiOff, cls: "bg-warning/15 text-warning" },
  watch_recovered: { icon: Wifi, cls: "bg-success/15 text-success" },
  connected: { icon: Wifi, cls: "bg-success/15 text-success" },
  disconnected: { icon: WifiOff, cls: "bg-destructive/15 text-destructive" },
  new_device: { icon: Sparkles, cls: "bg-brand/15 text-brand" },
  connection_changed: { icon: ArrowLeftRight, cls: "bg-muted text-foreground" },
  mac_changed: { icon: ArrowLeftRight, cls: "bg-muted text-foreground" },
  ip_changed: { icon: ArrowLeftRight, cls: "bg-muted text-foreground" },
};

type Filter = "all" | ActivityKind;
const filters: Array<[Filter, string]> = [
  ["all", "Todos"],
  ["watch_offline", "Avisos de ausencia"],
  ["watch_recovered", "Recuperados"],
  ["connected", "Conexiones"],
  ["disconnected", "Desconexiones"],
  ["new_device", "Nuevos"],
  ["ip_changed", "Cambios de IP"],
  ["connection_changed", "Cambios de conexión"],
  ["mac_changed", "MAC asociadas"],
];

interface Props {
  events: ActivityEvent[];
  onSelectDevice: (id: string) => void;
  onClear: () => void;
}

export function ActivityTimeline({ events, onSelectDevice, onClear }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = events.filter(
      (e) =>
        (filter === "all" || e.kind === filter) &&
        (!q || `${e.name} ${e.ip} ${e.previousIp ?? ""}`.toLowerCase().includes(q)),
    );
    const out: Array<{ label: string; items: ActivityEvent[] }> = [];
    for (const e of list) {
      const label = dayLabel(e.at);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(e);
      else out.push({ label, items: [e] });
    }
    return out;
  }, [events, filter, query]);

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center gap-3">
        <History className="size-5 text-brand" />
        <h2 className="text-lg font-semibold">Actividad</h2>
        <span className="text-xs text-muted-foreground">{events.length} eventos (máx. 300)</span>
        <button
          type="button"
          onClick={() => {
            if (window.confirm("¿Vaciar todo el historial de actividad?")) onClear();
          }}
          disabled={events.length === 0}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
        >
          <Trash2 className="size-3.5" /> Vaciar historial
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {filters.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              filter === id
                ? "border-brand bg-brand/10 text-brand"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
        <label className="relative ml-auto">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre o IP"
            className="w-60 rounded-md border border-border bg-background py-1.5 pl-8 pr-3 text-sm"
          />
        </label>
      </div>

      {groups.length === 0 ? (
        <p className="mt-10 pb-8 text-center text-sm text-muted-foreground">
          {events.length === 0
            ? "Aún no hay actividad. Los eventos aparecerán tras los próximos escaneos."
            : "Ningún evento coincide con los filtros."}
        </p>
      ) : (
        <div className="mt-5 space-y-6">
          {groups.map((g) => (
            <div key={g.label}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground first-letter:uppercase">
                {g.label}
              </h3>
              <ol className="relative space-y-1 border-l border-border pl-5">
                {g.items.map((e) => {
                  const style = kindStyle[e.kind];
                  const Icon = style.icon;
                  return (
                    <li key={e.id}>
                      <button
                        type="button"
                        onClick={() => onSelectDevice(e.deviceId)}
                        className="relative flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-accent"
                      >
                        <span
                          className={cn(
                            "absolute -left-[33px] flex size-6 items-center justify-center rounded-full ring-4 ring-card",
                            style.cls,
                          )}
                        >
                          <Icon className="size-3.5" />
                        </span>
                        <DeviceTypeIcon type={e.type} className="size-4 text-muted-foreground" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{e.name}</span>
                          <span className="block text-xs text-muted-foreground">
                            {e.kind === "ip_changed" && e.previousIp
                              ? `${e.previousIp} → ${e.ip}`
                              : e.detail ?? e.ip}
                          </span>
                        </span>
                        <span className={cn("rounded-full px-2 py-0.5 text-[11px]", style.cls)}>
                          {activityLabels[e.kind]}
                        </span>
                        <span className="w-28 text-right text-xs text-muted-foreground">
                          <span className="block">
                            {new Date(e.at).toLocaleTimeString("es-ES", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          <span className="block text-[11px]">{relativeTime(e.at)}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
