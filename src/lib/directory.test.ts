import { describe, expect, it } from "vitest";
import { changeDirectoryEntry, directoryFromDevices, emptyDirectory } from "./directory";
import type { Device } from "./devices";

const device: Device = {
  id: "example",
  name: "Equipo de prueba",
  type: "pc",
  ip: "192.0.2.1",
  mac: "02:00:00:00:00:01",
  status: "offline",
  vendor: "",
  lastSeen: "",
  downstream: 0,
  upstream: 0,
  tags: [],
  person: "Persona A",
  location: "Sala A",
};

describe("Gestión de personas y ubicaciones", () => {
  it("renombra las asignaciones antiguas aunque no estén en el directorio", () => {
    const result = changeDirectoryEntry(
      [device],
      emptyDirectory,
      "people",
      "Persona A",
      " Persona B ",
    );
    expect(result.directory.people).toEqual(["Persona B"]);
    expect(result.devices[0]?.person).toBe("Persona B");
    expect(result.devices[0]?.location).toBe("Sala A");
    expect(device.person).toBe("Persona A");
  });
  it("elimina una ubicación sin borrar dispositivos y sin que reaparezca en las opciones", () => {
    const result = changeDirectoryEntry(
      [device, { ...device, id: "other", location: "Otra sala" }],
      emptyDirectory,
      "locations",
      "sala a",
      "",
    );
    expect(result.devices).toHaveLength(2);
    expect(result.devices[0]?.location).toBeUndefined();
    expect(result.devices[0]?.person).toBe("Persona A");
    expect(directoryFromDevices(result.devices, result.directory).locations).toEqual(["Otra sala"]);
  });
  it("rechaza duplicados ignorando mayúsculas y admite cambiar solo las mayúsculas", () => {
    expect(() =>
      changeDirectoryEntry(
        [device],
        { people: ["Persona B"], locations: [] },
        "people",
        "Persona A",
        "persona b",
      ),
    ).toThrow();
    expect(
      changeDirectoryEntry([device], emptyDirectory, "people", "Persona A", "PERSONA A").devices[0]
        ?.person,
    ).toBe("PERSONA A");
  });
});
