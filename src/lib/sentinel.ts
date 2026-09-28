/**
 * Sentinel: guardián de intrusos. Clasifica los equipos (de confianza / por
 * verificar), detecta equipos desconocidos y conflictos de IP en cada escaneo.
 */
import type { Device } from "./devices";

export type AlertKind = "intruder" | "ip_conflict" | "ip_reassigned" | "critical_offline";
export type AlertSeverity = "critical" | "warning";

export interface SentinelAlert {
  id: string;
  kind: AlertKind;
  severity: AlertSeverity;
  at: string;
  title: string;
  detail: string;
  deviceId?: string;
  resolved?: boolean;
}

export const MAX_ALERTS = 200;
const STORAGE_KEY = "nethub.sentinel.v1";

export const alertKindLabels: Record<AlertKind, string> = {
  intruder: "Posible intruso",
  ip_conflict: "Conflicto de IP",
  ip_reassigned: "IP reasignada",
  critical_offline: "Equipo crítico caído",
};

export type TrustLevel = "trusted" | "unverified";
export const trustLabels: Record<TrustLevel, string> = {
  trusted: "De confianza",
  unverified: "Por verificar",
};

export function trustOf(d: Device): TrustLevel {
  return d.trusted ? "trusted" : "unverified";
}

function makeAlert(
  kind: AlertKind,
  severity: AlertSeverity,
  title: string,
  detail: string,
  deviceId?: string,
): SentinelAlert {
  const at = new Date().toISOString();
  return {
    id: `${at}-${kind}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    severity,
    at,
    title,
    detail,
    ...(deviceId ? { deviceId } : {}),
  };
}

/** Alertas por equipos nunca vistos y sin clasificar. */
export function intruderAlerts(justFound: Device[]): SentinelAlert[] {
  return justFound.map((d) =>
    makeAlert(
      "intruder",
      "warning",
      `Equipo no reconocido: ${d.name}`,
      `${d.ip} · ${d.mac} · ${d.vendor}. Revísalo y márcalo como de confianza si es tuyo.`,
      d.id,
    ),
  );
}

/**
 * Conflictos de IP: dos MAC distintas online con la misma IP en el mismo
 * escaneo (crítico) o una IP que antes era de un equipo de confianza y ahora
 * responde con otra MAC (sospechoso: posible suplantación/ARP spoofing).
 */
export function ipConflictAlerts(previous: Device[], merged: Device[]): SentinelAlert[] {
  const alerts: SentinelAlert[] = [];
  const byIp = new Map<string, Device[]>();
  for (const d of merged) {
    if (d.status !== "online" || !d.ip) continue;
    byIp.set(d.ip, [...(byIp.get(d.ip) ?? []), d]);
  }
  for (const [ip, list] of byIp) {
    const macs = new Set(list.map((d) => d.mac.toLowerCase()));
    if (macs.size > 1) {
      alerts.push(
        makeAlert(
          "ip_conflict",
          "critical",
          `Conflicto de IP en ${ip}`,
          `${list.map((d) => `${d.name} (${d.mac})`).join(" y ")} responden con la misma IP.`,
          list[0]?.id,
        ),
      );
    }
  }
  const prevByIp = new Map(previous.filter((d) => d.ip).map((d) => [d.ip, d]));
  for (const d of merged) {
    if (d.status !== "online") continue;
    const before = prevByIp.get(d.ip);
    if (!before || before.id === d.id || !before.trusted) continue;
    if (before.mac.toLowerCase() === d.mac.toLowerCase()) continue;
    const stillThere = merged.find((m) => m.id === before.id && m.status === "online" && m.ip === d.ip);
    if (stillThere) continue; // ya cubierto como conflicto
    alerts.push(
      makeAlert(
        "ip_reassigned",
        before.type === "router" ? "critical" : "warning",
        `La IP ${d.ip} ha cambiado de dueño`,
        `Antes era de «${before.name}» (${before.mac}); ahora responde ${d.mac}. Si es el router, podría ser una suplantación.`,
        d.id,
      ),
    );
  }
  return alerts;
}

export function appendAlerts(current: SentinelAlert[], added: SentinelAlert[]) {
  return [...added, ...current].slice(0, MAX_ALERTS);
}

export function sanitizeAlerts(value: unknown): SentinelAlert[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((a): a is SentinelAlert => !!a && typeof a === "object" && "id" in a && "kind" in a)
    .slice(0, MAX_ALERTS);
}

export function loadStoredAlerts(): SentinelAlert[] {
  if (typeof window === "undefined") return [];
  try {
    return sanitizeAlerts(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]"));
  } catch {
    return [];
  }
}

export function saveStoredAlerts(alerts: SentinelAlert[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
  } catch {
    /* sin almacenamiento */
  }
}

/** Pitido corto de alerta (sin archivos de audio). */
export function playAlertSound(critical = false) {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const tones = critical ? [880, 660, 880] : [740, 988];
    tones.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = "sine";
      const start = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.17);
    });
    setTimeout(() => void ctx.close(), 1200);
  } catch {
    /* sin audio */
  }
}
