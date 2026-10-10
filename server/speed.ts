import type { SpeedResult } from "../src/lib/speedtest";
const ENDPOINT = "https://speed.cloudflare.com";
type Progress = { phase: string; value: number; progress: number };
export async function measureSpeed(onProgress: (value: Progress) => void): Promise<SpeedResult> {
  const latencies: number[] = [];
  for (let i = 0; i < 5; i++) {
    const start = performance.now();
    const response = await fetch(`${ENDPOINT}/__down?bytes=0`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error("El servidor de prueba no está disponible.");
    await response.arrayBuffer();
    latencies.push(performance.now() - start);
    onProgress({ phase: "latency", value: latencies.at(-1)!, progress: ((i + 1) / 5) * 0.1 });
  }
  const phase = async (upload: boolean) => {
    const start = performance.now(),
      duration = 15000;
    let bytes = 0,
      peak = 0;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), duration);
    const update = () => {
      const elapsed = performance.now() - start;
      const value = (bytes * 8) / elapsed / 1000;
      peak = Math.max(peak, value);
      onProgress({
        phase: upload ? "upload" : "download",
        value,
        progress: (upload ? 0.55 : 0.1) + Math.min(1, elapsed / duration) * 0.45,
      });
    };
    const tick = setInterval(update, 500);
    let successful = 0,
      lastError: unknown;
    try {
      await Promise.all(
        Array.from({ length: 4 }, async () => {
          while (!controller.signal.aborted) {
            try {
              if (upload) {
                const body = new Uint8Array(2 * 1024 * 1024);
                const response = await fetch(`${ENDPOINT}/__up`, {
                  method: "POST",
                  body,
                  signal: controller.signal,
                });
                if (!response.ok) throw new Error("El servidor rechazó la subida.");
                await response.arrayBuffer();
                bytes += body.byteLength;
              } else {
                const response = await fetch(`${ENDPOINT}/__down?bytes=25000000`, {
                  signal: controller.signal,
                });
                if (!response.ok || !response.body)
                  throw new Error("El servidor rechazó la descarga.");
                for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>)
                  bytes += chunk.byteLength;
              }
              successful++;
            } catch (error) {
              if (!controller.signal.aborted) {
                lastError = error;
                controller.abort();
              }
              break;
            }
          }
        }),
      );
      if (lastError) throw lastError;
      if (!bytes || (upload && !successful))
        throw new Error("No se recibieron datos suficientes para la prueba.");
      update();
      return {
        average: Math.round((bytes * 8) / (performance.now() - start) / 100) / 10,
        peak: Math.round(peak * 10) / 10,
      };
    } finally {
      controller.abort();
      clearTimeout(timer);
      clearInterval(tick);
    }
  };
  const down = await phase(false),
    up = await phase(true);
  return {
    at: new Date().toISOString(),
    ping: Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length),
    jitter: Math.round(
      latencies.slice(1).reduce((n, v, i) => n + Math.abs(v - latencies[i]!), 0) / 4,
    ),
    download: down.average,
    upload: up.average,
    peakDownload: down.peak,
    peakUpload: up.peak,
  };
}
