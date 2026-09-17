const HISTORY_KEY = "nethub.speedtest.v1";
const ENDPOINT = "/api/public/speedtest";

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
}

export type SpeedPhase = "idle" | "ping" | "download" | "upload" | "done";

export interface SpeedProgress {
  phase: SpeedPhase;
  /** Valor parcial en curso (ms en la fase de latencia, Mbps en las demás). */
  value: number;
}

function mbps(bytes: number, ms: number): number {
  if (ms <= 0) return 0;
  return Math.round(((bytes * 8) / (ms / 1000) / 1_000_000) * 10) / 10;
}

async function measureLatency(onProgress: (p: SpeedProgress) => void) {
  const samples: number[] = [];
  for (let i = 0; i < 6; i++) {
    const started = performance.now();
    await fetch(`${ENDPOINT}?bytes=1&t=${Date.now()}-${i}`, { cache: "no-store" });
    const elapsed = performance.now() - started;
    if (i > 0) samples.push(elapsed);
    onProgress({ phase: "ping", value: Math.round(elapsed) });
  }
  const avg = samples.reduce((a, b) => a + b, 0) / Math.max(1, samples.length);
  const jitter =
    samples.length > 1
      ? samples.slice(1).reduce((sum, v, i) => sum + Math.abs(v - samples[i]!), 0) /
        (samples.length - 1)
      : 0;
  return { ping: Math.round(avg), jitter: Math.round(jitter) };
}

async function measureDownload(onProgress: (p: SpeedProgress) => void) {
  const sizes = [1_000_000, 3_000_000, 6_000_000];
  let best = 0;
  for (const bytes of sizes) {
    const started = performance.now();
    const res = await fetch(`${ENDPOINT}?bytes=${bytes}&t=${Date.now()}`, {
      cache: "no-store",
    });
    const blob = await res.blob();
    const speed = mbps(blob.size, performance.now() - started);
    best = Math.max(best, speed);
    onProgress({ phase: "download", value: best });
  }
  return best;
}

async function measureUpload(onProgress: (p: SpeedProgress) => void) {
  const payload = new Uint8Array(1_500_000).fill(65);
  let best = 0;
  for (let i = 0; i < 3; i++) {
    const started = performance.now();
    await fetch(`${ENDPOINT}?t=${Date.now()}-${i}`, {
      method: "POST",
      body: payload,
      cache: "no-store",
    });
    const speed = mbps(payload.byteLength, performance.now() - started);
    best = Math.max(best, speed);
    onProgress({ phase: "upload", value: best });
  }
  return best;
}

export async function runSpeedTest(
  onProgress: (p: SpeedProgress) => void = () => {},
): Promise<SpeedResult> {
  const { ping, jitter } = await measureLatency(onProgress);
  const download = await measureDownload(onProgress);
  const upload = await measureUpload(onProgress);
  const result: SpeedResult = {
    at: new Date().toISOString(),
    ping,
    jitter,
    download,
    upload,
  };
  onProgress({ phase: "done", value: download });
  saveResult(result);
  return result;
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
