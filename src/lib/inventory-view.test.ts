import { expect, it } from "vitest";
import { arrangeInventory } from "./inventory-view";
import type { Device } from "./devices";

const device = (id: string, ip: string, extra: Partial<Device> = {}): Device => ({
  id,
  ip,
  name: id,
  type: "pc",
  mac: "",
  vendor: "",
  status: "offline",
  lastSeen: "",
  tags: [],
  downstream: 0,
  upstream: 0,
  ...extra,
});
it("orders IP addresses numerically without altering the stored inventory", () => {
  const input = [device("B", "192.0.2.10"), device("A", "192.0.2.2")];
  expect(arrangeInventory(input, "ip", "none")[0].devices.map((d) => d.id)).toEqual(["A", "B"]);
  expect(input.map((d) => d.id)).toEqual(["B", "A"]);
});
it("keeps unassigned devices in a final group and sorts within each group", () => {
  const input = [
    device("C", "192.0.2.3"),
    device("B", "192.0.2.2", { location: "Sala" }),
    device("A", "192.0.2.1", { location: "sala" }),
  ];
  const groups = arrangeInventory(input, "name", "location");
  expect(groups.map((g) => g.label)).toEqual(["sala", "Sin ubicación"]);
  expect(groups[0].devices.map((d) => d.id)).toEqual(["A", "B"]);
  expect(groups.flatMap((g) => g.devices)).toHaveLength(3);
});
it("prioritizes active devices and recent sightings", () => {
  const input = [
    device("A", "192.0.2.1", { lastOnlineAt: "2026-01-01T00:00:00Z" }),
    device("B", "192.0.2.2", { status: "online", lastOnlineAt: "2026-01-02T00:00:00Z" }),
  ];
  for (const order of ["active", "recent"] as const)
    expect(arrangeInventory(input, order, "none")[0].devices[0].id).toBe("B");
});
