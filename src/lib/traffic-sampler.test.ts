import { describe, it, expect, vi } from "vitest";
import { createRequire } from "node:module";
const { createTrafficSampler } = createRequire(import.meta.url)("../../electron/traffic-sampler.cjs");

describe("Shared traffic counter sampling", () => {
  it("calculates 800 Mbps from 100 MB over one second and reuses the sample", async () => {
    let now = 0;
    let rx = 0;
    const counters = vi.fn(async () => ({ rx, tx: rx / 10 }));
    const read = createTrafficSampler(counters, () => now);
    expect((await read()).available).toBe(false);
    now = 1000; rx = 100_000_000;
    expect(await read()).toMatchObject({ rxMbps: 800, txMbps: 80, totalMbps: 880, available: true });
    now = 1100;
    expect((await read()).rxMbps).toBe(800);
    expect(counters).toHaveBeenCalledTimes(2);
  });
  it("shares one outstanding read between simultaneous callers", async () => {
    let resolve!: (value: unknown) => void;
    const counters = vi.fn(() => new Promise(r => { resolve = r; }));
    const read = createTrafficSampler(counters, () => 1000);
    const a = read(); const b = read(); const c = read();
    expect(a).toBe(b); expect(b).toBe(c);
    resolve({ rx: 100, tx: 20 });
    await a;
    expect(counters).toHaveBeenCalledTimes(1);
  });
  it("uses actual elapsed time when a read is delayed", async () => {
    let now = 0;
    let rx = 0;
    const read = createTrafficSampler(async () => ({ rx, tx: 0 }), () => now);
    await read(); now = 2500; rx = 250_000_000;
    expect((await read()).rxMbps).toBe(800);
  });
  it("restarts its baseline after counters reset or readings fail", async () => {
    let now = 0;
    let value: unknown = { rx: 1000, tx: 1000 };
    const read = createTrafficSampler(async () => value, () => now);
    await read(); now += 1000; value = { rx: 0, tx: 0 };
    expect((await read()).available).toBe(false);
    now += 1000; value = null;
    expect((await read()).available).toBe(false);
    now += 1000; value = { rx: 100_000_000, tx: 0 };
    expect((await read()).available).toBe(false);
    now += 1000; value = { rx: 200_000_000, tx: 0 };
    expect((await read()).rxMbps).toBe(800);
  });
});
