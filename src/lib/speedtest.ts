const HISTORY_KEY = "nethub.speedtest.v1";
/** Servidores públicos de Cloudflare (Internet real, no el propio PC). */
const CF = "https://speed.cloudflare.com";

export interface SpeedResult {
  at: string;
  /** Latencia media en ms */
  ping: number;
  /** Variación entre medidas en ms */
  jitter: number;
  /** Mbps */
  download: number;
  /** Mbps */
  upload: number;
  /** Velocidad máxima alcanzada durante la fase de descarga (Mbps) */
  peakDownload: number;
  /** Velocidad máxima alcanzada durante la fase de subida (Mbps) */
  peakUpload: number;
}

export type SpeedPhase = "idle" | "ping" | "download" | "upload" | "done";

/** Duración real de medición de cada fase de transferencia, en ms. */
const DOWNLOAD_MS = 30_000;
const UPLOAD_MS = 15_000;
const LATENCY_MS = 2_000;
/** Tamaño de cada bloque de descarga (4 MB): suficiente para saturar enlaces de 1 Gbps. */
const DOWNLOAD_CHUNK_BYTES = 4_000_000;
/** Tamaño de cada bloque de subida (4 MB). */
const UPLOAD_CHUNK_BYTES = 4_000_000;
/** Descargas paralelas simultáneas durante la fase de descarga. */
const DOWNLOAD_PARALLEL = 6;
/** Subidas paralelas simultáneas durante la fase de subida. */
const UPLOAD_PARALLEL = 4;

export interface SpeedProgress {
  phase: SpeedPhase;
  /** Valor en curso (ms en la fase de latencia, Mbps en las demás). */
  value: number;
  /** Progreso de la fase actual, de 0 a 1. */
  phaseProgress: number;
  /** Progreso total del test (aprox. 47 s), de 0 a 1. */
  totalProgress: number;
  /** Segundos restantes aproximados del test completo. */
  secondsLeft: number;
  /** Pico alcanzado hasta el momento en la fase de transferencia actual (Mbps). */
  peak: number;
}

function mbps(bytes: number, ms: number): number {
  if (ms <= 0) return 0;
  return ((bytes * 8) / (ms / 1000) / 1_000_000) * 1;
}

async function measureLatency(
  onProgress: (p: SpeedProgress) => void,
  totalMs: number,
) {
  const samples: number[] = [];
  for (let i = 0; i < 6; i++) {
    const started = performance.now();
    await fetch(`${CF}/__down?bytes=0&t=${Date.now()}-${i}`, { cache: "no-store" });
    const elapsed = performance.now() - started;
    if (i > 0) samples.push(elapsed);
    onProgress({
      phase: "ping",
      value: Math.round(elapsed),
      phaseProgress: (i + 1) / 6,
      totalProgress: ((i + 1) / 6) * 2000 / totalMs,
      secondsLeft: Math.max(0, Math.round((totalMs - (i + 1) * 333) / 1000)),
      peak: 0,
    });
  }
  const avg = samples.reduce((a, b) => a + b, 0) / Math.max(1, samples.length);
  const jitter =
    samples.length > 1
      ? samples.slice(1).reduce((sum, v, i) => sum + Math.abs(v - samples[i]!), 0) /
        (samples.length - 1)
      : 0;
  return { ping: Math.round(avg), jitter: Math.round(jitter) };
}

/**
 * Descarga continua durante DOWNLOAD_MS con varios flujos paralelos encadenados:
 * en cuanto un bloque termina, se pide el siguiente, de forma que el enlace
 * nunca queda ocioso y conexiones rápidas alcanzan su ventana TCP óptima.
 */
async function measureDownload(
  onProgress: (p: SpeedProgress) => void,
  totalMs: number,
  elapsedBefore: number,
) {
  const end = performance.now() + DOWNLOAD_MS;
  let bytes = 0;
  let peak = 0;
  let stopped = false;

  const worker = async () => {
    while (!stopped && performance.now() < end) {
      const res = await fetch(`${CF}/__down?bytes=${DOWNLOAD_CHUNK_BYTES}&t=${Date.now()}-${Math.random()}`, {
        cache: "no-store",
      });
      const blob = await res.blob();
      bytes += blob.size;
    }
  };

  const tick = window.setInterval(() => {
    const elapsed = performance.now() - (end - DOWNLOAD_MS);
    const current = mbps(bytes, elapsed);
    peak = Math.max(peak, current);
    const phaseProgress = Math.min(1, elapsed / DOWNLOAD_MS);
    onProgress({
      phase: "download",
      value: current,
      phaseProgress,
      totalProgress: Math.min(1, (elapsedBefore + elapsed) / totalMs),
      secondsLeft: Math.max(0, Math.round((totalMs - elapsedBefore - elapsed) / 1000)),
      peak,
    });
  }, 100);

  await Promise.all(Array.from({ length: DOWNLOAD_PARALLEL }, worker));
  stopped = true;
  window.clearInterval(tick);

  const elapsed = performance.now() - (end - DOWNLOAD_MS);
  const avg = mbps(bytes, elapsed);
  return { avg, peak: Math.max(peak, avg) };
}

