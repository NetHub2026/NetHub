import { describe, expect, it } from "vitest";
import { deviceTypeLabels, normalizeDeviceType } from "./devices";
import { deviceTypeGroups, searchDeviceTypes } from "./device-catalog";
import { deriveIdentity } from "./identity";

describe("Catálogo de dispositivos", () => {
  it("incluye robot de cocina como tipo genérico del hogar", () => {
    expect(deviceTypeGroups.find(g => g.types.includes("kitchen-robot"))?.label).toBe("Hogar y domótica");
  });
  it("incluye cada tipo una sola vez y conserva todos los valores al cargar", () => {
    const types = deviceTypeGroups.flatMap((group) => group.types);
    expect(new Set(types).size).toBe(types.length);
    expect([...types].sort()).toEqual(Object.keys(deviceTypeLabels).sort());
    for (const type of types) expect(normalizeDeviceType(type)).toBe(type);
    for (const old of ["web-server", "mail-server", "proxy-server", "file-server"])
      expect(normalizeDeviceType(old)).toBe("server");
    expect(normalizeDeviceType("voice-assistant")).toBe("speaker");
    expect(normalizeDeviceType("processing-unit")).toBe("circuit-board");
    expect(deviceTypeLabels.nas).toBe("NAS");
    expect(normalizeDeviceType("phone")).toBe("smartphone");
    expect(normalizeDeviceType("toString")).toBe("other");
  });
  it("busca por nombre sin tildes y por familia", () => {
    expect(deviceTypeGroups.find((group) => group.types.includes("clock"))?.label).toBe(
      "Audio, vídeo y entretenimiento",
    );
    expect(deviceTypeGroups.find((group) => group.types.includes("smartwatch"))?.label).toBe(
      "Ordenadores y móviles",
    );
    expect(searchDeviceTypes("ventilador").flatMap((group) => group.types)).toEqual(["smart-fan"]);
    expect(searchDeviceTypes("smartwatch").flatMap((group) => group.types)).toEqual(["smartwatch"]);
    expect(searchDeviceTypes("reloj").flatMap((group) => group.types)).toContain("clock");
    expect(searchDeviceTypes("frigorifico").flatMap((group) => group.types)).toEqual([
      "smart-fridge",
    ]);
    expect(searchDeviceTypes("servidores").flatMap((group) => group.types)).toContain("server");
    expect(searchDeviceTypes("no-existe-este-tipo")).toEqual([]);
  });
  it("conserva los tipos nuevos asignados manualmente incluso con MAC privada", () => {
    const identity = deriveIdentity({
      name: "Equipo de prueba",
      mac: "02:00:00:00:00:01",
      type: "sensor",
      vendor: "",
      identityManual: { type: true },
    });
    expect(identity.type).toEqual({ value: "sensor", confidence: "confirmed", source: "manual" });
  });
});
