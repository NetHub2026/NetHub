import {
  LayoutGrid,
  MapPin,
  Gauge,
  Waypoints,
  History,
  Shield,
  HeartPulse,
  House,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
export const dashboardViews = [
  ["inventory", "Inventario", LayoutGrid],
  ["floorplan", "Plano y cobertura", MapPin],
  ["performance", "Rendimiento", Gauge],
  ["topology", "Topología de red", Waypoints],
  ["activity", "Actividad", History],
  ["security", "Seguridad", Shield],
  ["health", "Health Radar", HeartPulse],
  ["home", "Mi casa", House],
  ["usage", "Uso", BarChart3],
  ["sla", "Operador", Gauge],
] as const;
export type DashboardView = (typeof dashboardViews)[number][0];
export function DashboardNavigation({
  value,
  onChange,
}: {
  value: DashboardView;
  onChange: (view: DashboardView) => void;
}) {
  return (
    <nav
      aria-label="Vista del panel"
      className="flex max-w-full flex-wrap items-center rounded-md border border-border bg-muted/40 p-0.5"
    >
      {dashboardViews.filter(([id]) => id !== "floorplan").map(([id, label, Icon]) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          aria-current={value === id || (id === "home" && value === "floorplan") ? "page" : undefined}
          className={cn(
            "inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors",
            value === id || (id === "home" && value === "floorplan")
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon className="size-3.5" />
          {label}
        </button>
      ))}
    </nav>
  );
}
