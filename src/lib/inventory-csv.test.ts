import { it, expect } from "vitest";
import { devicesToCsv } from "./backup";
import type { Device } from "./devices";
it("exports only the supplied selection and safely quotes spreadsheet formulas and multiline names", () => {
  const d: Device = {
    id: "sample",
    name: '=HYPERLINK("example")',
    ip: "192.168.50.2",
    mac: "02:00:00:00:00:02",
    vendor: "Example",
    type: "nas",
    status: "online",
    tags: [],
    person: "Example owner",
    location: "Room, one",
    notes: "line one\r\nline two",
    lastSeen: "",
    downstream: 0,
    upstream: 0,
  };
  const csv = devicesToCsv([d]);
  expect(csv).toContain(`"'=HYPERLINK(""example"")"`);
  expect(csv).toContain('"Room, one"');
  expect(csv).toContain('"line one\r\nline two"');
  expect(devicesToCsv([]).split("\n")).toHaveLength(1);
});
