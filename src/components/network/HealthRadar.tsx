import { Activity, Globe, Laptop, Router, Server } from "lucide-react";
import { diagnose, healthStats, type HealthSample, type HealthTarget, type HopId } from "@/lib/health";
import { formatDateTime } from "@/lib/activity";
import { cn } from "@/lib/utils";

interface Props {
  samples: HealthSample[];
  targets: HealthTarget[];
  isp: string;
  probing: boolean;
  intervalSeconds: number;
  onProbeNow: () => void;
  monitoringHost?: string;
}

const icons: Record<HopId, React.ReactNode> = {
  gateway: <Router className="size-5" />,
  secondary: <Server className="size-5" />,
  internet: <Globe className="size-5" />,
};

/** Diagnóstico de caídas y microcortes en 3 puntos. */
export function HealthRadar({ samples, targets, isp, probing, intervalSeconds, onProbeNow, monitoringHost = "Este equipo" }: Props) {
  const last = samples[samples.length - 1];
  const dx = diagnose(last, isp);
  const stats = healthStats(samples.slice(-120));
  const recent = samples.slice(-60);
  const max = Math.max(50, ...recent.flatMap((s) => [s.internet ?? 0, s.gateway ?? 0]));
  const failedIdx = targets.findIndex((t) => t.id === dx.failedHop);

  const hopState = (i: number) => {
    const value = last ? last[targets[i]!.id] : undefined;
    if (value === undefined) return "idle";
    if (dx.level === "down" && failedIdx >= 0 && i >= failedIdx) return i === failedIdx ? "down" : "unknown";
    return value === null ? "down" : "ok";
  };

  return (
    <section className="space-y-6">
      <div className={cn("rounded-2xl border p-6", dx.level === "down" ? "border-destructive/50 bg-destructive/5" : dx.level === "warning" ? "border-warning/40 bg-warning/5" : "border-success/40 bg-success/5")}>
        <div className="flex flex-wrap items-center gap-3">
          <Activity className={cn("size-5", dx.level === "down" ? "text-destructive" : dx.level === "warning" ? "text-warning" : "text-success")} />
          <h2 className="text-base font-semibold">{dx.title}</h2>
          <button onClick={onProbeNow} disabled={probing} className="ml-auto rounded-md border border-border bg-card px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-60">
            {probing ? "Midiendo…" : "Probar ahora"}
          </button>
        </div>
        {dx.detail && <p className="mt-1 text-sm text-muted-foreground">{dx.detail}</p>}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
          <Hop icon={<Laptop className="size-5" />} label={monitoringHost} state="ok" />
          {targets.map((t, i) => {
            const state = hopState(i);
            const value = last?.[t.id];
            return (
              <div key={t.id} className="flex flex-1 items-center gap-2">
                <div className={cn("h-0.5 flex-1 rounded", state === "down" ? "bg-destructive" : state === "ok" ? "bg-success" : "bg-muted")} />
                <Hop icon={icons[t.id]} label={t.label} sub={`${t.ip} · ${value == null ? "—" : `${value} ms`}`} state={state} />
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Disponibilidad (últimas mediciones)" value={`${stats.uptime}%`} />
        <Stat label="Microcortes detectados" value={String(stats.microcuts)} warn={stats.microcuts > 0} />
        <Stat label="Jitter hacia Internet" value={stats.jitter == null ? "—" : `${stats.jitter} ms`} warn={(stats.jitter ?? 0) > 30} />
        <Stat label="Latencia media a Internet" value={stats.avgInternet == null ? "—" : `${stats.avgInternet} ms`} />
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Historial de estabilidad</h2>
          <span className="text-xs text-muted-foreground">
            {intervalSeconds > 0 ? `prueba cada ${intervalSeconds} s` : "monitor desactivado en Configuración"} · {samples.length} mediciones
          </span>
        </div>
        {recent.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Aún no hay mediciones. Pulsa «Probar ahora».</p>
        ) : (
          <div className="mt-4 flex h-40 items-end gap-[3px]">
            {recent.map((s) => {
              const down = s.gateway === null || s.internet === null;
              const h = down ? 100 : Math.max(4, ((s.internet ?? 0) / max) * 100);
              return (
                <div
                  key={s.at}
                  title={`${formatDateTime(s.at)} · router ${s.gateway ?? "✕"} ms · Internet ${s.internet ?? "✕"} ms`}
                  className={cn("flex-1 rounded-sm", down ? "bg-destructive/80" : (s.internet ?? 0) > 150 ? "bg-warning" : "bg-brand/70")}
                  style={{ height: `${h}%` }}
                />
              );
            })}
          </div>
        )}
        <p className="mt-2 text-xs text-muted-foreground">Barras rojas = corte (router o Internet sin respuesta). Altura = latencia hacia Internet.</p>
      </div>
    </section>
  );
}

function Hop({ icon, label, sub, state }: { icon: React.ReactNode; label: string; sub?: string; state: string }) {
  return (
    <div className="flex w-36 shrink-0 flex-col items-center text-center">
      <span className={cn("grid size-12 place-items-center rounded-full border-2", state === "down" ? "border-destructive text-destructive" : state === "ok" ? "border-success text-success" : "border-border text-muted-foreground")}>
        {icon}
      </span>
      <span className="mt-2 text-xs font-medium">{label}</span>
      {sub && <span className="font-mono text-[11px] text-muted-foreground">{sub}</span>}
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold tabular-nums", warn && "text-warning")}>{value}</p>
    </div>
  );
}
