/**
 * Estadísticas de uso por equipo: cuántos minutos ha estado online cada
 * dispositivo cada día (a partir de los escaneos automáticos) y cuánto de
 * esa actividad ha ocurrido de noche (00:00–06:59).
 */

export interface UsageDay {
  /** Fecha local YYYY-MM-DD */
  date: string;
  /** Segundos online acumulados ese día */
  seconds: number;
  /** Segundos online de ese día entre las 00:00 y las 07:00 */
  nightSeconds: number;
}

export interface UsageEntry {
  days: UsageDay[];
}

export interface UsageState {
  /** Clave: id del dispositivo */
  devices: Record<string, UsageEntry>;
  /** Instante del último escaneo contabilizado */
  lastTick: string | null;
}

export const MAX_USAGE_DAYS = 30;
export const STORAGE_KEY = "nethub.usage.v1";

export function localDateKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function pruneDays(days: UsageDay[]): UsageDay[] {
  return days.slice(-MAX_USAGE_DAYS);
}

/**
 * Contabiliza el tiempo online desde el último escaneo. Se limita el salto a
 * 15 minutos para que una app cerrada varios días no invente horas.
 */
export function recordUsageScan(
  devices: Array<{ id: string; status: string }>,
  state: UsageState,
  now: Date = new Date(),
): UsageState {
  const last = state.lastTick ? new Date(state.lastTick).getTime() : null;
  const elapsed = last ? Math.min(900, Math.max(0, (now.getTime() - last) / 1000)) : 0;
  const nextDevices: Record<string, UsageEntry> = { ...state.devices };
  if (elapsed >= 5) {
    const date = localDateKey(now);
    const isNight = now.getHours() < 7;
    for (const d of devices) {
      if (d.status !== "online") continue;
      const entry = nextDevices[d.id] ?? { days: [] };
      const days = [...entry.days];
      const idx = days.findIndex((x) => x.date === date);
      const day: UsageDay =
        idx >= 0 ? { ...days[idx]! } : { date, seconds: 0, nightSeconds: 0 };
      day.seconds += elapsed;
      if (isNight) day.nightSeconds += elapsed;
      if (idx >= 0) days[idx] = day;
      else days.push(day);
      days.sort((a, b) => a.date.localeCompare(b.date));
      nextDevices[d.id] = { days: pruneDays(days) };
    }
  }
  return { devices: nextDevices, lastTick: now.toISOString() };
}

export function emptyUsageState(): UsageState {
  return { devices: {}, lastTick: null };
}

/** Segundos online de un día concreto. */
export function secondsOnDay(entry: UsageEntry | undefined, date: string): number {
  return entry?.days.find((d) => d.date === date)?.seconds ?? 0;
}

/** Segundos online acumulados en los últimos N días (hoy incluido). */
export function secondsInLastDays(entry: UsageEntry | undefined, days: number): number {
  if (!entry) return 0;
  const from = new Date();
  from.setDate(from.getDate() - (days - 1));
  const fromKey = localDateKey(from);
  return entry.days
    .filter((d) => d.date >= fromKey)
    .reduce((sum, d) => sum + d.seconds, 0);
}

/** Segundos nocturnos acumulados en los últimos N días (hoy incluido). */
export function nightSecondsInLastDays(entry: UsageEntry | undefined, days: number): number {
  if (!entry) return 0;
  const from = new Date();
  from.setDate(from.getDate() - (days - 1));
  const fromKey = localDateKey(from);
  return entry.days
    .filter((d) => d.date >= fromKey)
    .reduce((sum, d) => sum + d.nightSeconds, 0);
}

/** «3 h 24 min» a partir de segundos. */
export function formatUsage(seconds: number): string {
  if (seconds <= 0) return "—";
  const totalMin = Math.round(seconds / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  return `${h} h ${String(m).padStart(2, "0")} min`;
}

export function sanitizeUsage(value: unknown): UsageState {
  const base = emptyUsageState();
  if (!value || typeof value !== "object") return base;
  const raw = value as Partial<UsageState>;
  const devices: Record<string, UsageEntry> = {};
  if (raw.devices && typeof raw.devices === "object") {
    for (const [id, entry] of Object.entries(raw.devices as Record<string, unknown>)) {
      if (!entry || typeof entry !== "object" || !Array.isArray((entry as UsageEntry).days))
        continue;
      const days = (entry as UsageEntry).days
        .filter(
          (d): d is UsageDay =>
            Boolean(d) &&
            typeof d === "object" &&
            typeof (d as UsageDay).date === "string" &&
            Number.isFinite((d as UsageDay).seconds),
        )
        .map((d) => ({
          date: d.date,
          seconds: Math.max(0, Number(d.seconds) || 0),
          nightSeconds: Math.max(0, Number(d.nightSeconds) || 0),
        }));
      devices[id] = { days: pruneDays(days) };
    }
  }
  return {
    devices,
    lastTick: typeof raw.lastTick === "string" ? raw.lastTick : null,
  };
}

export function loadStoredUsage(): UsageState {
  if (typeof window === "undefined") return emptyUsageState();
  try {
    return sanitizeUsage(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null"));
  } catch {
    return emptyUsageState();
  }
}

export function saveStoredUsage(state: UsageState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* sin almacenamiento */
  }
}
