import { nativePing } from "./desktop";

export const AGENT_BASE = "http://localhost:8765";

export type PingSource = "agent" | "native" | "browser" | "none";

export interface PingResult {
  /** Milisegundos de ida y vuelta, o null si no hubo respuesta. */
  rtt: number | null;
  reachable: boolean;
  at: string;
  source: PingSource;
  note?: string;
}

async function pingViaAgent(ip: string): Promise<PingResult | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(`${AGENT_BASE}/ping?ip=${encodeURIComponent(ip)}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = (await res.json()) as { ok?: boolean; rtt?: number | null };
    const rtt = typeof data.rtt === "number" ? Math.round(data.rtt) : null;
    return {
      rtt,
      reachable: data.ok === true && rtt !== null,
      at: new Date().toISOString(),
      source: "agent",
    };
  } catch {
    return null;
  }
}

/** Medida aproximada desde el navegador: no es ICMP, mide la respuesta TCP/HTTP. */
async function pingViaBrowser(ip: string): Promise<PingResult> {
  const started = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1500);
  let responded = false;
  try {
    await fetch(`http://${ip}/?nethub=${Date.now()}`, {
      mode: "no-cors",
      cache: "no-store",
      signal: controller.signal,
    });
    responded = true;
  } catch {
    // Un rechazo rápido suele significar que el equipo está ahí pero cierra la conexión.
    responded = performance.now() - started < 1200;
  }
  clearTimeout(timer);
  const elapsed = Math.round(performance.now() - started);
  return {
    rtt: responded ? elapsed : null,
    reachable: responded,
    at: new Date().toISOString(),
    source: "browser",
    note: "Medida aproximada desde el navegador. Para ICMP real, inicia el agente local o usa la app portable.",
  };
}

/** Intenta agente local, después ping nativo del sistema y por último el navegador. */
export async function pingIp(ip: string): Promise<PingResult> {
  const viaAgent = await pingViaAgent(ip);
  if (viaAgent) return viaAgent;

  const native = await nativePing(ip);
  if (native) {
    return {
      rtt: native.rtt,
      reachable: native.reachable,
      at: new Date().toISOString(),
      source: "native",
    };
  }

  return pingViaBrowser(ip);
}

export interface LatencySample {
  rtt: number | null;
  at: string;
}

export function pushSample(
  history: LatencySample[] | undefined,
  result: PingResult,
): LatencySample[] {
  const sample: LatencySample = { rtt: result.rtt, at: result.at };
  return [...(history ?? []), sample].slice(-10);
}

export function averageRtt(history: LatencySample[] | undefined): number | null {
  const values = (history ?? []).map((s) => s.rtt).filter((v): v is number => v !== null);
  if (values.length === 0) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}
