import { useEffect, useState } from "react";
import { type TrafficSample } from "@/lib/desktop";

/** Uses the shared PC sample; never performs a second counter read. */
export function BandwidthChart({ sample }: { sample: TrafficSample }) {
  const [history, setHistory] = useState<TrafficSample[]>([]);
  useEffect(() => {
    if (!sample.at) return;
    setHistory(prev => [...prev.filter(p => p.at! > sample.at! - 60_000 && p.at !== sample.at), sample]);
  }, [sample]);
  const now = sample.at ?? Date.now();
  const valid = history.filter(p => p.available !== false);
  const rx = valid.map(p => p.rxMbps);
  const tx = valid.map(p => p.txMbps);
  const width = 100;
  const height = 34;
  const max = Math.max(...rx, ...tx, 1);

  const buildPath = (field: "rxMbps" | "txMbps") => {
    let line = "";
    let area = "";
    let segment: string[] = [];
    let startX = 0;
    let lastX = 0;
    let lastAt = 0;
    const finish = () => {
      if (!segment.length) return;
      line += `M ${segment.join(" L ")} `;
      area += `M ${segment.join(" L ")} L ${lastX},${height} L ${startX},${height} Z `;
      segment = [];
    };
    for (const p of history) {
      if (p.available === false || (lastAt && p.at! - lastAt > 2500)) finish();
      lastAt = p.at!;
      if (p.available === false) continue;
      const x = Math.max(0, Math.min(width, (p.at! - now + 60_000) / 60_000 * width));
      if (!segment.length) startX = x;
      lastX = x;
      segment.push(`${x.toFixed(2)},${(height - p[field] / max * height).toFixed(2)}`);
    }
    finish();
    return { line, area };
  };
  const down = buildPath("rxMbps");
  const up = buildPath("txMbps");
  const current = sample.rxMbps;
  const currentUp = sample.txMbps;
  const peak = rx.length > 0 ? Math.max(...rx) : 0;
  const avg = rx.length > 0 ? rx.reduce((a, b) => a + b, 0) / rx.length : 0;

  return (
    <div className="relative">
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <LiveMetric label="Descarga" value={sample.available === false ? "Sin datos" : `↓ ${current.toFixed(1)} Mbps`} accent />
        <LiveMetric label="Subida" value={sample.available === false ? "Sin datos" : `↑ ${currentUp.toFixed(1)} Mbps`} />
        <LiveMetric label="Pico de descarga (60 s)" value={rx.length ? `${peak.toFixed(1)} Mbps` : "—"} />
        <LiveMetric label="Media de descarga (60 s)" value={rx.length ? `${avg.toFixed(1)} Mbps` : "—"} />
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
