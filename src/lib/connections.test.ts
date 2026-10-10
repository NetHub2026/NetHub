import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { connectionOf, wifiBand, connectionSummary } from "./connections";
import { parseHostsJson, mergeScan } from "./scanner";
const require = createRequire(import.meta.url);
const { interfaceConnectionTag, wifiTagForMac } = require("../../electron/local-connection.cjs");
const fixture = () => parseHostsJson([{ ip: "192.168.50.20", mac: "02:00:00:00:00:01", type: "smartphone", name: "Example" }])[0]!;
describe("Conexión y resumen", () => {
  it("no deduce Wi-Fi por tipo ni por etiquetas antiguas", () => {
    const d = fixture(); expect(d.tags).not.toContain("Wi-Fi");
    expect(connectionOf({ tags: ["Wi-Fi"], connectionSource: undefined })).toBeNull();
    expect(wifiBand({ tags: ["Wi-Fi 6"], connectionSource: "manual" })).toBeNull();
    expect(interfaceConnectionTag("Intel adapter")).toBeNull();
  });
  it("resume activos sin sumar los inactivos a las conexiones actuales", () => {
    const d = fixture();
    expect(connectionSummary([{ ...d, tags: ["Cableado / Ethernet"], connectionSource: "local" }, { ...d, tags: ["Wi-Fi 5GHz"], connectionSource: "manual" }, { ...d, tags: ["Wi-Fi"], status: "offline" }, d])).toMatchObject({ active: 3, inactive: 1, wired: 1, wifi: 1, unknown: 1, bands: { "5": 1 } });
  });
  it("actualiza la conexión detectada y conserva la elegida manualmente", () => {
    const d = fixture(); const fresh = { ...d, tags: ["Wi-Fi 5GHz"], connectionSource: "local" as const };
    expect(mergeScan([{ ...d, tags: ["Cableado / Ethernet"] }], [fresh])[0]?.tags).toContain("Wi-Fi 5GHz");
    expect(mergeScan([{ ...d, tags: ["Cableado / Ethernet"], connectionSource: "manual" }], [fresh])[0]?.tags).toContain("Cableado / Ethernet");
  });
  it("solo usa la banda explícita de la interfaz correspondiente", () => {
    const text = "Name : Wi-Fi\nPhysical address : 02:00:00:00:00:01\nBand : 6 GHz\nChannel : 5\nRadio type : 802.11ax";
    expect(wifiTagForMac(text, "02:00:00:00:00:01")).toBe("Wi-Fi 6GHz");
    expect(wifiTagForMac(text.replace("Band : 6 GHz\n", ""), "02:00:00:00:00:01")).toBe("Wi-Fi");
    expect(wifiTagForMac(text, "02:00:00:00:00:02")).toBeNull();
  });
});
