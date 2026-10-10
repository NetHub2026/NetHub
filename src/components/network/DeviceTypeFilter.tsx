import { ChevronDown, ListFilter } from "lucide-react";
import { deviceTypeLabels, type DeviceType } from "@/lib/devices";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { DeviceTypeIcon } from "./DeviceTypeIcon";

export function DeviceTypeFilter({
  value,
  onChange,
}: {
  value: DeviceType[];
  onChange: (value: DeviceType[]) => void;
}) {
  const types = Object.keys(deviceTypeLabels) as DeviceType[];
  const all = value.length === 0;
  const label = all
    ? "Todos los tipos"
    : value.length === 1
      ? deviceTypeLabels[value[0]!]
      : `${value.length} tipos seleccionados`;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2" aria-label={`Filtrar por tipo: ${label}`}>
          <ListFilter className="size-4" />
          {label}
          <ChevronDown className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[min(28rem,70dvh)] w-72 overflow-y-auto">
        <DropdownMenuLabel>Selecciona uno o varios tipos</DropdownMenuLabel>
        <DropdownMenuCheckboxItem
          checked={all}
          onSelect={(event) => event.preventDefault()}
          onCheckedChange={() => onChange([])}
        >
          Todos los tipos
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        {types.map((type) => (
          <DropdownMenuCheckboxItem
            key={type}
            checked={value.includes(type)}
            onSelect={(event) => event.preventDefault()}
            onCheckedChange={(checked) =>
              onChange(checked ? [...value, type] : value.filter((entry) => entry !== type))
            }
          >
            <DeviceTypeIcon type={type} className="mr-2 size-4" />
            {deviceTypeLabels[type]}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
