import { useState } from "react";
import { ChevronDown, Check, Search, ListFilter } from "lucide-react";
import { deviceTypeLabels, type DeviceType } from "@/lib/devices";
import { searchDeviceTypes } from "@/lib/device-catalog";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { DeviceTypeIcon } from "./DeviceTypeIcon";

export function DeviceTypePicker({
  value,
  onChange,
  multiple = false,
}: {
  value: DeviceType[];
  onChange: (value: DeviceType[]) => void;
  multiple?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const label =
    value.length === 0
      ? "Todos los tipos"
      : value.length === 1
        ? deviceTypeLabels[value[0]!]
        : `${value.length} tipos seleccionados`;
  const groups = searchDeviceTypes(query);
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="max-w-full gap-2"
          aria-label={`${multiple ? "Filtrar por tipo" : "Tipo de dispositivo"}: ${label}`}
        >
          {multiple ? (
            <ListFilter className="size-4 shrink-0" />
          ) : (
            <DeviceTypeIcon type={value[0] ?? "other"} />
          )}
          <span className="truncate">{label}</span>
          <ChevronDown className="size-4 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align={multiple ? "end" : "start"}
        className="w-80 max-w-[calc(100vw-2rem)] p-3"
      >
        <p className="mb-2 text-sm font-medium">
          {multiple ? "Selecciona uno o varios tipos" : "Selecciona el tipo de dispositivo"}
        </p>
        <div className="relative mb-2">
          <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
          <input
            aria-label="Buscar tipos de dispositivo"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar tipos…"
            className="w-full rounded-md border border-input bg-background py-2 pl-8 pr-2 text-sm"
          />
        </div>
        {multiple && (
          <Button
            type="button"
            variant="ghost"
            className="mb-2 w-full justify-start gap-2"
            onClick={() => {
              onChange([]);
              setQuery("");
            }}
          >
            <Check className={`size-4 ${value.length ? "invisible" : ""}`} />
            Todos los tipos
          </Button>
        )}
        <div className="max-h-[min(22rem,50dvh)] overflow-y-auto overscroll-contain">
          {groups.length === 0 && (
            <p className="p-2 text-sm text-muted-foreground">No hay tipos que coincidan.</p>
          )}
          {groups.map((group) => (
            <fieldset key={group.label} className="mb-3">
              <legend className="mb-1 text-xs font-semibold text-muted-foreground">
                {group.label}
              </legend>
              {group.types.map((type) =>
                multiple ? (
                  <label
                    key={type}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent"
                  >
                    <input
                      type="checkbox"
                      checked={value.includes(type)}
                      onChange={(event) =>
                        onChange(
                          event.target.checked
                            ? [...value, type]
                            : value.filter((entry) => entry !== type),
                        )
                      }
                      className="accent-brand"
                    />
                    <DeviceTypeIcon type={type} />
                    <span>{deviceTypeLabels[type]}</span>
                  </label>
                ) : (
                  <button
                    type="button"
                    key={type}
                    aria-pressed={value.includes(type)}
                    onClick={() => {
                      onChange([type]);
                      setOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-accent"
                  >
                    <Check className={`size-4 ${value.includes(type) ? "" : "invisible"}`} />
                    <DeviceTypeIcon type={type} />
                    <span>{deviceTypeLabels[type]}</span>
                  </button>
                ),
              )}
            </fieldset>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
