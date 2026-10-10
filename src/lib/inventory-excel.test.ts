import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { createInventoryWorkbook } from "./inventory-excel";
import type { Device } from "./devices";

describe("formatted inventory export", () => {
  it("roundtrips selected records without converting user text into formulas", async () => {
    const device: Device = {
      id: "example",
      name: '=HYPERLINK("https://example.org")',
      type: "other",
      ip: "192.168.50.10",
      mac: "02:00:00:00:00:10",
      vendor: "Example adapter",
      status: "online",
      tags: ["Wi-Fi 5GHz"],
      connectionSource: "manual",
      notes: "First line\nSecond line",
      lastSeen: "Ahora",
      downstream: 0,
      upstream: 0,
    };
    const original = await createInventoryWorkbook([device]);
    const loaded = new ExcelJS.Workbook();
    await loaded.xlsx.load(await original.xlsx.writeBuffer());
    const inventory = loaded.getWorksheet("Inventario")!;
    expect(inventory.getCell("A5").value).toBe(device.name);
    expect(inventory.getCell("F5").value).toBe("");
    expect(inventory.getCell("G5").value).toBe(device.vendor);
    expect(inventory.getCell("I5").value).toBe("5 GHz");
    expect(inventory.getCell("N5").value).toBe(device.notes);
    expect(inventory.rowCount).toBe(5);
    expect(inventory.views[0]?.state).toBe("frozen");
    expect(inventory.getTable("InventarioNetHub")).toBeTruthy();
    expect(loaded.getWorksheet("Resumen")!.getCell("C7").value).toBe(1);
  });
  it("exports a valid empty selection with zero summary and headers", async () => {
    const workbook = await createInventoryWorkbook([]);
    expect(workbook.getWorksheet("Resumen")!.getCell("C7").value).toBe(0);
    expect(workbook.getWorksheet("Inventario")!.getCell("A4").value).toBe("Nombre");
    expect((await workbook.xlsx.writeBuffer()).byteLength).toBeGreaterThan(0);
  });
});
