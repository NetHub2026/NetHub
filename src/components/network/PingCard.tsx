import { useState } from "react";
import { Activity, Loader2, Power, Zap } from "lucide-react";
import type { Device } from "@/lib/devices";
import { averageRtt, pingIp, pushSample, type PingResult } from "@/lib/ping";
import { supportsWol, wakeDevice } from "@/lib/wol";
import { cn } from "@/lib/utils";

interface PingCardProps {
  device: Device;
  nativeSourceLabel?: string;
  measurePing?: typeof pingIp;
  sendWake?: typeof wakeDevice;
  onUpdate: (device: Device) => void;
}

const sourceLabels: Record<PingResult["source"], string> = {
  agent: "agente local (ICMP real)",
  native: "app portable (ICMP real)",
  browser: "navegador (aproximado)",
  none: "sin origen",
};

export function PingCard({
  device,
  onUpdate,
  nativeSourceLabel,
  measurePing = pingIp,
  sendWake = wakeDevice,
}: PingCardProps) {
  const [pinging, setPinging] = useState(false);
  const [last, setLast] = useState<PingResult | null>(null);
  const [waking, setWaking] = useState(false);
  const [wolNote, setWolNote] = useState<string | null>(null);
  const history = device.latency ?? [];
  const average = averageRtt(history);
  const max = Math.max(50, ...history.map((s) => s.rtt ?? 0));

  const doPing = async () => {
    setPinging(true);
    try {
      const result = await measurePing(device.ip);
      setLast(result);
      onUpdate({ ...device, latency: pushSample(device.latency, result) });
    } catch (error) {
      setLast({
        rtt: null,
        reachable: false,
        at: new Date().toISOString(),
        source: "none",
        note: (error as Error).message,
      });
    } finally {
      setPinging(false);
    }
  };

  const doWake = async () => {
    setWaking(true);
    setWolNote(null);
    try {
      const result = await sendWake(device.mac);
      setWolNote(result.message);
    } catch (error) {
      setWolNote((error as Error).message);
    } finally {
      setWaking(false);
    }
  };

  return (
    <div className="mt-3 rounded-xl border border-border p-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground">Latencia actual</p>
          <p className="mt-1 flex items-baseline gap-1.5">
            <span
              className={cn(
                "font-mono text-3xl font-semibold",
                last && !last.reachable ? "text-destructive" : "text-foreground",
              )}
            >
              {pinging ? "…" : last ? (last.rtt !== null ? last.rtt : "—") : "—"}
            </span>
            <span className="text-sm text-muted-foreground">ms</span>
          </p>
          {last && (
            <p
              className={cn(
                "mt-1 text-xs font-medium",
                last.reachable ? "text-success" : "text-destructive",
              )}
            >
              {last.reachable ? "Alcanzable" : "Sin respuesta"} ·{" "}
              <span className="font-normal text-muted-foreground">
                {last.source === "native" && nativeSourceLabel
                  ? nativeSourceLabel
                  : sourceLabels[last.source]}
              </span>
            </p>
          )}
          {average !== null && (
            <p className="mt-1 text-xs text-muted-foreground">
              Media de las últimas {history.length} medidas: {average} ms
            </p>
          )}
        </div>
        <button
          onClick={doPing}
          disabled={pinging}
          className="inline-flex shrink-0 items-center gap-2 rounded-md bg-brand px-3 py-2 text-sm font-medium text-brand-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pinging ? <Loader2 className="size-4 animate-spin" /> : <Activity className="size-4" />}
          {pinging ? "Midiendo…" : "Hacer Ping"}
        </button>
      </div>

      {history.length > 0 && (
        <div className="mt-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Histórico</p>
          <div className="mt-2 flex h-16 items-end gap-1.5">
            {history.map((sample, i) => (
              <span
                key={`${sample.at}-${i}`}
                title={
                  sample.rtt !== null
                    ? `${sample.rtt} ms · ${new Date(sample.at).toLocaleTimeString("es-ES")}`
                    : `Sin respuesta · ${new Date(sample.at).toLocaleTimeString("es-ES")}`
                }
                className={cn(
                  "flex-1 rounded-t",
                  sample.rtt === null ? "bg-destructive/40" : "bg-brand/70",
                )}
                style={{
                  height:
                    sample.rtt === null
                      ? "100%"
                      : `${Math.max(8, Math.round((sample.rtt / max) * 100))}%`,
                }}
              />
            ))}
          </div>
        </div>
      )}

      {last?.note && <p className="mt-3 text-xs text-muted-foreground">{last.note}</p>}

      {supportsWol(device.type) && (
        <div className="mt-4 border-t border-border pt-4">
          <button
            onClick={doWake}
            disabled={waking}
            className={cn(
              "inline-flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-60",
              device.status === "offline"
                ? "bg-warning text-background"
                : "border border-border bg-transparent text-foreground",
            )}
          >
            {waking ? (
              <Loader2 className="size-4 animate-spin" />
            ) : device.status === "offline" ? (
              <Zap className="size-4" />
            ) : (
              <Power className="size-4" />
            )}
            {waking ? "Enviando Magic Packet…" : "Encender con Wake-on-LAN (WOL)"}
          </button>
          {wolNote && (
            <p className="mt-2 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              {wolNote}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
