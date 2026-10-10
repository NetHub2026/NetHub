import { describe, it, expect } from "vitest";
import { parseHostsJson, mergeScan } from "./scanner";
import { unifyDevices, separateDevice } from "./device-unification";

const records = () => parseHostsJson([
  { ip: "192.168.50.20", mac: "02:00:00:00:00:01", name: "Example phone", type: "smartphone" },
  { ip: "192.168.60.20", mac: "02:00:00:00:00:02", name: "Other entry", type: "smartphone" },
]);
describe("Manual device unification", () => {
  it("retains both records and identity through JSON and supports undo", () => {
    const [a, b] = records();
    const merged = unifyDevices([a!, b!], a!.id, b!.id);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.name).toBe(a!.name);
    expect(separateDevice(JSON.parse(JSON.stringify(merged)), a!.id)).toEqual([a, b]);
  });
  it("matches both MACs on subsequent scans without creating duplicates", () => {
    const [a, b] = records();
    const merged = unifyDevices([a!, b!], a!.id, b!.id);
    const rescanned = mergeScan(merged, [{ ...b!, ip: "192.168.60.21", status: "online" }]);
    expect(rescanned).toHaveLength(1);
    expect(rescanned[0]?.id).toBe(a!.id);
    expect(rescanned[0]?.ip).toBe("192.168.60.21");
    expect(rescanned[0]?.networkEntries?.find(d => d.id === a!.id)?.status).toBe("offline");
    expect(separateDevice(rescanned, a!.id)).toHaveLength(2);
  });
  it("marks the single device offline when all connections disappear", () => {
    const [a, b] = records();
    expect(mergeScan(unifyDevices(records(), a!.id, b!.id), [])[0]?.status).toBe("offline");
  });
});
