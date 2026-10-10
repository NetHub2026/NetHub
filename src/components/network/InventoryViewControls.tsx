import { SlidersHorizontal, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  inventorySortLabels,
  inventoryGroupLabels,
  type InventorySort,
  type InventoryGroup,
} from "@/lib/inventory-view";

export function InventoryViewControls({
  order,
  grouping,
  onChange,
}: {
  order: InventorySort;
  grouping: InventoryGroup;
  onChange: (patch: { inventorySort?: InventorySort; inventoryGroup?: InventoryGroup }) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-2" aria-label="Orden y agrupación del inventario">
          <SlidersHorizontal className="size-4" /> Orden y grupos <ChevronDown className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-4">
        <h3 className="text-sm font-semibold">Vista del inventario</h3>
        <label className="grid gap-2 text-sm">
          Ordenar por
          <select
            aria-label="Ordenar inventario"
            value={order}
            onChange={(e) => onChange({ inventorySort: e.target.value as InventorySort })}
            className="w-full rounded-md border border-input bg-background px-3 py-2"
          >
            {Object.entries(inventorySortLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm">
          Agrupar por
          <select
            aria-label="Agrupar inventario"
            value={grouping}
            onChange={(e) => onChange({ inventoryGroup: e.target.value as InventoryGroup })}
            className="w-full rounded-md border border-input bg-background px-3 py-2"
          >
            {Object.entries(inventoryGroupLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </PopoverContent>
    </Popover>
  );
}
