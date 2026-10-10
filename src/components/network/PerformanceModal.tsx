import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDocumentScrollLock } from "@/hooks/use-document-scroll-lock";
import { BandwidthChart } from "./BandwidthChart";
import { SpeedTestPanel } from "./SpeedTestPanel";
import type { TrafficSample } from "@/lib/desktop";
import type { RefObject } from "react";

export function PerformanceModal({ open, onClose, traffic, linkSpeedMbps, triggerRef }: {
  open: boolean; onClose: () => void; traffic: TrafficSample; linkSpeedMbps: number;
  triggerRef: RefObject<HTMLButtonElement | null>;
}) {
  useDocumentScrollLock(open);
  const linkUsage = Math.min(100, Math.round((traffic.rxMbps / Math.max(1, linkSpeedMbps)) * 100));
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent
        className="max-h-[90dvh] w-[95vw] max-w-5xl overflow-y-auto overscroll-contain rounded-2xl"
        onCloseAutoFocus={(event) => { event.preventDefault(); triggerRef.current?.focus(); }}
      >
        <DialogHeader>
          <DialogTitle>Rendimiento de la red</DialogTitle>
          <DialogDescription>Consulta el tráfico de este equipo y mide la velocidad de tu conexión.</DialogDescription>
        </DialogHeader>
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
      </DialogContent>
    </Dialog>
  );
}
