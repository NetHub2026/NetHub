import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, writeFile, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { request as httpRequest, type Server } from "node:http";
import { StateStore } from "./storage";
import { Monitor } from "./monitor";
import { createHttpServer } from "./http";
import { privateIp, inSubnet, parseArpScan } from "./network";
import { Authentication } from "./auth";
const directories: string[] = [];
const servers: Server[] = [];
const monitors: Monitor[] = [];
async function fixture(demo = true) {
  const directory = await mkdtemp(join(tmpdir(), "nethub-server-test-"));
  directories.push(directory);
  const monitor = new Monitor(new StateStore(directory), { demo });
  monitors.push(monitor);
  await monitor.init();
  return { directory, monitor };
}
afterEach(async () => {
  for (const server of servers.splice(0)) {
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
  }
  for (const monitor of monitors.splice(0)) await monitor.stop();
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true });
});
describe("Network boundaries", () => {
  it("accepts only valid RFC1918 IPv4 and the selected subnet", () => {
    expect(privateIp("192.168.20.3")).toBe(true);
    expect(privateIp("172.16.0.2")).toBe(true);
    for (const ip of [
      "8.8.8.8",
      "127.0.0.1",
      "169.254.1.1",
      "192.168.300.1",
      "172.32.0.1",
      "010.1.1.1",
      "192.168.000.1",
      "10.1.1.1;whoami",
    ])
      expect(privateIp(ip)).toBe(false);
    expect(inSubnet("10.20.30.2", "10.20.30.1/24")).toBe(true);
    expect(inSubnet("10.20.31.2", "10.20.30.1/24")).toBe(false);
  });
  it("filters malformed and out-of-subnet responses and deduplicates MACs", () => {
    const results = parseArpScan(
      "192.168.50.4\t02:00:00:00:00:04\tExample\n192.168.50.4 02:00:00:00:00:04\n192.168.60.4 02:00:00:00:00:05\n192.168.50.8 nope\n192.168.50.9 ff:ff:ff:ff:ff:ff",
      { name: "test", address: "192.168.50.2", cidr: "192.168.50.2/24", gateway: null },
    );
    expect(results).toEqual([{ ip: "192.168.50.4", mac: "02:00:00:00:00:04", online: true }]);
  });
});
describe("Durable continuous monitor", () => {
  it("retains seven recoverable backup versions without archiving every state write", async () => {
    const { monitor, directory } = await fixture();
    await monitor.scan();
    for (let revision = 1; revision <= 9; revision++) {
      await monitor.settings({ contractedMbps: revision * 100 });
      await monitor.store.backup();
      await new Promise((resolve) => setTimeout(resolve, 2));
    }
    const archive = join(directory, "backups");
    const files = (await readdir(archive)).sort();
    expect(files).toHaveLength(7);
    expect(await monitor.store.listBackups()).toHaveLength(7);
    await expect(monitor.store.readBackup("../server-state.json")).rejects.toThrow();
    const values = await Promise.all(
      files.map(
        async (file) =>
          JSON.parse(await readFile(join(archive, file), "utf8")).settings.contractedMbps,
      ),
    );
    expect(values).toEqual([300, 400, 500, 600, 700, 800, 900]);
    await monitor.settings({ contractedMbps: 1000 });
    expect(await readdir(archive)).toHaveLength(7);
    const restored = JSON.parse(await readFile(join(archive, files[0]!), "utf8"));
    expect(await monitor.store.readBackup(files[0]!)).toEqual(restored);
    await monitor.importData(restored);
    expect(monitor.state.devices).toHaveLength(3);
    expect((await monitor.store.load()).settings.contractedMbps).toBe(1000);
  });
  it("persists watch settings and waits through successful scans without repeating absence alerts", async () => {
    const { monitor, directory } = await fixture();
    await monitor.scan();
    const d = monitor.state.devices[0]!;
    await monitor.editDevice(
      d.id,
      { watch: { offlineMinutes: 5, recovery: true } },
      { watch: null },
    );
    monitor.options.demo = false;
    monitor.options.scan = async () => [];
    monitor.options.now = () => new Date("2026-10-10T10:00:00Z");
    await monitor.scan();
    monitor.options.now = () => new Date("2026-10-10T10:05:00Z");
    await monitor.scan();
    expect(monitor.state.events.filter((e) => e.kind === "watch_offline")).toHaveLength(1);
    await monitor.scan();
    expect(monitor.state.events.filter((e) => e.kind === "watch_offline")).toHaveLength(1);
    expect((await monitor.store.load()).devices[0]!.watchState?.alerted).toBe(true);
    monitor.options.demo = true;
    await monitor.scan();
    expect(monitor.state.events.filter((e) => e.kind === "watch_recovered")).toHaveLength(1);
    expect((await new StateStore(directory).load()).devices[0]!.watch).toEqual({
      offlineMinutes: 5,
      recovery: true,
    });
  });
  it("serializes concurrent backups and updates without truncating either JSON", async () => {
    const { monitor, directory } = await fixture();
    await monitor.scan();
    await Promise.all([
      monitor.store.backup(),
      monitor.store.backup(),
      monitor.settings({ contractedMbps: 750 }),
    ]);
    expect(
      JSON.parse(await readFile(join(directory, "server-state.backup.json"), "utf8")).devices,
    ).toHaveLength(3);
    expect((await monitor.store.load()).settings.contractedMbps).toBe(750);
  });
  it("imports a Windows JSON with legacy speed history and backs up the previous state", async () => {
    const { monitor, directory } = await fixture();
    await monitor.scan();
    await monitor.settings({ scanIntervalSeconds: 120, contractedMbps: 1000 });
    const device = {
      ...monitor.state.devices[0]!,
      name: "Imported example",
      location: "Imported room",
      manualEdit: true,
      roomPosition: { room: "Imported room", x: 30, y: 50 },
    };
    await monitor.importData({
      devices: [device],
      people: ["Example owner"],
      locations: ["Imported room"],
      speedHistoryLimit: 50,
      speedHistory: [
        { at: "2026-10-10T10:00:00Z", ping: 20, jitter: 2, download: 800, upload: 700 },
      ],
      sla: [{ at: "2026-10-09T10:00:00Z", ping: 22, download: 780, upload: 710 }],
    });
    expect(monitor.state.devices).toHaveLength(1);
    expect(monitor.state.devices[0]!.roomPosition).toEqual(device.roomPosition);
    expect(monitor.state.settings.scanIntervalSeconds).toBe(120);
    expect(monitor.state.settings.contractedMbps).toBe(1000);
    expect(monitor.state.settings.interfaceName).toBe("demo");
    expect(monitor.state.settings.speedHistoryLimit).toBe(50);
    expect(monitor.state.speedHistory).toHaveLength(2);
    expect(monitor.state.speedHistory[1]!.migratedSla).toBe(true);
    expect(
      JSON.parse(await readFile(join(directory, "server-state.backup.json"), "utf8")).devices,
    ).toHaveLength(3);
    const restored = await monitor.store.load();
    expect(restored.speedHistory).toEqual(monitor.state.speedHistory);
    expect(restored.settings.locations).toEqual(["Imported room"]);
  });
  it("rejects malformed imports without changing the state or its backup", async () => {
    const { monitor, directory } = await fixture();
    await monitor.scan();
    await monitor.store.backup();
    const before = structuredClone(monitor.state),
      backup = await readFile(join(directory, "server-state.backup.json"), "utf8");
    await expect(monitor.importData({ devices: [{ id: "bad" }] })).rejects.toThrow();
    expect(monitor.state).toEqual(before);
    expect(await readFile(join(directory, "server-state.backup.json"), "utf8")).toBe(backup);
  });
  it("retains unified MAC identities across import, restart and subsequent scans", async () => {
    const { monitor } = await fixture();
    await monitor.scan();
    const [primary, other] = monitor.state.devices;
    await monitor.unify(primary!.id, other!.id, { name: "primary" });
    const unified = monitor.state.devices.find((d) => d.id === primary!.id)!;
    expect(unified.networkEntries).toHaveLength(2);
    await monitor.importData(monitor.state);
    await monitor.scan();
    expect(monitor.state.devices.find((d) => d.id === primary!.id)!.networkEntries).toHaveLength(2);
    await monitor.separate(primary!.id);
    expect(monitor.state.devices).toHaveLength(3);
  });
  it("runs without any browser and preserves metadata, directories and positions after restart", async () => {
    const { directory, monitor } = await fixture();
    monitor.start();
    await new Promise<void>((resolve, reject) => {
      const deadline = Date.now() + 3000;
      const timer = setInterval(() => {
        if (monitor.state.lastScanAt && monitor.state.health.length) {
          clearInterval(timer);
          resolve();
        } else if (Date.now() > deadline) {
          clearInterval(timer);
          reject(new Error("Monitor did not run"));
        }
      }, 20);
    });
    await monitor.stop();
    const device = monitor.state.devices[0]!;
    await monitor.editDevice(
      device.id,
      {
        name: "Router edited",
        location: "Example room",
        person: "Example person",
        roomPosition: { room: "Example room", x: 25, y: 70 },
      },
      { name: device.name, location: null, person: null, roomPosition: null },
    );
    await monitor.scan();
    const restarted = new Monitor(new StateStore(directory), { demo: true });
    monitors.push(restarted);
    await restarted.init();
    const restored = restarted.state.devices.find((d) => d.id === device.id)!;
    expect(restored.name).toBe("Router edited");
    expect(restored.roomPosition).toEqual({ room: "Example room", x: 25, y: 70 });
    expect(restarted.state.settings.locations).toContain("Example room");
    expect(restarted.state.settings.people).toContain("Example person");
    expect(restarted.state.events.length).toBeGreaterThan(0);
    expect(restarted.state.health.length).toBeGreaterThan(0);
    expect(restarted.snapshot().server.traffic.available).toBe(false);
    await restarted.store.backup();
    expect(
      JSON.parse(await readFile(join(directory, "server-state.backup.json"), "utf8")).devices,
    ).toEqual(restarted.state.devices);
  });
  it("serializes independent edits and rejects stale concurrent changes without losing valid updates", async () => {
    const { monitor } = await fixture();
    await monitor.scan();
    const device = monitor.state.devices[0]!;
    const results = await Promise.allSettled([
      monitor.editDevice(device.id, { name: "First editor" }, { name: device.name }),
      monitor.editDevice(device.id, { name: "Stale editor" }, { name: device.name }),
      monitor.editDevice(device.id, { notes: "Independent edit" }, { notes: null }),
    ]);
    expect(results.map((r) => r.status)).toEqual(["fulfilled", "rejected", "fulfilled"]);
    expect((results[1] as PromiseRejectedResult).reason.status).toBe(409);
    expect(monitor.state.devices[0]!.name).toBe("First editor");
    expect(monitor.state.devices[0]!.notes).toBe("Independent edit");
    const stored = await monitor.store.load();
    expect(stored.devices).toEqual(monitor.state.devices);
  });
  it("keeps last known device status when scanning fails", async () => {
    const { monitor } = await fixture();
    await monitor.scan();
    const before = structuredClone(monitor.state.devices);
    monitor.options.demo = false;
    monitor.options.scan = async () => {
      throw new Error("Permission denied");
    };
    await monitor.scan();
    expect(monitor.state.devices).toEqual(before);
    expect(monitor.state.lastScanError).toContain("Permission denied");
  });
  it("refuses corrupt data without overwriting it", async () => {
    const { directory } = await fixture();
    const filename = join(directory, "server-state.json");
    await writeFile(filename, "{corrupt");
    await expect(new StateStore(directory).load()).rejects.toThrow("Se conserva el archivo");
    expect(await readFile(filename, "utf8")).toBe("{corrupt");
  });
  it("rejects invalid settings and avoids real speed tests in demo", async () => {
    const { monitor } = await fixture();
    await expect(monitor.settings({ scanIntervalSeconds: 1 })).rejects.toThrow();
    await expect(monitor.settings({ interfaceName: "not-present" })).rejects.toThrow();
    await expect(monitor.settings({ speedIntervalMinutes: 120 })).rejects.toThrow();
    await monitor.settings({ scanIntervalSeconds: 60, contractedMbps: 1000 });
    expect(monitor.state.settings.scanIntervalSeconds).toBe(60);
  });
});
describe("Authenticated HTTP API", () => {
  async function setup() {
    const { monitor, directory } = await fixture();
    await monitor.scan();
    const server = createHttpServer(monitor, {
      password: "synthetic-test-password-2026",
      staticDirectory: directory,
    });
    servers.push(server);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error();
    const base = `http://127.0.0.1:${address.port}`;
    const request = (path: string, data?: unknown, headers: Record<string, string> = {}) =>
      fetch(base + path, {
        method: data === undefined ? "GET" : "POST",
        headers: {
          ...(data === undefined ? {} : { "content-type": "application/json" }),
          ...headers,
        },
        ...(data === undefined ? {} : { body: JSON.stringify(data) }),
      });
    return { monitor, request, base };
  }
  it("persists authenticated floor plans, prevents conflicting edits and gates coverage transfers", async () => {
    const { monitor, request } = await setup();
    expect((await request("/api/coverage-payload")).status).toBe(401);
    const login = await request("/api/login", { password: "synthetic-test-password-2026" });
    const cookie = login.headers.get("set-cookie")!.split(";")[0]!;
    const { csrf } = await login.json();
    const headers = { cookie, "x-nethub-csrf": csrf };
    const plan = { version: 1, updatedAt: "2026-10-10T12:00:00.000Z", name: "Generic test", image: "data:image/png;base64,aGVsbG8=", width: 800, height: 600, positions: {}, rooms: [], measurements: [] };
    expect((await request("/api/floor-plan", { plan, expected: null }, { cookie })).status).toBe(403);
    expect((await request("/api/floor-plan", { plan, expected: null }, headers)).status).toBe(200);
    expect((await monitor.store.load()).floorPlan).toEqual(plan);
    expect((await request("/api/floor-plan", { plan, expected: null }, headers)).status).toBe(409);
    expect((await request("/api/floor-plan", { plan: { ...plan, image: "data:image/svg+xml;base64,aGVsbG8=" }, expected: plan.updatedAt }, headers)).status).toBe(400);
    const compact = await (await request(`/api/state?planVersion=${encodeURIComponent(plan.updatedAt)}`, undefined, { cookie })).json();
    expect(compact.floorPlan).toBeUndefined();
    expect(monitor.state.floorPlan).toEqual(plan);
    await monitor.store.backup();
    expect((await request("/api/floor-plan", { plan: null, expected: plan.updatedAt }, headers)).status).toBe(200);
    const copy = (await monitor.store.listBackups())[0]!;
    await monitor.importData(await monitor.store.readBackup(copy.id));
    expect(monitor.state.floorPlan).toEqual(plan);
    expect((await request("/api/coverage-payload", undefined, { cookie })).status).toBe(400);
    monitor.options.demo = false;
    const payload = await request("/api/coverage-payload", undefined, { cookie });
    expect(payload.status).toBe(200);
    expect(payload.headers.get("cache-control")).toContain("no-store");
    expect((await payload.arrayBuffer()).byteLength).toBe(4 * 1024 * 1024);
    expect((await request("/api/coverage-ping", undefined, { cookie })).status).toBe(200);
    for (let i = 0; i < 11; i++) await (await request("/api/coverage-payload", undefined, { cookie })).arrayBuffer();
    expect((await request("/api/coverage-payload", undefined, { cookie })).status).toBe(429);
  });
  it("requires authentication, CSRF and matching Origin; logout invalidates the session", async () => {
    const { monitor, request, base } = await setup();
    expect((await request("/api/state")).status).toBe(401);
    const login = await request("/api/login", { password: "synthetic-test-password-2026" });
    expect(login.status).toBe(200);
    const cookie = login.headers.get("set-cookie")!.split(";")[0]!;
    expect(login.headers.get("set-cookie")).toContain("HttpOnly");
    expect(login.headers.get("set-cookie")).toContain("SameSite=Strict");
    const { csrf } = await login.json();
    const headers = { cookie, "x-nethub-csrf": csrf };
    expect((await request("/api/state", undefined, { cookie })).status).toBe(200);
    expect((await request("/api/settings", { contractedMbps: 500 }, { cookie })).status).toBe(403);
    expect(
      (
        await request(
          "/api/settings",
          { contractedMbps: 500 },
          { ...headers, origin: "https://malicious.example" },
        )
      ).status,
    ).toBe(403);
    expect(
      (await request("/api/settings", { contractedMbps: 500 }, { ...headers, origin: base }))
        .status,
    ).toBe(200);
    expect(monitor.state.settings.contractedMbps).toBe(500);
    expect((await request("/api/backups")).status).toBe(401);
    expect((await request("/api/backup", {}, headers)).status).toBe(200);
    const copies = await (await request("/api/backups", undefined, { cookie })).json();
    expect(copies).toHaveLength(1);
    expect((await request("/api/backup-read", { id: copies[0].id }, headers)).status).toBe(200);
    expect((await request("/api/restore", { id: copies[0].id }, { cookie })).status).toBe(403);
    expect((await request("/api/restore", { id: "../server-state.json" }, headers)).status).toBe(
      400,
    );
    expect((await request("/api/restore", { id: copies[0].id }, headers)).status).toBe(200);
    expect(monitor.state.devices).toHaveLength(3);
    expect(monitor.state.settings.contractedMbps).toBe(500);
    expect((await request("/api/ping", { ip: "8.8.8.8" }, headers)).status).toBe(400);
    expect((await request("/api/speed", {}, headers)).status).toBe(400);
    const exported = await request("/api/export", undefined, { cookie });
    const payload = await exported.text();
    expect(payload).not.toContain("synthetic-test-password");
    expect(payload).not.toContain(csrf);
    expect((await request("/api/logout", {}, headers)).status).toBe(200);
    expect((await request("/api/state", undefined, { cookie })).status).toBe(401);
  });
  it("rejects malicious Host and bounds request payloads", async () => {
    const { request, base } = await setup();
    const status = await new Promise<number | undefined>((resolve, reject) => {
      const req = httpRequest(
        base + "/healthz",
        { headers: { Host: "malicious.example" } },
        (res) => {
          res.resume();
          resolve(res.statusCode);
        },
      );
      req.once("error", reject);
      req.end();
    });
    expect(status).toBe(403);
    expect((await request("/api/login", { password: "x".repeat(70000) })).status).toBe(413);
  });
  it("rate limits repeated incorrect logins", async () => {
    const { request } = await setup();
    for (let n = 0; n < 5; n++)
      expect((await request("/api/login", { password: "wrong" })).status).toBe(401);
    expect((await request("/api/login", { password: "wrong" })).status).toBe(429);
  });
});
it("never accepts a short installation password", () => {
  expect(() => new Authentication("short")).toThrow();
});
