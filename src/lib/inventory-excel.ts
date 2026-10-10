import type { Device } from "./devices";
import { deviceTypeLabels } from "./devices";
import { connectionOf, connectionSummary, wifiBand } from "./connections";

/** Generates the same selected inventory as CSV, with presentation suited to Excel. */
export async function createInventoryWorkbook(devices: Device[], exportedAt = new Date()) {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "NetHub";
  workbook.created = exportedAt;
  const navy = "FF102334",
    cyan = "FF169CD6",
    muted = "FF526575";
  const summary = workbook.addWorksheet("Resumen", { views: [{ showGridLines: false }] });
  summary.columns = [{ width: 4 }, { width: 36 }, { width: 22 }, { width: 22 }, { width: 4 }];
  summary.mergeCells("B2:D3");
  summary.getCell("B2").value = "NetHub · Inventario de red";
  summary.getCell("B2").font = {
    name: "Calibri",
    size: 22,
    bold: true,
    color: { argb: "FFFFFFFF" },
  };
  summary.getCell("B2").fill = { type: "pattern", pattern: "solid", fgColor: { argb: navy } };
  summary.getCell("B2").alignment = { vertical: "middle", indent: 1 };
  summary.mergeCells("B5:D5");
  summary.getCell("B5").value =
    `Exportado: ${exportedAt.toLocaleString("es-ES")} · Selección actual del inventario`;
  summary.getCell("B5").font = { size: 11, color: { argb: muted } };
  const counts = connectionSummary(devices);
  const metrics: [string, number][] = [
    ["Dispositivos seleccionados", devices.length],
    ["Activos", counts.active],
    ["Inactivos", counts.inactive],
    ["Activos por cable", counts.wired],
    ["Activos por Wi-Fi", counts.wifi],
    ["Activos con conexión desconocida", counts.unknown],
    ["Sin persona asignada", devices.filter((d) => !d.person).length],
    ["Sin ubicación asignada", devices.filter((d) => !d.location).length],
  ];
  metrics.forEach(([label, value], i) => {
    const row = summary.getRow(i + 7);
    row.getCell(2).value = label;
    row.getCell(3).value = value;
    row.height = 29;
    row.getCell(2).font = { size: 12, color: { argb: navy } };
    row.getCell(3).font = { size: 16, bold: true, color: { argb: cyan } };
    for (const col of [2, 3, 4])
      row.getCell(col).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: i % 2 ? "FFFFFFFF" : "FFEAF5FB" },
      };
  });
  summary.mergeCells("B17:D18");
  summary.getCell("B17").value =
    "El informe incluye únicamente los dispositivos seleccionados por los filtros. Cable y Wi-Fi cuentan conexiones detectadas o indicadas en la ficha; una conexión desconocida no se presupone.";
  summary.getCell("B17").alignment = { wrapText: true, vertical: "middle" };
  summary.getCell("B17").font = { size: 10, color: { argb: muted } };
  summary.pageSetup = {
    paperSize: 9,
    orientation: "portrait",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 1,
    printArea: "B2:D18",
  };

  const sheet = workbook.addWorksheet("Inventario", {
    views: [{ state: "frozen", ySplit: 4, xSplit: 1, showGridLines: false }],
  });
  const headers = [
    "Nombre",
    "Tipo",
    "Estado",
    "IP",
    "MAC",
    "Marca",
    "Fabricante de red",
    "Conexión",
    "Banda Wi-Fi",
    "Red",
    "Persona",
    "Ubicación",
    "Etiquetas",
    "Notas",
    "Confiable",
    "Bloqueado",
    "Prioritario",
    "ID",
  ];
  sheet.columns = headers.map((_, i) => ({
    width: [30, 24, 14, 18, 23, 20, 30, 19, 17, 22, 22, 22, 38, 48, 14, 14, 14, 26][i] ?? 22,
  }));
  sheet.mergeCells(1, 1, 2, headers.length);
  sheet.getCell("A1").value = "NetHub · Detalle del inventario";
  sheet.getCell("A1").font = { size: 20, bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: navy } };
  sheet.getCell("A1").alignment = { vertical: "middle", indent: 1 };
  sheet.getRow(3).getCell(1).value =
    `${devices.length} dispositivos · ${exportedAt.toLocaleString("es-ES")}`;
  const rows = devices.map((d) => [
    d.name,
    deviceTypeLabels[d.type] ?? d.type,
    d.status === "online" ? "Activo" : "Inactivo",
    d.ip,
    d.mac,
    d.brand ?? "",
    d.vendor,
    connectionOf(d) === "wired" ? "Cable" : connectionOf(d) === "wifi" ? "Wi-Fi" : "Desconocida",
    wifiBand(d) ? `${wifiBand(d)} GHz` : "",
    d.networkId ?? "",
    d.person ?? "",
    d.location ?? "",
    d.tags.join(" | "),
    d.notes ?? "",
    d.trusted ? "Sí" : "No",
    d.blocked ? "Sí" : "No",
    d.prioritized ? "Sí" : "No",
    d.id,
  ]);
  if (rows.length)
    sheet.addTable({
      name: "InventarioNetHub",
      ref: "A4",
      headerRow: true,
      style: { theme: "TableStyleMedium2", showRowStripes: true },
      columns: headers.map((name) => ({ name, filterButton: true })),
      rows,
    });
  else sheet.getRow(4).values = headers;
  sheet.getRow(4).height = 28;
  sheet.getRow(4).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: navy } };
  });
  rows.forEach((_, i) => {
    const row = sheet.getRow(i + 5);
    row.height = 36;
    row.eachCell((cell) => {
      cell.font = { name: "Calibri", size: 11 };
      cell.alignment = { vertical: "middle", wrapText: true };
      cell.numFmt = "@";
    });
    row.getCell(3).font = {
      bold: true,
      color: { argb: devices[i]!.status === "online" ? "FF137A55" : muted },
    };
  });
  sheet.pageSetup = {
    paperSize: 9,
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    printTitlesRow: "1:4",
  };
  return workbook;
}

export async function exportInventoryExcel(devices: Device[]) {
  const workbook = await createInventoryWorkbook(devices);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([new Uint8Array(buffer)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `nethub-inventario-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
