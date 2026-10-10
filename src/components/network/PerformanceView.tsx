import { BandwidthChart } from "./BandwidthChart";
import { SpeedTestPanel } from "./SpeedTestPanel";
import type { TrafficSample } from "@/lib/desktop";
import { InternetProviderCard } from "./InternetProviderCard";

export function PerformanceView({ traffic, linkSpeedMbps, isp, ispAuto, onProviderDetected }: {
  traffic: TrafficSample; linkSpeedMbps: number; isp: string; ispAuto: boolean; onProviderDetected: (name: string) => void;
}) {
  const linkUsage = Math.min(100, Math.round((traffic.rxMbps / Math.max(1, linkSpeedMbps)) * 100));
  return (
    <section className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Rendimiento de la red</h2>
          <p className="mt-1 text-sm text-muted-foreground">Consulta el tráfico de este equipo y mide la velocidad de tu conexión.</p>
        </div>
        <InternetProviderCard name={isp} automatic={ispAuto} onDetected={onProviderDetected} compact />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Descarga y subida actuales</p>
            <p className="mt-2 font-mono text-lg">↓ {traffic.rxMbps.toFixed(1)} · ↑ {traffic.txMbps.toFixed(1)} Mbps</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Uso del enlace</p>
            <p className="mt-2 font-mono text-lg">{linkUsage}%</p>
            <p className="mt-1 text-xs text-muted-foreground">Sobre {linkSpeedMbps} Mbps contratados</p>
          </div>
        </div>
        <section className="rounded-xl border border-border bg-card p-4 sm:p-6">
          <h2 className="mb-4 text-base font-semibold">Tráfico en tiempo real (últimos 60 s)</h2>
          <BandwidthChart />
        </section>
        <SpeedTestPanel />
    </section>
  );
}
