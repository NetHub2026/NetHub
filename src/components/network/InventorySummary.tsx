import { Cable, Wifi, WifiOff, Activity, CircleHelp, Waypoints, Users, MapPin } from "lucide-react";
import type { Device } from "@/lib/devices";
import { connectionSummary } from "@/lib/connections";
export function InventorySummary({ devices, networks }: { devices: Device[]; networks: number }) {
  const summary = connectionSummary(devices);
  const cards = [
    { label: "Activos", value: summary.active, hint: `de ${devices.length} conocidos`, Icon: Activity },
    { label: "Inactivos", value: summary.inactive, hint: "sin conexión reciente", Icon: WifiOff },
    { label: "Por cable", value: summary.wired, hint: "activos · detectado o indicado", Icon: Cable },
    { label: "Por Wi-Fi", value: summary.wifi, hint: `2,4 GHz: ${summary.bands["2.4"]} · 5 GHz: ${summary.bands["5"]} · 6 GHz: ${summary.bands["6"]}`, Icon: Wifi },
    { label: "Sin identificar", value: summary.unknown, hint: "activos · conexión desconocida", Icon: CircleHelp },
    { label: "Redes", value: networks, hint: "detectadas en el inventario", Icon: Waypoints },
    { label: "Sin persona", value: devices.filter(d => !d.person?.trim()).length, hint: "pendientes de asignar", Icon: Users },
    { label: "Sin ubicación", value: devices.filter(d => !d.location?.trim()).length, hint: "pendientes de asignar", Icon: MapPin },
  ];
  return <section aria-label="Resumen del inventario" className="space-y-2"><div className="grid grid-cols-2 gap-3 md:grid-cols-4">{cards.map(({ label, value, hint, Icon }) => <div key={label} className="rounded-xl border border-border bg-card p-4"><div className="flex items-center justify-between gap-2"><p className="text-xs text-muted-foreground">{label}</p><Icon className="size-4 text-brand" /></div><p className="mt-2 text-2xl font-semibold">{value}</p><p className="mt-1 text-[11px] text-muted-foreground">{hint}</p></div>)}</div><p className="text-xs text-muted-foreground">Cable y Wi-Fi cuentan solo dispositivos activos con conexión detectada o indicada en su ficha. {summary.bandUnknown > 0 && `${summary.bandUnknown} por Wi-Fi sin banda identificada.`} Las etiquetas antiguas sin confirmar no se cuentan como detección.</p></section>;
}
