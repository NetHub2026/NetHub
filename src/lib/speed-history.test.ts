import { beforeEach, describe, expect, it, vi } from "vitest";
import { sanitizeSpeedHistory } from "./speed-history";
const store = vi.hoisted(() => ({ disk: {} as Record<string, unknown>, writable: true }));
vi.mock("./desktop", () => ({
  isDesktop: () => true,
  readDbFile: async () => structuredClone(store.disk),
  writeDbFile: async (payload: Record<string, unknown>) => {
    if (!store.writable) return false;
    store.disk = structuredClone(payload); return true;
  },
}));
const sample = (index: number) => ({ at: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(), ping: 10, jitter: 2, download: 700, upload: 650, peakDownload: 710, peakUpload: 670 });
let local: Map<string, string>;
beforeEach(() => {
  vi.resetModules();
  store.disk = { devices: [], people: [], locations: [] }; store.writable = true;
  local = new Map();
  vi.stubGlobal("window", { localStorage: { getItem: (key: string) => local.get(key) ?? null, setItem: (key: string, value: string) => local.set(key, value), removeItem: (key: string) => local.delete(key) }, dispatchEvent: vi.fn() });
});
describe("Historial de velocidad en JSON", () => {
  it("migra la copia anterior antes de un guardado del inventario y la recupera tras reiniciar", async () => {
    local.set("nethub.speedtest.v1", JSON.stringify([sample(1)]));
    let api = await import("./persistence");
    await api.saveDevicesAnywhere([]);
    expect(store.disk["speedHistory"]).toEqual([sample(1)]);
    local.clear(); vi.resetModules(); api = await import("./persistence");
    expect((await api.loadSpeedHistoryAnywhere()).history).toEqual([sample(1)]);
  });
  it("conserva 100 resultados aunque se elija ver 10 y recupera la preferencia desde el JSON", async () => {
    let api = await import("./persistence");
    await api.saveSpeedHistoryAnywhere(Array.from({ length: 105 }, (_, i) => sample(i)));
    await api.saveSpeedHistoryLimitAnywhere(25);
    await api.saveDevicesAnywhere([]);
    expect((store.disk["speedHistory"] as unknown[]).length).toBe(100);
    local.clear(); vi.resetModules(); api = await import("./persistence");
    expect(await api.loadSpeedHistoryAnywhere()).toMatchObject({ limit: 25, history: expect.arrayContaining([sample(104)]) });
    await api.saveSpeedHistoryLimitAnywhere(10);
    expect((await api.loadSpeedHistoryAnywhere()).history).toHaveLength(100);
  });
  it("no pierde resultados con dos guardados simultáneos", async () => {
    const api = await import("./persistence");
    await Promise.all([api.appendSpeedHistoryAnywhere(sample(1)), api.appendSpeedHistoryAnywhere(sample(2))]);
    expect(store.disk["speedHistory"]).toEqual([sample(2), sample(1)]);
  });
  it("un historial vacío del JSON no resucita resultados borrados de la copia local", async () => {
    store.disk["speedHistory"] = [];
    local.set("nethub.speedtest.v1", JSON.stringify([sample(1)]));
    const api = await import("./persistence");
    expect((await api.loadSpeedHistoryAnywhere()).history).toEqual([]);
  });
  it("avisa si falla el archivo y mantiene una copia local del resultado", async () => {
    store.writable = false;
    const api = await import("./persistence");
    await api.appendSpeedHistoryAnywhere(sample(1));
    expect((await api.loadSpeedHistoryAnywhere()).error).toContain("no se pudo guardar en el JSON");
    expect(JSON.parse(local.get("nethub.speedtest.v1")!)).toEqual([sample(1)]);
  });
  it("tolera resultados antiguos sin picos y descarta datos corruptos", () => {
    const { peakDownload, peakUpload, ...legacy } = sample(1);
    expect(sanitizeSpeedHistory([null, { ...sample(2), download: -1 }, legacy, legacy])).toEqual([{ ...legacy, peakDownload: legacy.download, peakUpload: legacy.upload }]);
  });
});
