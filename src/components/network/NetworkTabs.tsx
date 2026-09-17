import { Network, Router } from "lucide-react";
import { ALL_NETWORKS, UNKNOWN_NETWORK, type NetworkDef } from "@/lib/networks";
import { cn } from "@/lib/utils";

interface NetworkTabsProps {
  value: string;
  counts: Record<string, number>;
  networks: NetworkDef[];
  onChange: (value: string) => void;
}

export function NetworkTabs({ value, counts, networks, onChange }: NetworkTabsProps) {
  const tabs: NetworkDef[] = [
    { id: ALL_NETWORKS, name: "Todas las redes", hint: "inventario completo" },
    ...networks,
    { id: UNKNOWN_NETWORK, name: "Sin clasificar", hint: "IP no reconocida" },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const count = counts[tab.id] ?? 0;
        if (tab.id === UNKNOWN_NETWORK && count === 0) return null;
        const active = value === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              "flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-left transition-colors",
              active
                ? "border-brand bg-brand/10"
                : "border-border hover:bg-accent hover:text-foreground",
            )}
          >
            {tab.id === ALL_NETWORKS ? (
              <Network className={cn("size-4", active ? "text-brand" : "text-muted-foreground")} />
            ) : (
              <Router className={cn("size-4", active ? "text-brand" : "text-muted-foreground")} />
            )}
            <span>
              <span
                className={cn(
                  "block text-sm font-medium",
                  active ? "text-brand" : "text-foreground",
                )}
              >
                {tab.name}
              </span>
              <span className="block text-[11px] text-muted-foreground">
                {count} equipo{count === 1 ? "" : "s"} · {tab.hint}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