/** Subida continua durante DOWNLOAD_MS con varios flujos paralelos encadenados. */
async function measureUpload(
  onProgress: (p: SpeedProgress) => void,
  totalMs: number,
  elapsedBefore: number,
) {
  const end = performance.now() + UPLOAD_MS;
  const payload = new Uint8Array(UPLOAD_CHUNK_BYTES).fill(65);
  let bytes = 0;
  let peak = 0;
  let stopped = false;

  const worker = async () => {
    while (!stopped && performance.now() < end) {
      await fetch(`${CF}/__up?t=${Date.now()}-${Math.random()}`, {
        method: "POST",
        body: payload,
        cache: "no-store",
      });
      bytes += payload.byteLength;
    }
  };

  const tick = window.setInterval(() => {
    const elapsed = performance.now() - (end - UPLOAD_MS);
    const current = mbps(bytes, elapsed);
    peak = Math.max(peak, current);
    const phaseProgress = Math.min(1, elapsed / UPLOAD_MS);
    onProgress({
      phase: "upload",
      value: current,
      phaseProgress,
      totalProgress: Math.min(1, (elapsedBefore + elapsed) / totalMs),
      secondsLeft: Math.max(0, Math.round((totalMs - elapsedBefore - elapsed) / 1000)),
      peak,
    });
  }, 100);

  await Promise.all(Array.from({ length: UPLOAD_PARALLEL }, worker));
  stopped = true;
  window.clearInterval(tick);

  const elapsed = performance.now() - (end - UPLOAD_MS);
  const avg = mbps(bytes, elapsed);
  return { avg, peak: Math.max(peak, avg) };
}

/** Candado: solo un test a la vez (el automático del SLA salta si hay uno en marcha). */
let runningTest = false;

export function speedTestBusy(): boolean {
  return runningTest;
}

export async function runSpeedTest(
  onProgress: (p: SpeedProgress) => void = () => {},
): Promise<SpeedResult> {
  if (runningTest) throw new Error("speedtest-busy");
  runningTest = true;
  try {
    // ~2 s de latencia + 30 s de descarga + 15 s de subida ≈ 47 s en total.
    const totalMs = LATENCY_MS + DOWNLOAD_MS + UPLOAD_MS;
    const { ping, jitter } = await measureLatency(onProgress, totalMs);
    const elapsedBeforePing = LATENCY_MS;
    const download = await measureDownload(onProgress, totalMs, elapsedBeforePing);
    const elapsedBeforeUpload = elapsedBeforePing + DOWNLOAD_MS;
    const upload = await measureUpload(onProgress, totalMs, elapsedBeforeUpload);
    const result: SpeedResult = {
      at: new Date().toISOString(),
      ping,
      jitter,
      download: Math.round(download.avg * 10) / 10,
      upload: Math.round(upload.avg * 10) / 10,
      peakDownload: Math.round(download.peak * 10) / 10,
      peakUpload: Math.round(upload.peak * 10) / 10,
    };
    onProgress({
      phase: "done",
      value: result.download,
      phaseProgress: 1,
      totalProgress: 1,
      secondsLeft: 0,
      peak: result.peakDownload,
    });
    saveResult(result);
    return result;
  } finally {
    runningTest = false;
  }
}

export function loadSpeedHistory(): SpeedResult[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as SpeedResult[]) : [];
  } catch {
    return [];
  }
}

function saveResult(result: SpeedResult) {
  if (typeof window === "undefined") return;
  try {
    const next = [result, ...loadSpeedHistory()].slice(0, 12);
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    /* almacenamiento no disponible */
  }
}

export function clearSpeedHistory() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(HISTORY_KEY);
}
