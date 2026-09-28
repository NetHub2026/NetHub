/**
 * Health Radar: prueba periódica de 3 puntos (router local, router
 * secundario/DNS e Internet) para localizar cortes y microcortes.
 */
import type { Device } from "./devices";
import { pingIp } from "./ping";

export type HopId = "gateway" | "secondary" | "internet";

export interface HealthTarget {
  id: HopId;
  label: string;
  ip: string;
}

export interface HealthSample {
  at: string;
  gateway: number | null;
  secondary: number | null;
  internet: number | null;
}

export const MAX_HEALTH_SAMPLES = 360;
const STORAGE_KEY = "nethub.health.v1";

export function healthTargets(devices: Device[]): HealthTarget[] {
  const routers = devices.filter((d) => d.type === "router" && d.ip);
  const byDotOne = routers.find((r) => r.ip.endsWith(".1")) ?? routers[0];
  const local = devices.find((d) => d.tags.some((t) => /este equipo/i.test(t))) ?? devices[0];
  const gatewayIp =
    byDotOne?.ip ?? (local?.ip ? local.ip.split(".").slice(0, 3).join(".") + ".1" : "192.168.1.1");
  const secondary = routers.find((r) => r.ip !== gatewayIp);
  return [
    { id: "gateway", label: byDotOne ? `Router local (${byDotOne.name})` : "Router local", ip: gatewayIp },
    secondary
      ? { id: "secondary", label: `Router secundario (${secondary.name})`, ip: secondary.ip }
      : { id: "secondary", label: "DNS del operador (8.8.8.8)", ip: "8.8.8.8" },
    { id: "internet", label: "Internet (1.1.1.1)", ip: "1.1.1.1" },
  ];
}

export async function probeHealth(targets: HealthTarget[]): Promise<HealthSample> {
  const results = await Promise.all(
    targets.map(async (t) => {
      try {
        const r = await pingIp(t.ip);
        return r.reachable ? Math.max(1, Math.round(r.rtt ?? 1)) : null;
      } catch {
        return null;
      }
    }),
  );
  return { at: new Date().toISOString(), gateway: results[0] ?? null, secondary: results[1] ?? null, internet: results[2] ?? null };
}

export interface Diagnosis {
  level: "ok" | "warning" | "down";
  title: string;
  detail: string;
  failedHop: HopId | null;
}

export function diagnose(s: HealthSample | undefined, isp: string): Diagnosis {
  if (!s) return { level: "warning", title: "Esperando la primera medición…", detail: "", failedHop: null };
  if (s.gateway === null)
    return {
      level: "down", failedHop: "gateway",
      title: "Sin respuesta del router local",
      detail: "El fallo está en tu Wi-Fi o cable, o el router está bloqueado. Acércate al router, revisa el cable o reinícialo.",
    };
  if (s.secondary === null && s.internet === null)
    return {
      level: "down", failedHop: "secondary",
      title: `Corte en la línea de ${isp}`,
      detail: "Tu red local funciona, pero no sale nada hacia fuera: probablemente es una incidencia del operador o de la fibra/ONT.",
    };
  if (s.internet === null)
    return {
      level: "down", failedHop: "internet",
      title: "Sin salida a Internet",
      detail: "Llega hasta el operador pero no a Internet: puede ser un problema de DNS/ruta del operador. Prueba a reiniciar el router.",
    };
  if (s.internet > 150 || s.gateway > 40)
    return {
      level: "warning", failedHop: s.gateway > 40 ? "gateway" : "internet",
      title: "Conexión lenta",
      detail: s.gateway > 40 ? "La latencia con el router es alta: tu Wi-Fi está saturado o con poca señal." : `La latencia hacia Internet es alta: posible congestión en ${isp}.`,
    };
  return { level: "ok", failedHop: null, title: "Todo funciona correctamente", detail: "Router, operador e Internet responden con normalidad." };
}

export interface HealthStats {
  uptime: number; // % de muestras con Internet
  microcuts: number;
  jitter: number | null;
  avgInternet: number | null;
}

export function healthStats(samples: HealthSample[]): HealthStats {
  if (samples.length === 0) return { uptime: 100, microcuts: 0, jitter: null, avgInternet: null };
  const ok = samples.filter((s) => s.internet !== null);
  let microcuts = 0;
  for (let i = 1; i < samples.length - 1; i++) {
    const cur = samples[i]!, prev = samples[i - 1]!, next = samples[i + 1]!;
    if (cur.internet === null && prev.internet !== null && next.internet !== null) microcuts++;
  }
  const rtts = ok.map((s) => s.internet as number);
  let jitter: number | null = null;
  if (rtts.length > 1) {
    let sum = 0;
    for (let i = 1; i < rtts.length; i++) sum += Math.abs(rtts[i]! - rtts[i - 1]!);
    jitter = Math.round((sum / (rtts.length - 1)) * 10) / 10;
  }
  return {
    uptime: Math.round((ok.length / samples.length) * 1000) / 10,
    microcuts,
    jitter,
    avgInternet: rtts.length ? Math.round(rtts.reduce((a, b) => a + b, 0) / rtts.length) : null,
  };
}

export function sanitizeHealth(value: unknown): HealthSample[] {
  if (!Array.isArray(value)) return [];
  return value.filter((s) => s && typeof s === "object" && "at" in s).slice(-MAX_HEALTH_SAMPLES) as HealthSample[];
}

export function loadStoredHealth(): HealthSample[] {
  if (typeof window === "undefined") return [];
  try {
    return sanitizeHealth(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]"));
  } catch {
    return [];
  }
}

export function saveStoredHealth(samples: HealthSample[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(samples));
  } catch {
    /* sin almacenamiento */
  }
}
