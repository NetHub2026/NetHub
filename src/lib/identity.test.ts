import { describe, expect, it } from "vitest";
import { classifyMac, deriveIdentity, identityManufacturerLabel, ieeeVendor, installRegistry } from "./identity";

installRegistry({
  names: ["Nintendo Co.,Ltd", "Intel Corporate"],
  "24": "0009BF:0;3C970E:1",
  "28": "",
  "36": "",
});
const base = { name: "", type: "other" as const, vendor: "", manualEdit: false, services: [] };

describe("Device Identity v1", () => {
  it("MAC global con OUI conocido da fabricante de adaptador probable", () => {
    const id = deriveIdentity({ ...base, mac: "00:09:BF:11:22:33" });
    expect(id.adapterVendor).toEqual({
      value: "Nintendo Co.,Ltd",
      confidence: "probable",
      source: "oui",
    });
    expect(id.type.value).toBe("console");
    expect(id.vendor).toEqual({ value: null, confidence: "unknown", source: null });
  });
  it("MAC aleatoria/local no da fabricante", () => {
    expect(classifyMac("DA:A1:19:00:00:01")).toBe("local");
    expect(ieeeVendor("DA:A1:19:00:00:01")).toBeNull();
    expect(deriveIdentity({ ...base, mac: "DA:A1:19:00:00:01" }).vendor.confidence).toBe("unknown");
  });
  it("MAC inválida", () => {
    expect(classifyMac("zz:12")).toBe("invalid");
    expect(deriveIdentity({ ...base, mac: "zz:12" }).adapterVendor.value).toBeNull();
  });
  it("Intel no implica PC", () => {
    expect(deriveIdentity({ ...base, mac: "3C:97:0E:00:00:01" }).type.value).toBeNull();
    expect(deriveIdentity({ ...base, mac: "3C:97:0E:00:00:01" }).vendor.value).toBeNull();
  });
  it("hostname informativo", () => {
    const id = deriveIdentity({ ...base, mac: "DA:A1:19:00:00:01", name: "iPhone-de-Usuario" });
    expect(id.type).toEqual({ value: "smartphone", confidence: "probable", source: "hostname" });
    expect(id.vendor.value).toBe("Apple");
  });
  it("hostname genérico no aporta", () => {
    expect(
      deriveIdentity({ ...base, mac: "DA:A1:19:00:00:01", name: "Dispositivo 42" }).type.confidence,
    ).toBe("unknown");
  });
  it("lo manual prevalece", () => {
    const id = deriveIdentity({
      ...base,
      mac: "00:09:BF:11:22:33",
      name: "iPhone",
      type: "tv",
      vendor: "LG",
      manualEdit: true,
      identityManual: { type: true, vendor: true },
    });
    expect(id.type).toEqual({ value: "tv", confidence: "confirmed", source: "manual" });
    expect(id.vendor).toEqual({ value: "LG", confidence: "confirmed", source: "manual" });
    const nameOnly = deriveIdentity({
      ...base,
      mac: "00:09:BF:11:22:33",
      name: "Salón",
      type: "tv",
      vendor: "LG",
      manualEdit: true,
    });
    expect(nameOnly.type).toEqual({ value: "tv", confidence: "unknown", source: "legacy" });
    expect(nameOnly.vendor.value).toBeNull();
    const typeOnly = deriveIdentity({
      ...base,
      mac: "00:09:BF:11:22:33",
      type: "tv",
      vendor: "LG",
      identityManual: { type: true },
    });
    expect(typeOnly.vendor.value).toBeNull();
  });
  it("registro antiguo sin campos nuevos funciona", () => {
    const old = {
      name: "iPhone",
      type: "tv" as const,
      mac: "00:09:BF:00:00:01",
      vendor: "Fabricante desconocido",
    };
    expect(deriveIdentity(old).type).toEqual({
      value: "smartphone",
      confidence: "probable",
      source: "hostname",
    });
    expect(old.type).toBe("tv");
  });
  it("revalida un tipo antiguo con evidencia OUI y distingue el adaptador", () => {
    const id = deriveIdentity({ ...base, type: "iot", mac: "00:09:BF:11:22:33" });
    expect(id.type).toEqual({ value: "console", confidence: "probable", source: "oui" });
    expect(identityManufacturerLabel(id)).toBe("Adaptador: Nintendo Co.,Ltd");
    expect(id.vendor.value).toBeNull();
  });
  it("conserva un tipo antiguo cuando no hay pruebas suficientes", () => {
    const id = deriveIdentity({ ...base, type: "router", mac: "3C:97:0E:11:22:33" });
    expect(id.type).toEqual({ value: "router", confidence: "unknown", source: "legacy" });
  });
  it("revalida sin atribuir una edición manual al tipo", () => {
    const id = deriveIdentity({ ...base, type: "console", manualEdit: true, mac: "00:09:BF:11:22:33" });
    expect(id.type.confidence).toBe("probable");
    expect(id.type.source).toBe("oui");
  });
});
