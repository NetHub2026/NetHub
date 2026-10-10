import { Search, Users, MapPin } from "lucide-react";
import { DeviceTypeFilter } from "./DeviceTypeFilter";
import { InventoryViewControls } from "./InventoryViewControls";
import type { DeviceType } from "@/lib/devices";
import type { InventorySort, InventoryGroup } from "@/lib/inventory-view";
export function InventoryToolbar({
  count,
  query,
  onQuery,
  types,
  onTypes,
  order,
  grouping,
  onViewChange,
  person,
  onPerson,
  location,
  onLocation,
  status,
  onStatus,
  people,
  locations,
}: {
  count: number;
  query: string;
  onQuery: (q: string) => void;
  types: DeviceType[];
  onTypes: (types: DeviceType[]) => void;
  order: InventorySort;
  grouping: InventoryGroup;
  onViewChange: (patch: { inventorySort?: InventorySort; inventoryGroup?: InventoryGroup }) => void;
  person: string;
  onPerson: (s: string) => void;
  location: string;
  onLocation: (s: string) => void;
  status: "all" | "online" | "offline";
  onStatus: (s: "all" | "online" | "offline") => void;
  people: string[];
  locations: string[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <h2 className="mr-auto text-base font-semibold">
        Dispositivos <span className="text-muted-foreground">({count})</span>
      </h2>
      <label className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Buscar nombre, IP, MAC…"
          className="w-56 rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-brand"
        />
      </label>
      <DeviceTypeFilter value={types} onChange={onTypes} />
      <InventoryViewControls order={order} grouping={grouping} onChange={onViewChange} />

      <span className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm focus-within:border-brand">
        <Users className="size-4 shrink-0 text-muted-foreground" />
        <select
          value={person}
          onChange={(e) => onPerson(e.target.value)}
          aria-label="Filtrar por persona"
          className="bg-popover text-sm text-popover-foreground outline-none"
        >
          <option value="all" className="bg-popover text-popover-foreground">
            Todas las personas
          </option>
          {people.map((name) => (
            <option key={name} value={name} className="bg-popover text-popover-foreground">
              {name}
            </option>
          ))}
          <option value="" className="bg-popover text-popover-foreground">
            Sin persona
          </option>
        </select>
      </span>
      <span className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm focus-within:border-brand">
        <MapPin className="size-4 shrink-0 text-muted-foreground" />
        <select
          value={location}
          onChange={(e) => onLocation(e.target.value)}
          aria-label="Filtrar por ubicación"
          className="bg-popover text-sm text-popover-foreground outline-none"
        >
          <option value="all" className="bg-popover text-popover-foreground">
            Todas las ubicaciones
          </option>
          {locations.map((name) => (
            <option key={name} value={name} className="bg-popover text-popover-foreground">
              {name}
            </option>
          ))}
          <option value="" className="bg-popover text-popover-foreground">
            Sin ubicación
          </option>
        </select>
      </span>
      <label className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm">
        <span className="text-muted-foreground">Estado</span>
        <select
          value={status}
          onChange={(e) => onStatus(e.target.value as typeof status)}
          aria-label="Filtrar por estado"
          className="bg-popover text-popover-foreground outline-none"
        >
          <option value="all">Todos</option>
          <option value="online">Activos</option>
          <option value="offline">Inactivos</option>
        </select>
      </label>
    </div>
  );
}
