import { useMemo } from "react";
import { Download, Gauge, HeartPulse } from "lucide-react";
import { slaStats, slaCsv, type SlaSample } from "@/lib/sla";
import type { HealthSample } from "@/lib/health";
import { slaIntervalOptions } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { InternetProviderCard } from "./InternetProviderCard";

interface Props {
  samples: SlaSample[];
  healthSamples: HealthSample[];
  contracted: number;
  isp: string;
  ispAuto: boolean;
  onProviderDetected: (name: string) => void;
  onProviderEnable: () => void;
  running: boolean;
  intervalMinutes: number;
  onTestNow: () => void;
  onIntervalChange: (minutes: number) => void;
}

const verdictClass = {
  ok: "bg-success/15 text-success",
  fair: "bg-warning/15 text-warning",
  bad: "bg-destructive/15 text-destructive",
} as const;

const barClass = {
  ok: "bg-success",
  fair: "bg-warning",
  bad: "bg-destructive",
} as const;

/** Vista del SLA: ¿te da tu operador lo que pagas? */
export function SlaView({
  samples,
  healthSamples,
  contracted,
  isp,
  ispAuto,
  onProviderDetected,
  onProviderEnable,
  running,
  intervalMinutes,
  onTestNow,
  onIntervalChange,
}: Props) {
  const stats = useMemo(
    () => slaStats(samples, contracted, healthSamples),
    [samples, contracted, healthSamples],
  );
  const maxDaily = Math.max(contracted, ...stats.daily.map((d) => d.download), 1);
  const recent = [...samples].reverse().slice(0, 8);

  const exportCsv = () => {
    const blob = new Blob([slaCsv(samples, contracted)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nethub-sla-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="space-y-6">
      <InternetProviderCard name={isp} automatic={ispAuto} onDetected={onProviderDetected} onEnable={onProviderEnable} />
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Gauge className="size-4 text-brand" /> Contrato con {isp}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={intervalMinutes}
              onChange={(e) => onIntervalChange(Number(e.target.value))}
              aria-label="Frecuencia del test automático"
              className="rounded-md border border-input bg-popover px-2.5 py-1.5 text-sm text-popover-foreground outline-none focus:border-brand"
            >
              {slaIntervalOptions.map((o) => (
                <option key={o.value} value={o.value} className="bg-popover text-popover-foreground">
                  Test automático: {o.label}
                </option>
              ))}
            </select>
            <button
              onClick={onTestNow}
              disabled={running}
              className="inline-flex items-center gap-2 rounded-md bg-brand px-3.5 py-2 text-sm font-medium text-brand-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {running ? "Midiendo… (~47 s)" : "Hacer una prueba ahora"}
            </button>
            {samples.length > 0 && (
              <button
                onClick={exportCsv}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Download className="size-3.5" /> Informe CSV
              </button>
            )}
          </div>
        </div>

        {stats.compliance === null ? (
          <p className="mt-6 text-sm text-muted-foreground">
            Aún no hay pruebas registradas. Haz una ahora o programa el test automático (por
            ejemplo, cada 2 horas) para llevar la cuenta de lo que {isp} te entrega de verdad
            frente a los {contracted} Mbps contratados.
          </p>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div
              className={cn(
                "rounded-xl border p-5",
                stats.verdict!.level === "ok"
                  ? "border-success/40 bg-success/10"
                  : stats.verdict!.level === "fair"
                    ? "border-warning/40 bg-warning/10"
                    : "border-destructive/40 bg-destructive/10",
              )}
            >
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Cumplimiento
              </p>
              <p className="mt-1 text-3xl font-semibold tabular-nums">{stats.compliance}%</p>
              <p
                className={cn(
                  "mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                  verdictClass[stats.verdict!.level],
                )}
              >
                {stats.verdict!.label}
              </p>
            </div>
            <div className="rounded-xl border border-border p-5">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Descarga media
              </p>
              <p className="mt-1 text-3xl font-semibold tabular-nums">{stats.avgDownload}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Mbps de {contracted} contratados
              </p>
            </div>
            <div className="rounded-xl border border-border p-5">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Subida media</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums">{stats.avgUpload}</p>
              <p className="mt-1 text-xs text-muted-foreground">Mbps en los últimos tests</p>
            </div>
            <div className="rounded-xl border border-border p-5">
              <p className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
                <HeartPulse className="size-3.5" /> Cortes (7 días)
              </p>
              <p className="mt-1 text-3xl font-semibold tabular-nums">{stats.outages7}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                detectados por el Health Radar
              </p>
            </div>
          </div>
        )}

        {stats.daily.length > 1 && (
          <div className="mt-6">
            <p className="text-xs text-muted-foreground">
              Media de descarga por día (la línea marca los {contracted} Mbps contratados)
            </p>
            <div className="mt-3 flex h-28 items-end gap-1.5">
              {stats.daily.map((d) => {
                const pct = Math.max(2, (d.download / maxDaily) * 100);
                const ok = d.download >= contracted * 0.95;
                return (
                  <div key={d.date} className="group relative flex-1" title={`${d.date}: ${d.download} Mbps`}>
                    <div className="flex h-28 items-end">
                      <span
                        className={cn("w-full rounded-t", barClass[ok ? "ok" : d.download >= contracted * 0.8 ? "fair" : "bad"])}
                        style={{ height: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-1 flex gap-1.5">
              {stats.daily.map((d) => (
                <span key={d.date} className="flex-1 truncate text-center text-[10px] text-muted-foreground">
                  {d.date.slice(5)}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {recent.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-sm font-semibold">Últimas pruebas</h2>
          <ul className="mt-4 divide-y divide-border">
            {recent.map((s) => {
              const pct = contracted > 0 ? Math.round((s.download / contracted) * 100) : 0;
              return (
                <li key={s.at} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 text-sm">
                  <span className="w-40 shrink-0 text-muted-foreground">
                    {new Date(s.at).toLocaleString("es-ES", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className="font-mono tabular-nums">↓ {s.download} Mbps</span>
                  <span className="font-mono tabular-nums text-muted-foreground">↑ {s.upload} Mbps</span>
                  <span className="font-mono tabular-nums text-muted-foreground">{s.ping} ms</span>
                  <span
                    className={cn(
                      "ml-auto rounded-full px-2 py-0.5 text-xs font-medium",
                      verdictClass[pct >= 95 ? "ok" : pct >= 80 ? "fair" : "bad"],
                    )}
                  >
                    {pct}% del contrato
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
