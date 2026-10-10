/**
 * Detección de anomalías por patrones: NetHub aprende, hora a hora, cuándo
 * suele estar conectado cada equipo y avisa solo de lo que se sale de su rutina.
 */

export interface DevicePattern {
  /** Días distintos en los que el equipo estuvo online en cada hora (0-23) */
  hours: number[];
  /** Último "fecha|hora" contabilizado para no contar dos veces la misma hora */
  lastKey: string | null;
}

export type AnomalyKind = "unusual_online" | "unusual_offline" | "traffic_spike";

export interface Anomaly {
  id: string;
  at: string;
  deviceId: string;
  deviceName: string;
  ip: string;
  kind: AnomalyKind;
  /** 0-100: lo raro que es (100 = nunca visto) */
  score: number;
  detail: string;
  /** Fecha de revisión manual; ausente mientras esté pendiente. */
  reviewedAt?: string;
}

/** Revisar un evento conserva la rutina y permite detectar nuevas incidencias. */
export function reviewAnomaly(
  state: PatternState,
  id: string,
  reviewed: boolean,
  now = new Date(),
): PatternState {
  return {
    ...state,
    anomalies: state.anomalies.map((anomaly) => {
      if (anomaly.id !== id) return anomaly;
      const next = { ...anomaly };
      if (reviewed) next.reviewedAt = now.toISOString();
      else delete next.reviewedAt;
      return next;
    }),
  };
}

export interface PatternState {
  /** Días distintos en los que NetHub estuvo vigilando en cada hora */
  observed: number[];
  lastKey: string | null;
  devices: Record<string, DevicePattern>;
  /** Media móvil de descarga (Mbps) de este PC por hora */
  traffic: number[];
  anomalies: Anomaly[];
  /** Claves "deviceId|kind|fecha|hora" ya avisadas */
  notified: string[];
}

export const MIN_LEARNING_DAYS = 5;
const MAX_ANOMALIES = 150;
const STORAGE_KEY = "nethub.patterns.v1";

const zeros = () => Array.from({ length: 24 }, () => 0);

export function emptyPatternState(): PatternState {
  return {
    observed: zeros(),
    lastKey: null,
    devices: {},
    traffic: zeros(),
    anomalies: [],
    notified: [],
  };
}

function hourKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}|${d.getHours()}`;
}

const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;

/** Días aprendidos (mínimo de horas observadas) — sirve para la barra "aprendiendo". */
export function learningDays(state: PatternState): number {
  return Math.max(0, ...state.observed);
}

/** Probabilidad (0-1) de que el equipo esté online a esa hora según su historial. */
export function onlineProbability(
  state: PatternState,
  deviceId: string,
  hour: number,
): number | null {
  const obs = state.observed[hour] ?? 0;
  if (obs < MIN_LEARNING_DAYS) return null;
  const p = state.devices[deviceId];
  return Math.min(1, (p?.hours[hour] ?? 0) / obs);
}

export function evaluatePatterns(
  prev: PatternState,
  devices: Array<{ id: string; name: string; ip: string; status: string; type?: string }>,
  rxMbps: number | null,
  now: Date = new Date(),
): { state: PatternState; fresh: Anomaly[] } {
  const hour = now.getHours();
  const key = hourKey(now);
  const state: PatternState = {
    ...prev,
    observed: [...prev.observed],
    traffic: [...prev.traffic],
    devices: { ...prev.devices },
    anomalies: [...prev.anomalies],
    notified: [...prev.notified],
  };
  const fresh: Anomaly[] = [];
  const push = (
    d: { id: string; name: string; ip: string },
    kind: AnomalyKind,
    score: number,
    detail: string,
  ) => {
    const nk = `${d.id}|${kind}|${key}`;
    if (state.notified.includes(nk)) return;
    state.notified.push(nk);
    const a: Anomaly = {
      id: `${now.getTime()}-${d.id}-${kind}`,
      at: now.toISOString(),
      deviceId: d.id,
      deviceName: d.name,
      ip: d.ip,
      kind,
      score: Math.round(score),
      detail,
    };
    fresh.push(a);
  };

  // 1) Evaluar ANTES de aprender, contra la rutina conocida.
  for (const d of devices) {
    const p = onlineProbability(state, d.id, hour);
    if (p === null || !state.devices[d.id]) continue;
    if (d.status === "online" && p < 0.12) {
      push(
        d,
        "unusual_online",
        (1 - p) * 100,
        p === 0
          ? `Nunca se había conectado a esta hora (${hh(hour)}).`
          : `Solo se conecta a las ${hh(hour)} el ${Math.round(p * 100)} % de los días.`,
      );
    } else if (d.status !== "online" && p > 0.9) {
      push(
        d,
        "unusual_offline",
        p * 100,
        `Suele estar conectado a las ${hh(hour)} (${Math.round(p * 100)} % de los días) y ahora no responde.`,
      );
    }
  }
  if (rxMbps !== null && (state.observed[hour] ?? 0) >= MIN_LEARNING_DAYS) {
    const mean = state.traffic[hour] ?? 0;
    if (rxMbps > 40 && rxMbps > mean * 4) {
      push(
        { id: "this-pc", name: "Este PC", ip: "local" },
        "traffic_spike",
        Math.min(100, (rxMbps / Math.max(1, mean)) * 10),
        `Descargando ${rxMbps.toFixed(0)} Mbps cuando a esta hora lo normal es ~${mean.toFixed(0)} Mbps.`,
      );
    }
  }

  // 2) Aprender.
  if (state.lastKey !== key) {
    state.observed[hour] = (state.observed[hour] ?? 0) + 1;
    state.lastKey = key;
  }
  for (const d of devices) {
    if (d.status !== "online") continue;
    const p = state.devices[d.id] ?? { hours: zeros(), lastKey: null };
    if (p.lastKey !== key) {
      const hours = [...p.hours];
      hours[hour] = (hours[hour] ?? 0) + 1;
      state.devices[d.id] = { hours, lastKey: key };
    }
  }
  if (rxMbps !== null) {
    const m = state.traffic[hour] ?? 0;
    state.traffic[hour] = m === 0 ? rxMbps : m * 0.95 + rxMbps * 0.05;
  }

  state.anomalies = [...fresh.reverse(), ...state.anomalies].slice(0, MAX_ANOMALIES);
  state.notified = state.notified.slice(-400);
  return { state, fresh };
}

export function sanitizePatterns(value: unknown): PatternState {
  const base = emptyPatternState();
  if (!value || typeof value !== "object") return base;
  const v = value as Partial<PatternState>;
  const arr = (a: unknown) =>
    Array.isArray(a) && a.length === 24
      ? a.map((n) => (typeof n === "number" && Number.isFinite(n) ? n : 0))
      : zeros();
  const devices: Record<string, DevicePattern> = {};
  if (v.devices && typeof v.devices === "object") {
    for (const [id, p] of Object.entries(v.devices)) {
      if (p && typeof p === "object")
        devices[id] = {
          hours: arr((p as DevicePattern).hours),
          lastKey: (p as DevicePattern).lastKey ?? null,
        };
    }
  }
  return {
    observed: arr(v.observed),
    lastKey: typeof v.lastKey === "string" ? v.lastKey : null,
    devices,
    traffic: arr(v.traffic),
    anomalies: Array.isArray(v.anomalies)
      ? (v.anomalies as Anomaly[])
          .filter(
            (a) =>
              a &&
              typeof a.id === "string" &&
              ["unusual_online", "unusual_offline", "traffic_spike"].includes(a.kind),
          )
          .slice(0, MAX_ANOMALIES)
          .map((a) => {
            const next = { ...a };
            if (typeof a.reviewedAt !== "string" || !Number.isFinite(Date.parse(a.reviewedAt)))
              delete next.reviewedAt;
            return next;
          })
      : [],
    notified: Array.isArray(v.notified)
      ? v.notified.filter((s): s is string => typeof s === "string").slice(-400)
      : [],
  };
}

export function loadStoredPatterns(): PatternState {
  if (typeof window === "undefined") return emptyPatternState();
  try {
    return sanitizePatterns(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null"));
  } catch {
    return emptyPatternState();
  }
}

export function saveStoredPatterns(state: PatternState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* sin almacenamiento */
  }
}
