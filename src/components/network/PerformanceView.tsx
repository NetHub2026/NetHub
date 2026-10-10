import type { ReactNode } from "react";
import { BandwidthChart } from "./BandwidthChart";
import { SpeedTestPanel } from "./SpeedTestPanel";
import type { TrafficSample } from "@/lib/desktop";
import { InternetProviderCard } from "./InternetProviderCard";

export function PerformanceView({
  traffic,
  linkSpeedMbps,
  isp,
  ispAuto,
  onProviderDetected,
  onProviderEnable,
  speedPanel,
  monitoringHost = "este PC",
  providerCard,
}: {
  speedPanel?: ReactNode;
  providerCard?: ReactNode;
  monitoringHost?: string;
  traffic: TrafficSample;
  linkSpeedMbps: number;
  isp: string;
  ispAuto: boolean;
  onProviderDetected: (name: string) => void;
  onProviderEnable: () => void;
}) {
  const linkUsage = Math.min(100, Math.round((traffic.rxMbps / Math.max(1, linkSpeedMbps)) * 100));
  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Rendimiento de la red</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Consulta el tráfico de {monitoringHost} y mide la velocidad de tu conexión.
        </p>
      </div>
      {providerCard ?? (
        <InternetProviderCard
          name={isp}
          automatic={ispAuto}
          onDetected={onProviderDetected}
          onEnable={onProviderEnable}
          compact
        />
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Descarga y subida actuales</p>
          <p className="mt-2 font-mono text-lg">
            {traffic.available === false
              ? "Sin datos"
              : `↓ ${traffic.rxMbps.toFixed(1)} · ↑ ${traffic.txMbps.toFixed(1)} Mbps`}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Uso del enlace</p>
          <p className="mt-2 font-mono text-lg">
            {traffic.available === false || linkSpeedMbps <= 0 ? "—" : `${linkUsage}%`}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {linkSpeedMbps > 0
              ? `Sobre ${linkSpeedMbps} Mbps contratados`
              : "Indica la velocidad contratada en Configuración"}
          </p>
        </div>
      </div>
      <section className="rounded-xl border border-border bg-card p-4 sm:p-6">
        <h2
          title={`Tráfico observado por ${monitoringHost}, incluido tráfico local. No es el tráfico agregado de toda la red.`}
          className="mb-4 text-base font-semibold"
        >
          Tráfico de {monitoringHost} (últimos 60 s)
        </h2>
        <BandwidthChart sample={traffic} />
      </section>
      {speedPanel ?? <SpeedTestPanel />}
    </section>
  );
}
