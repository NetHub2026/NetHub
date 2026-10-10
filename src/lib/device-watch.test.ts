import { describe, it, expect } from "vitest";
import { evaluateWatches } from "./device-watch";
import type { Device } from "./devices";
const device: Device = {
  id: "example",
  name: "Example",
  type: "nas",
  ip: "192.168.50.2",
  mac: "02:00:00:00:00:02",
  status: "offline",
  vendor: "",
  lastSeen: "",
  downstream: 0,
  upstream: 0,
  tags: [],
  watch: { offlineMinutes: 5, recovery: true },
};
const at = (minutes: number) => new Date(Date.UTC(2026, 9, 10, 10, minutes));
describe("Device watches shared by PC and NAS", () => {
  it("waits for the grace period, alerts once and records recovery", () => {
    const start = evaluateWatches([device], at(0));
    expect(start.events).toHaveLength(0);
    const brief = evaluateWatches(start.devices, at(4));
    expect(brief.events).toHaveLength(0);
    const absent = evaluateWatches(brief.devices, at(5));
    expect(absent.events.map((e) => e.kind)).toEqual(["watch_offline"]);
    const restart = evaluateWatches(JSON.parse(JSON.stringify(absent.devices)), at(6));
    expect(restart.events).toHaveLength(0);
    const recovered = evaluateWatches([{ ...restart.devices[0]!, status: "online" }], at(7));
    expect(recovered.events.map((e) => e.kind)).toEqual(["watch_recovered"]);
    expect(evaluateWatches(recovered.devices, at(8)).events).toHaveLength(0);
  });
  it("does not count an unobserved gap or alert for disabled devices", () => {
    const start = evaluateWatches([device], at(0));
    expect(evaluateWatches(start.devices, at(30)).events).toHaveLength(0);
    expect(evaluateWatches([{ ...device, watch: undefined }], at(30)).events).toHaveLength(0);
  });
  it("can suppress recovery notices and starts a fresh absence after reconnection", () => {
    const start = evaluateWatches(
      [{ ...device, watch: { offlineMinutes: 1, recovery: false } }],
      at(0),
    );
    const offline = evaluateWatches(start.devices, at(1));
    const online = evaluateWatches([{ ...offline.devices[0]!, status: "online" }], at(2));
    expect(online.events).toHaveLength(0);
    expect(online.devices[0]!.watchState).toBeUndefined();
    expect(
      evaluateWatches([{ ...online.devices[0]!, status: "offline" }], at(3)).events,
    ).toHaveLength(0);
  });
});
