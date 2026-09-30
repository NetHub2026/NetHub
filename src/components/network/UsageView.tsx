import { useMemo } from "react";
import { BarChart3, MoonStar, Users } from "lucide-react";
import type { Device } from "@/lib/devices";
import {
  localDateKey,
  nightSecondsInLastDays,
  secondsInLastDays,
  secondsOnDay,
  formatUsage,
  type UsageState,
} from "@/lib/usage";
import { cn } from "@/lib/utils";

interface Props {
  devices: Device[];
  usage: UsageState;
  onSelectDevice: (id: string) => void;
}

interface Row {
  device: Device;
  today: number;
  week: number;
  night: number;
}

/** Vista de estadísticas de uso: horas online por equipo, persona y noche. */
export function UsageView({ devices, usage, onSelectDevice }: Props) {
  const today = localDateKey(new Date());
  const rows = useMemo<Row[]>(
    () =>
      devices
        .map((device) => {
          const entry = usage.devices[device.id];
          return {
            device,
            today: secondsOnDay(entry, today),
            week: secondsInLastDays(entry, 7),
            night: nightSecondsInLastDays(entry, 7),
          };
        })
        .sort((a, b) => b.today - a.today || b.week - a.week),
    [devices, usage, today],
  );

  const maxToday = Math.max(1, ...rows.map((r) => r.today));
  const nightRows = rows.filter((r) => r.night > 300);
  const maxNight = Math.max(1, ...nightRows.map((r) => r.night));

  const byPerson = useMemo(() => {
    const map = new Map<string, { seconds: number; night: number }>();
    for (const r of rows) {
      const key = r.device.person ?? "Sin persona";
      const acc = map.get(key) ?? { seconds: 0, night: 0 };
      acc.seconds += r.week;
      acc.night += r.night;
      map.set(key, acc);
    }
    return [...map.entries()].sort((a, b) => b[1].seconds - a[1].seconds);
  }, [rows]);
  const maxPerson = Math.max(1, ...byPerson.map(([, v]) => v.seconds));

  if (devices.length === 0 || rows.every((r) => r.today === 0 && r.week === 0)) {
    return (
      <section className="rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-brand/15 text-brand">
          <BarChart3 className="size-7" />
        </div>
        <h2 className="mt-4 text-lg font-semibold">Todavía no hay estadísticas de uso</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          NetHub apunta los minutos online de cada equipo con cada escaneo automático. Deja la
          app abierta un rato (con el auto-escaneo activo) y aquí verás las horas de uso por día,
          por persona y la actividad nocturna.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <BarChart3 className="size-4 text-brand" /> Horas online hoy
          </h2>
          <p className="text-xs text-muted-foreground">
            Se acumula con cada escaneo · histórico de {30} días por equipo
          </p>
        </div>
        <ul className="mt-4 space-y-2">
          {rows.map(({ device, today: secs, week }) => (
            <li key={device.id}>
              <button
                onClick={() => onSelectDevice(device.id)}
                className="group w-full rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-accent"
              >
                <div className="flex items-center gap-3">
                  <span className="w-48 min-w-0 truncate text-sm font-medium group-hover:text-foreground">
                    {device.name}
                    {device.person && (
                      <span className="ml-1.5 text-xs text-muted-foreground">· {device.person}</span>
                    )}
                  </span>
                  <span className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                    <span
                      className="block h-full rounded-full bg-brand transition-all"
                      style={{ width: `${Math.max(2, (secs / maxToday) * 100)}%` }}
                    />
                  </span>
                  <span className="w-32 shrink-0 text-right font-mono text-xs tabular-nums">
                    <span className="text-foreground">{formatUsage(secs)}</span>
                    <span className="text-muted-foreground"> · 7d {formatUsage(week)}</span>
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Users className="size-4 text-brand" /> Uso por persona (últimos 7 días)
        </h2>
        <ul className="mt-4 space-y-2">
          {byPerson.map(([person, v]) => (
            <li key={person} className="flex items-center gap-3">
              <span className="w-48 min-w-0 truncate text-sm">{person}</span>
              <span className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                <span
                  className="block h-full rounded-full bg-brand/70"
                  style={{ width: `${Math.max(2, (v.seconds / maxPerson) * 100)}%` }}
                />
              </span>
              <span className="w-32 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">
                {formatUsage(v.seconds)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <MoonStar className="size-4 text-warning" /> Actividad nocturna (00:00–07:00, 7 días)
        </h2>
        {nightRows.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Ningún equipo se ha activado de noche. Todo en orden.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {nightRows.map(({ device, night }) => (
              <li key={device.id} className="flex items-center gap-3">
                <button
                  onClick={() => onSelectDevice(device.id)}
                  className="w-48 min-w-0 truncate text-left text-sm hover:text-foreground"
                >
                  {device.name}
                </button>
                <span className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                  <span
                    className={cn("block h-full rounded-full bg-warning")}
                    style={{ width: `${Math.max(2, (night / maxNight) * 100)}%` }}
                  />
                </span>
                <span className="w-32 shrink-0 text-right font-mono text-xs tabular-nums text-warning">
                  {formatUsage(night)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
