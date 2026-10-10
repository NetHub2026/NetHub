import { Cable, Wifi, WifiOff, Activity, CircleHelp, Waypoints, Users, MapPin } from "lucide-react";
import type { Device } from "@/lib/devices";
import { connectionSummary } from "@/lib/connections";
export function InventorySummary({ devices, networks }: { devices: Device[]; networks: number }) {
  const summary = connectionSummary(devices);
  const cards = [
    { label: "Activos", value: summary.active, hint: `de ${devices.length} conocidos`, Icon: Activity },
    { label: "Inactivos", value: summary.inactive, hint: "sin conexión reciente", Icon: WifiOff },
    { label: "Por cable", value: summary.wired, hint: "equipos activos", Icon: Cable },
    { label: "Por Wi-Fi", value: summary.wifi, hint: `2,4: ${summary.bands["2.4"]} · 5: ${summary.bands["5"]} · 6: ${summary.bands["6"]} GHz`, Icon: Wifi },
    { label: "Sin identificar", value: summary.unknown, hint: "conexión desconocida", Icon: CircleHelp },
    { label: "Redes", value: networks, hint: "detectadas en el inventario", Icon: Waypoints },
    { label: "Sin persona", value: devices.filter(d => !d.person?.trim()).length, hint: "pendientes de asignar", Icon: Users },
    { label: "Sin ubicación", value: devices.filter(d => !d.location?.trim()).length, hint: "pendientes de asignar", Icon: MapPin },
  ];
  return (
    <section aria-label="Resumen del inventario">
      <div className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-xl border border-border bg-card p-3 sm:grid-cols-4 lg:grid-cols-8">
        {cards.map(({ label, value, hint, Icon }) => (
          <div key={label} className="min-w-0 px-1" title={hint}>
            <div className="flex items-center justify-between gap-1.5">
              <p className="truncate text-[11px] text-muted-foreground">{label}</p>
              <Icon className="size-3.5 shrink-0 text-brand" />
            </div>
            <p className="mt-1 text-xl font-semibold leading-6">{value}</p>

          </div>
        ))}
      </div>
    </section>
  );
}
