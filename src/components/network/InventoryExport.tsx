import { useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import type { Device } from "@/lib/devices";
import { exportInventoryCsv } from "@/lib/backup";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

export function InventoryExport({ devices }: { devices: Device[] }) {
  const [busy, setBusy] = useState(false);
  async function excel() {
    setBusy(true);
    try {
      const { exportInventoryExcel } = await import("@/lib/inventory-excel");
      await exportInventoryExcel(devices);
      toast.success(`Excel preparado con ${devices.length} dispositivos`);
    } catch {
      toast.error("No se ha podido crear el Excel. Puedes intentarlo de nuevo o exportar en CSV.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-accent disabled:opacity-50"
        >
          <FileSpreadsheet className="size-3.5" />
          {busy ? "Preparando Excel…" : "Exportar selección"}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => void excel()}>Excel con formato (.xlsx)</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => exportInventoryCsv(devices)}>CSV (.csv)</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
