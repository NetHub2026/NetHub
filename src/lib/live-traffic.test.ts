import { afterEach, describe, expect, it, vi } from "vitest";
import { readLiveTraffic } from "./desktop";
afterEach(() => vi.unstubAllGlobals());
describe("Real traffic availability", () => {
  it("does not fabricate traffic or change source after a native failure", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("window", { nethub: { traffic: vi.fn().mockRejectedValue(new Error("unavailable")) } });
    vi.stubGlobal("fetch", fetch);
    expect(await readLiveTraffic()).toMatchObject({ available: false, rxMbps: 0, txMbps: 0 });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("shows unavailable when the browser has no connected agent", async () => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await readLiveTraffic()).toMatchObject({ available: false, totalMbps: 0 });
  });
  it("keeps an actual idle sample distinct from an unavailable one", async () => {
    vi.stubGlobal("window", { nethub: { traffic: async () => ({ rxMbps: 0, txMbps: 0, available: true }) } });
    expect(await readLiveTraffic()).toMatchObject({ available: true, rxMbps: 0, txMbps: 0 });
  });
});
