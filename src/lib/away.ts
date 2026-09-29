/**
 * Modo Ausente: alarma doméstica. Cuando los móviles de confianza dejan de
 * verse en la red, NetHub «arma» el modo; mientras esté armado, cualquier
 * equipo no reconocido que aparezca o se conecte genera una alerta.
 */

export type AwayEventKind = "armed" | "disarmed" | "activity";

export interface AwayEvent {
  kind: AwayEventKind;
  at: string;
  detail: string;
}

export interface AwayState {
  armed: boolean;
  /** Desde cuándo está armado (ISO) */
  awaySince: string | null;
  /** Ids de los dispositivos cuya presencia indica «hay alguien en casa» */
  watchedIds: string[];
  history: AwayEvent[];
}

export const MAX_AWAY_EVENTS = 100;
export const STORAGE_KEY = "nethub.away.v1";

export function emptyAwayState(): AwayState {
  return { armed: false, awaySince: null, watchedIds: [], history: [] };
}

function pushEvent(state: AwayState, event: AwayEvent): AwayState {
  return { ...state, history: [...state.history, event].slice(-MAX_AWAY_EVENTS) };
}

/** Móviles de confianza por defecto: su presencia = hay gente en casa. */
export function defaultWatchedIds(devices: Array<{ id: string; type: string; trusted?: boolean }>): string[] {
  const trusted = devices.filter((d) => d.trusted);
  const phones = trusted.filter((d) => d.type === "smartphone");
  const chosen = phones.length > 0 ? phones : trusted;
  return chosen.slice(0, 5).map((d) => d.id);
}

export function watchedIdsOf(state: AwayState, devices: DeviceLike[]): string[] {
  if (state.watchedIds.length > 0) return state.watchedIds;
  return defaultWatchedIds(devices);
}

interface DeviceLike {
  id: string;
  type: string;
  trusted?: boolean;
  status: string;
}

/** ¿Hay alguien en casa según los dispositivos vigilados? */
export function someoneHome(state: AwayState, devices: DeviceLike[]): boolean {
  const watched = watchedIdsOf(state, devices);
  if (watched.length === 0) return false;
  return devices.some((d) => watched.includes(d.id) && d.status === "online");
}

export function armAway(state: AwayState, at: Date = new Date(), detail = "Modo ausente activado"): AwayState {
  if (state.armed) return state;
  return pushEvent(
    { ...state, armed: true, awaySince: at.toISOString() },
    { kind: "armed", at: at.toISOString(), detail },
  );
}

export function disarmAway(
  state: AwayState,
  at: Date = new Date(),
  detail = "Modo ausente desactivado",
): AwayState {
  if (!state.armed) return state;
  return pushEvent({ ...state, armed: false, awaySince: null }, { kind: "disarmed", at: at.toISOString(), detail });
}

export interface AwayEvaluation {
  state: AwayState;
  changed: boolean;
}

/**
 * Evalúa el estado tras un escaneo: arma automáticamente cuando nadie está
 * en casa (si la opción está activa) y desarma al volver.
 */
export function evaluateAway(
  state: AwayState,
  devices: DeviceLike[],
  autoArm: boolean,
  now: Date = new Date(),
): AwayEvaluation {
  let next = state;
  if (!autoArm) return { state: next, changed: false };
  const home = someoneHome(state, devices);
  const watched = watchedIdsOf(state, devices);
  if (!state.armed && watched.length > 0 && !home) {
    next = armAway(next, now, "Nadie en casa: los móviles vigilados no están en la red");
    return { state: next, changed: true };
  }
  if (state.armed && home) {
    next = disarmAway(next, now, "Presencia detectada: un móvil vigilado ha vuelto");
    return { state: next, changed: true };
  }
  return { state: next, changed: false };
}

/** Registra actividad sospechosa mientras está armado. */
export function addAwayActivity(state: AwayState, detail: string, at: Date = new Date()): AwayState {
  return pushEvent(state, { kind: "activity", at: at.toISOString(), detail });
}

export function sanitizeAway(value: unknown): AwayState {
  const base = emptyAwayState();
  if (!value || typeof value !== "object") return base;
  const raw = value as Partial<AwayState>;
  const history = Array.isArray(raw.history)
    ? raw.history
        .filter(
          (e): e is AwayEvent =>
            Boolean(e) &&
            typeof e === "object" &&
            typeof (e as AwayEvent).at === "string" &&
            typeof (e as AwayEvent).detail === "string" &&
            ["armed", "disarmed", "activity"].includes((e as AwayEvent).kind),
        )
        .slice(-MAX_AWAY_EVENTS)
    : [];
  return {
    armed: Boolean(raw.armed),
    awaySince: typeof raw.awaySince === "string" ? raw.awaySince : null,
    watchedIds: Array.isArray(raw.watchedIds)
      ? raw.watchedIds.filter((id): id is string => typeof id === "string").slice(0, 20)
      : [],
    history,
  };
}

export function loadStoredAway(): AwayState {
  if (typeof window === "undefined") return emptyAwayState();
  try {
    return sanitizeAway(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null"));
  } catch {
    return emptyAwayState();
  }
}

export function saveStoredAway(state: AwayState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* sin almacenamiento */
  }
}
