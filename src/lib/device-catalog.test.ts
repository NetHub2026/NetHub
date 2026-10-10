import { describe, expect, it } from "vitest";
import { deviceTypeLabels, normalizeDeviceType } from "./devices";
import { deviceTypeGroups, searchDeviceTypes } from "./device-catalog";
import { deriveIdentity } from "./identity";

describe("Catálogo de dispositivos", () => {
  it("incluye cada tipo una sola vez y conserva todos los valores al cargar", () => {
    const types = deviceTypeGroups.flatMap(group => group.types);
    expect(new Set(types).size).toBe(types.length);
    expect([...types].sort()).toEqual(Object.keys(deviceTypeLabels).sort());
    for (const type of types) expect(normalizeDeviceType(type)).toBe(type);
    expect(normalizeDeviceType("phone")).toBe("smartphone");
    expect(normalizeDeviceType("toString")).toBe("other");
  });
  it("busca por nombre sin tildes y por familia", () => {
    expect(searchDeviceTypes("frigorifico").flatMap(group => group.types)).toEqual(["smart-fridge"]);
    expect(searchDeviceTypes("servidores").flatMap(group => group.types)).toContain("mail-server");
    expect(searchDeviceTypes("no-existe-este-tipo")).toEqual([]);
  });
  it("conserva los tipos nuevos asignados manualmente incluso con MAC privada", () => {
    const identity = deriveIdentity({ name: "Equipo de prueba", mac: "02:00:00:00:00:01", type: "sensor", vendor: "", identityManual: { type: true } });
    expect(identity.type).toEqual({ value: "sensor", confidence: "confirmed", source: "manual" });
  });
});
