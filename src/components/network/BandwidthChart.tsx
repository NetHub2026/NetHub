interface BandwidthChartProps {
  data: number[];
}

export function BandwidthChart({ data }: BandwidthChartProps) {
  const max = Math.max(...data, 1);
  const width = 100;
  const height = 34;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - (v / max) * height;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const line = `M ${points.join(" L ")}`;
  const area = `${line} L ${width},${height} L 0,${height} Z`;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="h-40 w-full"
        role="img"
        aria-label="Consumo de ancho de banda de las últimas 24 horas"
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
        <path d={area} fill="url(#bwFill)" />
        <path
          d={line}
          fill="none"
          stroke="var(--color-brand)"
          strokeWidth="0.8"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="mt-2 flex justify-between font-mono text-[11px] text-muted-foreground">
        <span>-24 h</span>
        <span>-12 h</span>
        <span>ahora</span>
      </div>
    </div>
  );
}
