import { useMemo, useState } from "react";
import { AlertTriangle, Brain, Clock, Home, MapPin, Moon, Radio, ShieldAlert, Zap } from "lucide-react";
import type { Device } from "@/lib/devices";
import { DeviceTypeIcon } from "@/components/network/DeviceTypeIcon";
import { learningDays, MIN_LEARNING_DAYS, onlineProbability, type Anomaly, type PatternState } from "@/lib/patterns";
import { cn } from "@/lib/utils";

const UNASSIGNED = "Sin ubicar";

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return Math.abs(h);
}

function timeAgo(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

const kindLabel: Record<Anomaly["kind"], { label: string; icon: typeof Moon }> = {
  unusual_online: { label: "Conexión fuera de rutina", icon: Moon },
  unusual_offline: { label: "Ausencia inesperada", icon: AlertTriangle },
  traffic_spike: { label: "Pico de tráfico anómalo", icon: Zap },
};

export function HomeTwin({
  devices,
  patterns,
  rxMbps,
  onSelectDevice,
}: {
  devices: Device[];
  patterns: PatternState;
  rxMbps: number;
  onSelectDevice: (id: string) => void;
}) {
  const nowHour = new Date().getHours();
  const [hour, setHour] = useState<number | null>(null);
  const viewingPast = hour !== null && hour !== nowHour;
  const learned = learningDays(patterns);
  const ready = learned >= MIN_LEARNING_DAYS;
  const anomalous = useMemo(() => {
    const since = Date.now() - 6 * 3600_000;
    return new Set(patterns.anomalies.filter((a) => new Date(a.at).getTime() > since).map((a) => a.deviceId));
  }, [patterns.anomalies]);

  const rooms = useMemo(() => {
    const map = new Map<string, Device[]>();
    for (const d of devices) {
      const room = d.location?.trim() || UNASSIGNED;
      map.set(room, [...(map.get(room) ?? []), d]);
    }
    return [...map.entries()].sort((a, b) => {
      if (a[0] === UNASSIGNED) return 1;
      if (b[0] === UNASSIGNED) return -1;
      return b[1].length - a[1].length;
    });
  }, [devices]);

  const online = devices.filter((d) => d.status === "online").length;
  const pulse = Math.min(1, rxMbps / 200);

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="relative flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Home className="size-4" />
              <span
                className="absolute inset-0 rounded-lg ring-2 ring-primary/60 animate-ping"
                style={{ animationDuration: `${2.6 - pulse * 1.8}s`, opacity: 0.25 + pulse * 0.5 }}
              />
            </span>
            <div>
              <h2 className="text-sm font-semibold">Gemelo digital de tu casa</h2>
              <p className="text-xs text-muted-foreground">
                {online} de {devices.length} equipos encendidos · la casa late con {rxMbps.toFixed(1)} Mbps
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <Clock className="size-3.5 text-muted-foreground" />
            <input
              type="range"
              min={0}
              max={23}
              value={hour ?? nowHour}
              onChange={(e) => setHour(Number(e.target.value))}
              disabled={!ready}
              aria-label="Hora de la rutina"
              className="w-40 accent-primary disabled:opacity-40"
            />
            <span className="w-28 font-mono tabular-nums">
              {viewingPast ? `Rutina ${String(hour).padStart(2, "0")}:00` : "En directo"}
            </span>
            {viewingPast && (
              <button type="button" className="text-primary hover:underline" onClick={() => setHour(null)}>
                Volver
              </button>
            )}
          </div>
        </header>

        {devices.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">Escanea la red para dibujar tu casa.</p>
        ) : (
          <div
            className="grid auto-rows-[220px] grid-cols-2 gap-px bg-border p-px lg:grid-cols-4"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, color-mix(in oklab, var(--color-muted-foreground) 25%, transparent) 1px, transparent 0)",
              backgroundSize: "18px 18px",
            }}
          >
            {rooms.map(([room, list], i) => {
              const big = i === 0 && list.length > 3;
              const active = list.filter((d) => d.status === "online").length;
              return (
                <div
                  key={room}
                  className={cn(
                    "relative overflow-hidden bg-background/90",
                    big && "col-span-2 row-span-2",
                    room === UNASSIGNED && "bg-muted/40",
                  )}
                >
                  <div className="absolute inset-2 rounded-md border-2 border-dashed border-border/70" />
                  <div className="absolute left-4 top-3 z-10 flex items-center gap-1.5 text-xs font-semibold">
                    <MapPin className="size-3 text-muted-foreground" />
                    {room}
                    <span className="font-normal text-muted-foreground">
                      {active}/{list.length}
                    </span>
                  </div>
                  {list.map((d) => {
                    const h = hash(d.id);
                    const x = 12 + (h % 76);
                    const y = 24 + ((h >> 8) % 62);
                    const prob = viewingPast ? onlineProbability(patterns, d.id, hour!) ?? 0 : null;
                    const on = prob === null ? d.status === "online" : prob > 0.5;
                    const threat = !d.trusted && d.isNew;
                    const weird = anomalous.has(d.id);
                    const tone = threat || weird ? "destructive" : on ? "primary" : "muted";
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => onSelectDevice(d.id)}
                        title={`${d.name} · ${d.ip}${prob !== null ? ` · ${Math.round(prob * 100)} % a esa hora` : ""}`}
                        className="group absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-700"
                        style={{
                          left: `${x}%`,
                          top: `${y}%`,
                          opacity: prob === null ? (on ? 1 : 0.45) : 0.25 + prob * 0.75,
                        }}
                      >
                        {on && (
                          <span
                            className={cn(
                              "absolute inset-0 rounded-full animate-ping",
                              tone === "destructive" ? "bg-destructive/50" : "bg-primary/40",
                            )}
                            style={{ animationDuration: `${2 + (h % 20) / 10}s` }}
                          />
                        )}
                        <span
                          className={cn(
                            "relative flex size-9 items-center justify-center rounded-full border-2 transition-transform group-hover:scale-125",
                            tone === "destructive" && "border-destructive bg-destructive/20 text-destructive",
                            tone === "primary" && "border-primary bg-primary/15 text-primary shadow-[0_0_18px_-2px_var(--color-primary)]",
                            tone === "muted" && "border-border bg-muted text-muted-foreground",
                          )}
                        >
                          <DeviceTypeIcon type={d.type} className="size-4" />
                        </span>
                        <span className="pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded bg-popover px-1.5 py-0.5 text-[10px] font-medium text-popover-foreground opacity-0 shadow group-hover:opacity-100">
                          {d.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
        <footer className="flex flex-wrap gap-4 border-t border-border px-5 py-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-primary" /> Encendido</span>
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-muted-foreground/40" /> Apagado</span>
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-destructive" /> Intruso o comportamiento raro</span>
          <span>Asigna habitaciones desde la ficha de cada equipo.</span>
        </footer>
      </section>

      <aside className="rounded-xl border border-border bg-card">
        <header className="flex items-center gap-3 border-b border-border px-5 py-4">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Brain className="size-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold">Anomalías aprendidas</h2>
            <p className="text-xs text-muted-foreground">Solo te avisa de lo que se sale de tu rutina</p>
          </div>
        </header>
        {!ready && (
          <div className="border-b border-border px-5 py-4">
            <div className="mb-2 flex justify-between text-xs">
              <span className="flex items-center gap-1.5"><Radio className="size-3.5 text-primary" /> Aprendiendo tu rutina…</span>
              <span className="font-mono">{learned}/{MIN_LEARNING_DAYS} días</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary transition-all" style={{ width: `${(learned / MIN_LEARNING_DAYS) * 100}%` }} />
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Deja NetHub abierto (o en la bandeja) con el escaneo automático activo. Cada hora vigilada cuenta.
            </p>
          </div>
        )}
        <ul className="max-h-[620px] divide-y divide-border overflow-y-auto">
          {patterns.anomalies.length === 0 && (
            <li className="px-5 py-10 text-center text-xs text-muted-foreground">
              <ShieldAlert className="mx-auto mb-2 size-5" />
              Todo dentro de lo normal.
            </li>
          )}
          {patterns.anomalies.map((a) => {
            const k = kindLabel[a.kind];
            const Icon = k.icon;
            return (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => onSelectDevice(a.deviceId)}
                  className="flex w-full gap-3 px-5 py-3 text-left hover:bg-muted/50"
                >
                  <Icon className={cn("mt-0.5 size-4 shrink-0", a.score >= 85 ? "text-destructive" : "text-primary")} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-semibold">{a.deviceName}</span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">{timeAgo(a.at)}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{k.label} · rareza {a.score}/100</p>
                    <p className="mt-0.5 text-xs">{a.detail}</p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>
    </div>
  );
}
