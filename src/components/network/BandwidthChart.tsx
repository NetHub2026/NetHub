import { useEffect, useRef, useState } from "react";
import { readLiveTraffic, type TrafficSample } from "@/lib/desktop";

const POINTS = 60;

/**
 * Gráfica en vivo del tráfico de red: historial rodante de 60 segundos,
 * con muestreo cada segundo desde el proceso nativo, el agente local
 * o una simulación suave cuando se ejecuta en el navegador.
 */
export function BandwidthChart() {
  const [rx, setRx] = useState<number[]>([]);
  const [tx, setTx] = useState<number[]>([]);
  const lastRef = useRef<TrafficSample>({ rxMbps: 0, txMbps: 0, totalMbps: 0 });

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      const sample = await readLiveTraffic(lastRef.current);
      if (cancelled) return;
      lastRef.current = sample;
      setRx((prev) => [...prev, sample.rxMbps].slice(-POINTS));
      setTx((prev) => [...prev, sample.txMbps].slice(-POINTS));
    };

    void tick();
    const id = window.setInterval(() => void tick(), 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const width = 100;
  const height = 34;
  const max = Math.max(...rx, ...tx, 1);

  const buildPath = (data: number[]) => {
    if (data.length === 0) return { line: "", area: "" };
    const points = data.map((v, i) => {
      const x = (i / Math.max(POINTS - 1, 1)) * width;
      const y = height - (v / max) * height;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    });
    const line = `M ${points.join(" L ")}`;
    const lastX = ((data.length - 1) / Math.max(POINTS - 1, 1)) * width;
    return { line, area: `${line} L ${lastX.toFixed(2)},${height} L 0,${height} Z` };
  };

  const down = buildPath(rx);
  const up = buildPath(tx);
  const current = rx.at(-1) ?? 0;
  const currentUp = tx.at(-1) ?? 0;
  const peak = rx.length > 0 ? Math.max(...rx) : 0;
  const avg = rx.length > 0 ? rx.reduce((a, b) => a + b, 0) / rx.length : 0;

  return (
    <div className="relative">
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <LiveMetric label="Descarga" value={`↓ ${current.toFixed(1)} Mbps`} accent />
        <LiveMetric label="Subida" value={`↑ ${currentUp.toFixed(1)} Mbps`} />
        <LiveMetric label="Pico (60 s)" value={`${peak.toFixed(1)} Mbps`} />
        <LiveMetric label="Media (60 s)" value={`${avg.toFixed(1)} Mbps`} />
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="h-40 w-full"
        role="img"
        aria-label="Tráfico de red en tiempo real de los últimos 60 segundos"
      >
        <defs>
          <linearGradient id="bwFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-brand)" stopOpacity="0.45" />
            <stop offset="100%" stopColor="var(--color-brand)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((g) => (
          <line
            key={g}
            x1="0"
            x2={width}
            y1={height * g}
            y2={height * g}
            stroke="var(--color-border)"
            strokeWidth="0.25"
          />
        ))}
        {down.area && <path d={down.area} fill="url(#bwFill)" />}
        {down.line && (
          <path
            d={down.line}
            fill="none"
            stroke="var(--color-brand)"
            strokeWidth="0.8"
            vectorEffect="non-scaling-stroke"
          />
        )}
        {up.line && (
          <path
            d={up.line}
            fill="none"
            stroke="var(--color-muted-foreground)"
            strokeWidth="0.6"
            strokeDasharray="2 1.5"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
      <div className="mt-2 flex justify-between font-mono text-[11px] text-muted-foreground">
        <span>-60 s</span>
        <span>-45 s</span>
        <span>-30 s</span>
        <span>-15 s</span>
        <span>ahora</span>
      </div>
    </div>
  );
}

function LiveMetric({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-background/40 px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p
        className={`mt-0.5 font-mono text-sm ${accent ? "text-brand" : "text-foreground"}`}
      >
        {value}
      </p>
    </div>
  );
}
