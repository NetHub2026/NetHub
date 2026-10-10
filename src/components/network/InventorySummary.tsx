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
    <section aria-label="Resumen del inventario" className="space-y-1.5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
        {cards.map(({ label, value, hint, Icon }) => (
          <div key={label} className="min-w-0 rounded-xl border border-border bg-card px-3 py-2.5">
            <div className="flex items-center justify-between gap-1.5">
              <p className="truncate text-[11px] text-muted-foreground">{label}</p>
              <Icon className="size-3.5 shrink-0 text-brand" />
            </div>
            <p className="mt-1 text-xl font-semibold leading-6">{value}</p>
            <p title={hint} className="mt-0.5 truncate text-[10px] text-muted-foreground">{hint}</p>
          </div>
        ))}
      </div>
      <p className="text-[10px] leading-4 text-muted-foreground">
        Cable y Wi-Fi: activos con conexión detectada o indicada en su ficha. Las etiquetas antiguas sin confirmar no se cuentan.
        {summary.bandUnknown > 0 && ` ${summary.bandUnknown} por Wi-Fi sin banda identificada.`}
      </p>
    </section>
  );
}
