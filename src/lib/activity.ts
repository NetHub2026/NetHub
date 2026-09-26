import type { Device, DeviceType } from "./devices";

export type ActivityKind = "connected" | "disconnected" | "new_device" | "ip_changed";

export interface ActivityEvent {
  id: string;
  kind: ActivityKind;
  at: string;
  deviceId: string;
  name: string;
  ip: string;
  type: DeviceType;
  previousIp?: string;
}

export const MAX_EVENTS = 300;
const STORAGE_KEY = "nethub.activity.v1";

export const activityLabels: Record<ActivityKind, string> = {
  connected: "Conectado",
  disconnected: "Desconectado",
  new_device: "Nuevo dispositivo",
  ip_changed: "Cambio de IP",
};

function makeEvent(kind: ActivityKind, d: Device, at: string, previousIp?: string): ActivityEvent {
  return {
    id: `${at}-${kind}-${d.id}-${Math.random().toString(36).slice(2, 7)}`,
    kind,
    at,
    deviceId: d.id,
    name: d.name,
    ip: d.ip,
    type: d.type,
    ...(previousIp ? { previousIp } : {}),
  };
}

/** Compara el inventario antes y después de un escaneo y devuelve los eventos. */
export function diffActivity(previous: Device[], next: Device[]): ActivityEvent[] {
  const at = new Date().toISOString();
  const before = new Map(previous.map((d) => [d.id, d]));
  const events: ActivityEvent[] = [];
  for (const d of next) {
    const old = before.get(d.id);
    if (!old) {
      events.push(makeEvent("new_device", d, at));
      continue;
    }
    if (old.ip && d.ip && old.ip !== d.ip) events.push(makeEvent("ip_changed", d, at, old.ip));
    if (old.status !== d.status) {
      events.push(makeEvent(d.status === "online" ? "connected" : "disconnected", d, at));
    }
  }
  return events;
}

export function appendEvents(current: ActivityEvent[], added: ActivityEvent[]): ActivityEvent[] {
  if (added.length === 0) return current;
  return [...added.reverse(), ...current].slice(0, MAX_EVENTS);
}

export function sanitizeEvents(value: unknown): ActivityEvent[] {
  if (!Array.isArray(value)) return [];
  return (value as ActivityEvent[])
    .filter((e) => e && typeof e.at === "string" && typeof e.deviceId === "string" && e.kind in activityLabels)
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, MAX_EVENTS);
}

export function loadStoredEvents(): ActivityEvent[] {
  if (typeof window === "undefined") return [];
  try {
    return sanitizeEvents(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]"));
  } catch {
    return [];
  }
}

export function saveStoredEvents(events: ActivityEvent[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  } catch {
    /* sin espacio */
  }
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "ahora mismo";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const days = Math.round(h / 24);
  return `hace ${days} día${days === 1 ? "" : "s"}`;
}

export function formatDateTime(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" });
}

export function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((start(today) - start(d)) / 86400000);
  if (days === 0) return "Hoy";
  if (days === 1) return "Ayer";
  return d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
}
