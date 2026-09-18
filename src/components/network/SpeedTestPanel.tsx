import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Gauge, Loader2, Timer } from "lucide-react";
import {
  loadSpeedHistory,
  runSpeedTest,
  type SpeedPhase,
  type SpeedResult,
} from "@/lib/speedtest";
import { cn } from "@/lib/utils";

const phaseLabels: Record<SpeedPhase, string> = {
  idle: "Listo para medir",
  ping: "Midiendo latencia…",
  download: "Midiendo descarga…",
  upload: "Midiendo subida…",
  done: "Test completado",
};

/** Escala del velocímetro en Mbps. */
const MAX_SCALE = 1000;

function toAngle(value: number): number {
  // Escala logarítmica para que los valores domésticos se lean bien.
  const clamped = Math.max(0, Math.min(MAX_SCALE, value));
  const ratio = Math.log10(clamped + 1) / Math.log10(MAX_SCALE + 1);
  return -90 + ratio * 180;
}

function Speedometer({ value, unit, label }: { value: number; unit: string; label: string }) {
  const angle = toAngle(value);
  return (
    <div className="relative mx-auto w-full max-w-xs">
      <svg viewBox="0 0 200 120" className="w-full">
        <path
          d="M20 110 A80 80 0 0 1 180 110"
          fill="none"
          stroke="currentColor"
          strokeWidth="12"
          strokeLinecap="round"
          className="text-muted"
        />
        <path
          d="M20 110 A80 80 0 0 1 180 110"
          fill="none"
          stroke="currentColor"
          strokeWidth="12"
          strokeLinecap="round"
          className="text-brand transition-all duration-500"
          style={{
            strokeDasharray: 252,
            strokeDashoffset: 252 - (252 * (angle + 90)) / 180,
          }}
        />
        <line
          x1="100"
          y1="110"
          x2="100"
          y2="40"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          className="text-foreground transition-transform duration-500"
          style={{ transform: `rotate(${angle}deg)`, transformOrigin: "100px 110px" }}
        />
        <circle cx="100" cy="110" r="6" className="fill-current text-foreground" />
      </svg>
      <div className="pt-3 text-center">
        <p className="font-mono text-3xl font-semibold">{value.toFixed(1)}</p>
        <p className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
          {unit} · {label}
        </p>
      </div>
    </div>
  );
}

export function SpeedTestPanel() {
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<SpeedPhase>("idle");
  const [live, setLive] = useState(0);
  const [result, setResult] = useState<SpeedResult | null>(null);
  const [history, setHistory] = useState<SpeedResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = loadSpeedHistory();
    setHistory(stored);
    if (stored[0]) setResult(stored[0]);
  }, []);

  const start = async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    setLive(0);
    try {
      const final = await runSpeedTest((p) => {
        setPhase(p.phase);
        if (p.phase !== "ping") setLive(p.value);
      });
      setResult(final);
      setHistory(loadSpeedHistory());
      setPhase("done");
    } catch {
      setError("No se ha podido completar el test. Comprueba tu conexión e inténtalo de nuevo.");
      setPhase("idle");
    } finally {
      setRunning(false);
      setLive(0);
    }
  };

  const gaugeValue = running ? live : (result?.download ?? 0);
  const gaugeLabel = running && phase === "upload" ? "subida" : "descarga";

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Gauge className="size-4 text-brand" />
          Test de velocidad
        </h2>
        <p className="text-xs text-muted-foreground">{phaseLabels[phase]}</p>
      </div>

      <div className="mt-4 grid items-center gap-6 md:grid-cols-2">
        <Speedometer value={gaugeValue} unit="Mbps" label={gaugeLabel} />

        <div className="space-y-3">
          <Metric
            icon={<Timer className="size-4" />}
            label="Latencia / jitter"
            value={
              result ? `${result.ping} ms · ${result.jitter} ms` : running ? "midiendo…" : "—"
            }
          />
          <Metric
            icon={<ArrowDown className="size-4" />}
            label="Descarga"
            value={result ? `${result.download.toFixed(1)} Mbps` : running ? "midiendo…" : "—"}
          />
          <Metric
            icon={<ArrowUp className="size-4" />}
            label="Subida"
            value={result ? `${result.upload.toFixed(1)} Mbps` : running ? "midiendo…" : "—"}
          />
          <button
            onClick={start}
            disabled={running}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand px-4 py-2.5 text-sm font-medium text-brand-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {running ? <Loader2 className="size-4 animate-spin" /> : <Gauge className="size-4" />}
            {running ? "Midiendo…" : "Iniciar test de velocidad"}
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-md bg-destructive/15 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}

      {history.length > 0 && (
        <div className="mt-6">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Historial de tests
          </h3>
          <div className="mt-2 divide-y divide-border rounded-xl border border-border">
            {history.slice(0, 6).map((item) => (
              <div
                key={item.at}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-xs"
              >
                <span className="text-muted-foreground">
                  {new Date(item.at).toLocaleString("es-ES", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span className="flex gap-4 font-mono">
                  <span className={cn("text-muted-foreground")}>{item.ping} ms</span>
                  <span>↓ {item.download.toFixed(1)}</span>
                  <span>↑ {item.upload.toFixed(1)}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border px-4 py-3">
      <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        {icon}
      </span>
      <span className="flex-1 text-sm text-muted-foreground">{label}</span>
      <span className="font-mono text-sm">{value}</span>
    </div>
  );
}
