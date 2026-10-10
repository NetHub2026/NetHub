import type { ReactNode } from "react";
import { RefreshCw, Radar, Loader2, Settings, Sun, Moon } from "lucide-react";
import type { ScannerStatus } from "@/lib/scanner";
import { cn } from "@/lib/utils";
export function DashboardHeader({
  version,
  status,
  scanning,
  dark,
  onUpdates,
  onScan,
  onSettings,
  onTheme,
  extra,
}: {
  version: string;
  status: ScannerStatus;
  scanning: boolean;
  dark: boolean;
  onUpdates: () => void;
  onScan: () => void;
  onSettings: () => void;
  onTheme: () => void;
  extra?: ReactNode;
}) {
  const labels = {
    unknown: "Escáner sin comprobar",
    checking: "Comprobando…",
    connected: "Conectado",
    disconnected: "Desconectado",
  };
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-[1720px] flex-wrap items-center gap-2 px-5 py-4 sm:gap-4 xl:px-8">
        <img
          src="/app-icon.png"
          alt="NetHub"
          width={36}
          height={36}
          className="size-9 rounded-lg"
        />
        <div className="min-w-0 flex-1 basis-1/2 sm:basis-auto">
          <h1 className="text-lg font-semibold leading-none">NetHub</h1>
          <p className="mt-1 text-xs text-muted-foreground">v{version}</p>
        </div>
        <span
          className={cn(
            "hidden items-center gap-2 rounded-full px-3 py-1 text-xs font-medium md:inline-flex",
            status === "connected"
              ? "bg-success/15 text-success"
              : status === "disconnected"
                ? "bg-destructive/15 text-destructive"
                : "bg-muted text-muted-foreground",
          )}
        >
          <span className="size-1.5 rounded-full bg-current" />
          {labels[status]}
        </span>
        <button
          onClick={onUpdates}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <RefreshCw className="size-4" />
          Actualizaciones
        </button>
        <button
          onClick={onScan}
          disabled={scanning || status === "disconnected"}
          className="inline-flex h-9 min-w-36 items-center justify-center gap-2 rounded-md bg-brand px-3.5 py-2 text-sm font-medium text-brand-foreground hover:opacity-90 disabled:opacity-60"
        >
          {scanning ? <Loader2 className="size-4 animate-spin" /> : <Radar className="size-4" />}
          {scanning ? "Escaneando…" : "Escanear red"}
        </button>
        <button
          onClick={onSettings}
          className="rounded-md border border-border p-2 text-muted-foreground hover:bg-accent"
          aria-label="Abrir configuración"
          title="Configuración"
        >
          <Settings className="size-4" />
        </button>
        <button
          onClick={onTheme}
          className="rounded-md border border-border p-2 text-muted-foreground hover:bg-accent"
          aria-label={dark ? "Activar modo claro" : "Activar modo oscuro"}
        >
          {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>
        {extra}
      </div>
    </header>
  );
}
