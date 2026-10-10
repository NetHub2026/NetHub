import { describe, expect, it } from "vitest";
import { installRegistry } from "./identity";
import { lookupOui, resolveVendor } from "./oui";
import { enrichDevicesWithResolvedVendors, mergeScan, parseHostsJson } from "./scanner";

// Direcciones de prueba; el catálogo reducido fuerza un conflicto entre fuentes.
installRegistry({ names: ["Sercomm Corporation"], "24": "00BB3A:0", "28": "", "36": "" });
const device = () => parseHostsJson([
  { ip: "192.0.2.21", mac: "00:BB:3A:11:22:33", name: "Amazon 21", vendor: "Amazon", type: "router" },
])[0]!;

describe("Actualización de identidad automática", () => {
  it("prioriza IEEE sobre la tabla antigua aunque esta tenga una marca conocida", async () => {
    expect(lookupOui(device().mac).vendor).toBe("Sercomm Corporation");
    expect((await resolveVendor(device().mac)).vendor).toBe("Sercomm Corporation");
  });

  it("corrige el nombre automático y lo actualiza en un inventario existente", async () => {
    const old = device();
    const fresh = (await enrichDevicesWithResolvedVendors([old]))[0]!;
    expect(fresh.name).toBe("Sercomm Corporation 21");
    expect(mergeScan([old], [fresh])[0]!.name).toBe(fresh.name);
    expect(fresh.type).toBe("router");
  });

  it("conserva nombre y fabricante editados a mano", async () => {
    const old = { ...device(), manualEdit: true };
    expect((await enrichDevicesWithResolvedVendors([old]))[0]).toEqual(old);
    expect(mergeScan([old], [{ ...device(), name: "Sercomm Corporation 21" }])[0]!.name).toBe(old.name);
  });

  it("conserva un hostname real y las notas del inventario", async () => {
    const old = { ...device(), name: "router-estudio", notes: "Nota de prueba" };
    const fresh = (await enrichDevicesWithResolvedVendors([old]))[0]!;
    expect(fresh.name).toBe(old.name);
    expect(mergeScan([old], [fresh])[0]!.notes).toBe(old.notes);
  });

  it("no usa OUI para atribuir fabricante a una MAC privada", () => {
    expect(lookupOui("02:BB:3A:11:22:33").brand).toBe("unknown");
  });
  it("actualiza un tipo automático antiguo en el inventario", async () => {
    const old = { ...device(), type: "iot" as const };
    const fresh = (await enrichDevicesWithResolvedVendors([old]))[0]!;
    expect(fresh.type).toBe("router");
    expect(mergeScan([old], [fresh])[0]!.type).toBe("router");
  });
  it("no sustituye el tipo conocido por un escaneo sin pistas", () => {
    const old = { ...device(), type: "tv" as const };
    const fresh = { ...old, name: "Dispositivo 21", mac: "02:00:00:00:00:01", type: "other" as const };
    expect(mergeScan([old], [fresh])[0]!.type).toBe("tv");
  });
});
