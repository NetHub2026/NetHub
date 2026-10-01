import { formatDateTime } from "@/lib/activity";
import {
  BellRing,
  House,
  Siren,
  ShieldCheck,
  ShieldOff,
  Smartphone,
} from "lucide-react";
import type { Device } from "@/lib/devices";
import { watchedIdsOf, type AwayState } from "@/lib/away";
import { cn } from "@/lib/utils";

interface Props {
  state: AwayState;
  devices: Device[];
  autoArm: boolean;
  onToggleAutoArm: (value: boolean) => void;
  onArm: () => void;
  onDisarm: () => void;
  onToggleWatched: (id: string) => void;
  onSelectDevice: (id: string) => void;
}

const kindLabels = {
  armed: "Armado",
  disarmed: "Desarmado",
  activity: "Actividad",
} as const;

const kindClass = {
  armed: "text-brand",
  disarmed: "text-muted-foreground",
  activity: "text-destructive",
} as const;

/** Modo Ausente: alarma doméstica basada en los móviles vigilados. */
export function AwayMode({
  state,
  devices,
  autoArm,
  onToggleAutoArm,
  onArm,
  onDisarm,
  onToggleWatched,
  onSelectDevice,
}: Props) {
  const watched = watchedIdsOf(state, devices);
  const watchedSet = new Set(watched);
  const homeCount = devices.filter((d) => watchedSet.has(d.id) && d.status === "online").length;
  const candidates = devices.filter(
    (d) => d.type === "smartphone" || watchedSet.has(d.id),
  );

  return (
    <section className="space-y-6">
      <div
        className={cn(
          "rounded-2xl border bg-card p-6",
          state.armed ? "border-destructive/50" : "border-border",
        )}
      >
        <div className="flex flex-wrap items-center gap-4">
          <div
            className={cn(
              "flex size-12 shrink-0 items-center justify-center rounded-xl",
              state.armed ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground",
            )}
          >
            {state.armed ? <Siren className="size-6" /> : <ShieldCheck className="size-6" />}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              Modo Ausente
              {state.armed && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/15 px-2.5 py-0.5 text-xs font-medium text-destructive">
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex size-2 animate-ping rounded-full bg-destructive opacity-75" />
                    <span className="relative inline-flex size-2 rounded-full bg-destructive" />
                  </span>
                  Armado
                </span>
              )}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {state.armed
                ? `Armado desde ${formatDateTime(state.awaySince ?? "")}. Cualquier equipo no reconocido que aparezca dispara la alarma.`
                : autoArm
                  ? homeCount > 0
                    ? "Hay gente en casa: se armará solo cuando los móviles vigilados salgan de la red."
                    : "Cuando los móviles vigilados no estén en la red, el modo se arma solo."
                  : "Activado a mano. Se desarma solo cuando vuelva un móvil vigilado."}
            </p>
          </div>
          <button
            onClick={state.armed ? onDisarm : onArm}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90",
              state.armed
                ? "border border-border text-foreground"
                : "bg-destructive text-destructive-foreground",
            )}
          >
            {state.armed ? (
              <>
                <ShieldOff className="size-4" /> Desarmar
              </>
            ) : (
              <>
                <Siren className="size-4" /> Armar ahora
              </>
            )}
          </button>
        </div>

        <label className="mt-5 flex cursor-pointer items-start gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={autoArm}
            onClick={() => onToggleAutoArm(!autoArm)}
            className={cn(
              "mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors",
              autoArm ? "border-brand bg-brand" : "border-border bg-muted",
            )}
          >
            <span
              className={cn(
                "mx-0.5 size-3.5 rounded-full bg-background transition-transform",
                autoArm ? "translate-x-4" : "translate-x-0",
              )}
            />
          </button>
          <span className="min-w-0">
            <span className="block text-sm font-medium">
              Armar automáticamente cuando nadie esté en casa
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Si ningún móvil vigilado está conectado, NetHub se arma solo; al volver uno, se
              desarma.
            </span>
          </span>
        </label>

        <div className="mt-5">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Smartphone className="size-4 text-muted-foreground" /> Móviles que indican «hay
            alguien en casa»
          </p>
          {candidates.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Todavía no hay móviles en el inventario. Escanea la red y marca tu móvil como «De
              confianza» en su ficha.
            </p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              {candidates.map((d) => {
                const active = watchedSet.has(d.id);
                return (
                  <button
                    key={d.id}
                    onClick={() => onToggleWatched(d.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors",
                      active
                        ? "border-brand bg-brand/10 text-brand"
                        : "border-border text-muted-foreground hover:bg-accent",
                    )}
                    title={active ? "Quitar de la vigilancia" : "Vigilar este móvil"}
                  >
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        d.status === "online" ? "bg-success" : "bg-muted-foreground",
                      )}
                    />
                    {d.name}
                    {d.person && <span className="text-muted-foreground">· {d.person}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <BellRing className="size-4 text-muted-foreground" /> Historial del modo ausente
        </h2>
        {state.history.length === 0 ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <House className="size-4" /> Sin movimientos todavía. Aquí quedará cada armado,
            desarmado y actividad detectada mientras estabas fuera.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {[...state.history]
              .reverse()
              .slice(0, 12)
              .map((e, i) => (
                <li key={`${e.at}-${i}`} className="flex items-start gap-3 py-2.5 text-sm">
                  <span
                    className={cn(
                      "w-20 shrink-0 text-xs font-medium",
                      kindClass[e.kind],
                    )}
                  >
                    {kindLabels[e.kind]}
                  </span>
                  <span className="min-w-0 flex-1">{e.detail}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDateTime(e.at)}
                  </span>
                </li>
              ))}
          </ul>
        )}
      </div>
    </section>
  );
}
