/**
 * SLA del operador: historial de tests de velocidad automáticos comparados
 * con la velocidad contratada, más los cortes registrados por el Health Radar.
 */

export interface SlaSample {
  at: string;
  download: number;
  upload: number;
  ping: number;
}

export const MAX_SLA_SAMPLES = 180;
export const STORAGE_KEY = "nethub.sla.v1";

export function appendSlaSample(samples: SlaSample[], sample: SlaSample): SlaSample[] {
  return [...samples, sample].slice(-MAX_SLA_SAMPLES);
}

export interface SlaVerdict {
  level: "ok" | "fair" | "bad";
  label: string;
}

export interface SlaStats {
  /** % de la velocidad contratada que se está recibiendo (últimos 10 tests) */
  compliance: number | null;
  avgDownload: number | null;
  avgUpload: number | null;
  tests: number;
  verdict: SlaVerdict | null;
  /** Media de descarga por día (últimos 14 días) */
  daily: Array<{ date: string; download: number }>;
  /** Cortes de Internet (Health Radar) en los últimos 7 días */
  outages7: number;
  lastTests: SlaSample[];
}

export function slaStats(
  samples: SlaSample[],
  contracted: number,
  health: Array<{ at: string; internet: number | null }> = [],
): SlaStats {
  const lastTests = samples.slice(-10);
  const avgDownload = lastTests.length
    ? Math.round((lastTests.reduce((s, x) => s + x.download, 0) / lastTests.length) * 10) / 10
    : null;
  const avgUpload = lastTests.length
    ? Math.round((lastTests.reduce((s, x) => s + x.upload, 0) / lastTests.length) * 10) / 10
    : null;
  const compliance =
    avgDownload !== null && contracted > 0
      ? Math.round((avgDownload / contracted) * 100)
      : null;
  const verdict: SlaVerdict | null =
    compliance === null
      ? null
      : compliance >= 95
        ? { level: "ok", label: "Cumple el contrato" }
        : compliance >= 80
          ? { level: "fair", label: "Va justo" }
          : { level: "bad", label: "No cumple el contrato" };

  // Medias por día (locales, últimos 14 días).
  const byDay = new Map<string, { sum: number; n: number }>();
  for (const s of samples) {
    const d = new Date(s.at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate(),
    ).padStart(2, "0")}`;
    const acc = byDay.get(key) ?? { sum: 0, n: 0 };
    acc.sum += s.download;
    acc.n += 1;
    byDay.set(key, acc);
  }
  const daily = [...byDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-14)
    .map(([date, acc]) => ({ date, download: Math.round((acc.sum / acc.n) * 10) / 10 }));

  const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
  const outages7 = health.filter(
    (h) => h.internet === null && new Date(h.at).getTime() >= weekAgo,
  ).length;

  return { compliance, avgDownload, avgUpload, tests: samples.length, verdict, daily, outages7, lastTests };
}

export function sanitizeSla(value: unknown): SlaSample[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (s): s is SlaSample =>
        Boolean(s) &&
        typeof s === "object" &&
        typeof (s as SlaSample).at === "string" &&
        Number.isFinite((s as SlaSample).download),
    )
    .slice(-MAX_SLA_SAMPLES)
    .map((s) => ({
      at: s.at,
      download: Number(s.download) || 0,
      upload: Number(s.upload) || 0,
      ping: Number(s.ping) || 0,
    }));
}

export function loadStoredSla(): SlaSample[] {
  if (typeof window === "undefined") return [];
  try {
    return sanitizeSla(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]"));
  } catch {
    return [];
  }
}

export function saveStoredSla(samples: SlaSample[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(samples));
  } catch {
    /* sin almacenamiento */
  }
}

/** CSV del informe para reclamar al operador. */
export function slaCsv(samples: SlaSample[], contracted: number): string {
  const rows = [
    `Fecha;Descarga (Mbps);Subida (Mbps);Ping (ms);Contratada (Mbps);% cumplimiento`,
    ...samples.map((s) => {
      const pct = contracted > 0 ? Math.round((s.download / contracted) * 100) : "";
      return `${s.at};${s.download};${s.upload};${s.ping};${contracted};${pct}`;
    }),
  ];
  return rows.join("\n");
}
