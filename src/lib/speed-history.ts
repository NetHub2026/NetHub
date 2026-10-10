import type { SpeedResult } from "./speedtest";

const HISTORY_KEY = "nethub.speedtest.v1";
const LIMIT_KEY = "nethub.speedtest.limit";
export const SPEED_HISTORY_LIMITS = [10, 25, 50, 100] as const;
export const SPEED_HISTORY_CHANGED = "nethub:speed-history-changed";
export function speedHistoryLimit(value: unknown): number {
  return SPEED_HISTORY_LIMITS.includes(Number(value) as 10 | 25 | 50 | 100) ? Number(value) : 10;
}
export function sanitizeSpeedHistory(value: unknown): SpeedResult[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || typeof item.at !== "string" || !Number.isFinite(Date.parse(item.at))) return [];
    const fields = ["ping", "jitter", "download", "upload"] as const;
    if (fields.some(key => typeof item[key] !== "number" || !Number.isFinite(item[key]) || item[key] < 0)) return [];
    const peak = (key: "peakDownload" | "peakUpload", fallback: number) => typeof item[key] === "number" && Number.isFinite(item[key]) && item[key] >= 0 ? item[key] : fallback;
    return [{ at: item.at, ping: item.ping, jitter: item.jitter, download: item.download, upload: item.upload,
      peakDownload: peak("peakDownload", item.download), peakUpload: peak("peakUpload", item.upload) }];
  }).sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).filter(item => {
    const key = new Date(item.at).toISOString();
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }).slice(0, 100);
}
export function loadStoredSpeedHistory(): SpeedResult[] {
  try { return sanitizeSpeedHistory(JSON.parse(window.localStorage.getItem(HISTORY_KEY) || "[]")); } catch { return []; }
}
export function loadStoredSpeedHistoryLimit(): number {
  try { return speedHistoryLimit(window.localStorage.getItem(LIMIT_KEY)); } catch { return 10; }
}
export function saveStoredSpeedHistory(history: SpeedResult[], limit: number): void {
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(sanitizeSpeedHistory(history)));
    window.localStorage.setItem(LIMIT_KEY, String(speedHistoryLimit(limit)));
  } catch { /* Desktop JSON remains the source of truth. */ }
}
