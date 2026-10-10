import type { Device } from "./devices";
import type { ActivityEvent } from "./activity";
export const watchDelays = [0, 1, 5, 10, 30, 60] as const;
export function normalizeWatch(value: unknown): Device["watch"] {
  if (!value || typeof value !== "object") return undefined;
  const v = value as Record<string, unknown>;
  if (!watchDelays.includes(v["offlineMinutes"] as never) || typeof v["recovery"] !== "boolean")
    return undefined;
  return { offlineMinutes: Number(v["offlineMinutes"]), recovery: v["recovery"] };
}
/** Only successful scans advance absence alerts. Persisted state prevents repeated alerts. */
export function evaluateWatches(
  devices: Device[],
  now = new Date(),
): { devices: Device[]; events: ActivityEvent[] } {
  const events: ActivityEvent[] = [];
  const at = now.toISOString();
  const records = devices.map((d) => {
    const watch = normalizeWatch(d.watch);
    if (!watch?.offlineMinutes) return { ...d, watch, watchState: undefined };
    const emit = (kind: "watch_offline" | "watch_recovered", detail: string) =>
      events.push({
        id: `${at}-${kind}-${d.id}`,
        kind,
        at,
        deviceId: d.id,
        name: d.name,
        ip: d.ip,
        type: d.type,
        detail,
      });
    if (d.status === "online") {
      if (d.watchState?.alerted && watch.recovery)
        emit("watch_recovered", "Ha vuelto a responder.");
      return { ...d, watch, watchState: undefined };
    }
    const checked = d.watchState?.checkedAt;
    const continuous = checked && now.getTime() - Date.parse(checked) <= 15 * 60000;
    const stored = continuous ? d.watchState?.since : undefined;
    const since =
      stored && Number.isFinite(Date.parse(stored)) && Date.parse(stored) <= now.getTime()
        ? stored
        : at;
    let alerted = d.watchState?.alerted === true;
    if (!alerted && now.getTime() - Date.parse(since) >= watch.offlineMinutes * 60000) {
      emit("watch_offline", `Sin respuesta durante al menos ${watch.offlineMinutes} min.`);
      alerted = true;
    }
    return { ...d, watch, watchState: { since, alerted, checkedAt: at } };
  });
  return { devices: records, events };
}
