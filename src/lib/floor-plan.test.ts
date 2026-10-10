import { describe, it, expect, vi, afterEach } from "vitest";
import {
  validateFloorPlan,
  measureLocalCoverage,
  polygonRoom,
  roomContains,
  type FloorPlan,
} from "./floor-plan";
import { sanitizeSettings } from "./settings";
const example: FloorPlan = {
  version: 1,
  updatedAt: "2026-10-10T10:00:00.000Z",
  name: "Example",
  image: "data:image/png;base64,aGVsbG8=",
  width: 800,
  height: 600,
  positions: { example: { x: 50, y: 20 } },
  rooms: [{ id: "room", name: "Example room", x: 10, y: 10, width: 40, height: 30 }],
  measurements: [],
};
afterEach(() => vi.unstubAllGlobals());
describe("real floor plan", () => {
  it("preserves valid plans through desktop settings and rejects active content", () => {
    expect(sanitizeSettings({ floorPlan: example }).floorPlan).toEqual(example);
    expect(() =>
      validateFloorPlan({ ...example, image: "data:image/svg+xml;base64,aGVsbG8=" }),
    ).toThrow();
    expect(() =>
      validateFloorPlan({ ...example, image: "https://example.org/plan.jpg" }),
    ).toThrow();
    expect(() =>
      validateFloorPlan({ ...example, positions: { example: { x: 110, y: 0 } } }),
    ).toThrow();
    expect(() =>
      validateFloorPlan({ ...example, rooms: [{ ...example.rooms[0], x: 95, width: 20 }] }),
    ).toThrow();
    expect(() => validateFloorPlan({ ...example, image: "x".repeat(2_000_001) })).toThrow();
    expect(sanitizeSettings({ floorPlan: { ...example, width: -1 } }).floorPlan).toBeNull();
  });
  it("preserves concave rooms in settings and excludes the missing corner", () => {
    const room = polygonRoom("l", "L room", [
      { x: 10, y: 10 },
      { x: 70, y: 10 },
      { x: 70, y: 30 },
      { x: 30, y: 30 },
      { x: 30, y: 70 },
      { x: 10, y: 70 },
    ]);
    const plan = { ...example, rooms: [room] };
    expect(sanitizeSettings({ floorPlan: plan }).floorPlan).toEqual(plan);
    expect(validateFloorPlan(JSON.parse(JSON.stringify(plan)))).toEqual(plan);
    expect(roomContains(room, { x: 20, y: 60 })).toBe(true);
    expect(roomContains(room, { x: 60, y: 20 })).toBe(true);
    expect(roomContains(room, { x: 60, y: 60 })).toBe(false);
    expect(roomContains(room, { x: 30, y: 50 })).toBe(true);
    expect(roomContains(example.rooms[0]!, { x: 20, y: 20 })).toBe(true);
  });
  it("rejects crossed, flat, oversized and invalid contours", () => {
    for (const points of [
      [
        { x: 10, y: 10 },
        { x: 60, y: 60 },
        { x: 10, y: 60 },
        { x: 60, y: 10 },
      ],
      [
        { x: 10, y: 10 },
        { x: 20, y: 20 },
        { x: 30, y: 30 },
      ],
      [
        { x: 10, y: 10 },
        { x: 101, y: 10 },
        { x: 10, y: 30 },
      ],
      Array(41).fill({ x: 10, y: 10 }),
    ])
      expect(() => polygonRoom("r", "Room", points)).toThrow();
  });
  it("preserves the plan lock through JSON and desktop settings", () => {
    const locked = { ...example, locked: true };
    expect(validateFloorPlan(JSON.parse(JSON.stringify(locked)))).toEqual(locked);
    expect(sanitizeSettings({ floorPlan: locked }).floorPlan).toEqual(locked);
    expect(() => validateFloorPlan({ ...example, locked: "yes" })).toThrow();
  });
  it("rejects invented invalid measurement values and bounds history", () => {
    const m = {
      id: "point",
      at: example.updatedAt,
      session: "Before",
      label: "Room",
      x: 20,
      y: 30,
      latencyMs: 2,
      jitterMs: 1,
      downloadMbps: 90,
      connection: "unknown",
      band: "unknown",
    };
    expect(validateFloorPlan({ ...example, measurements: [m] })?.measurements).toEqual([m]);
    expect(() =>
      validateFloorPlan({ ...example, measurements: [{ ...m, downloadMbps: Infinity }] }),
    ).toThrow();
    expect(() => validateFloorPlan({ ...example, measurements: Array(201).fill(m) })).toThrow();
  });
  it("measures only same-origin uncached payloads and fails rather than fabricating results", async () => {
    const fetch = vi.fn(
      async (url: string) =>
        new Response(new Uint8Array(url.includes("payload") ? 4 * 1024 * 1024 : 6)),
    );
    vi.stubGlobal("fetch", fetch);
    let time = 0;
    vi.spyOn(performance, "now").mockImplementation(() => (time += 100));
    try {
      const result = await measureLocalCoverage(new AbortController().signal);
      expect(result.latencyMs).toBe(100);
      expect(result.downloadMbps).toBeCloseTo(335.54432);
      expect(fetch).toHaveBeenCalledTimes(10);
      expect(fetch.mock.calls.every(([url]) => url.startsWith("/api/coverage-"))).toBe(true);
      vi.stubGlobal("fetch", async () => new Response("Unauthorized", { status: 401 }));
      await expect(measureLocalCoverage(new AbortController().signal)).rejects.toThrow();
    } finally {
      vi.restoreAllMocks();
    }
  });
});
