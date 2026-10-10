import { useState } from "react";
import { Download, Loader2, RefreshCw, X, CheckCircle2, AlertTriangle } from "lucide-react";
import {
  APP_VERSION,
  checkUpdate,
  installUpdate,
  type UpdateInfo,
} from "@/lib/desktop";

interface Props {
  open: boolean;
  onClose: () => void;
}

/** Comprobación e instalación de nuevas versiones publicadas en GitHub. */
export function UpdateModal({ open, onClose }: Props) {
  const [checking, setChecking] = useState(false);
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [percent, setPercent] = useState<number | null>(null);
  const [restarting, setRestarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const check = async () => {
    setChecking(true);
    setError(null);
    const result = await checkUpdate();
    setInfo(result);
    if (!result.ok && result.error) setError(result.error);
    setChecking(false);
  };

  const install = async () => {
    setError(null);
    setPercent(0);
    const result = await installUpdate((p) => setPercent(p.percent));
    if (result.ok) {
      setRestarting(true);
      return;
    }
    setPercent(null);
    setError(result.error || "No se ha podido instalar la actualización.");
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="max-h-[calc(100dvh-2rem)] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-xl">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex-1">
            <h2 className="text-base font-semibold">Actualizaciones de NetHub</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Versión instalada: <span className="font-mono text-foreground">v{APP_VERSION}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-md border border-border p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {restarting ? (
          <p className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm">
            <Loader2 className="size-4 animate-spin" />
            Reiniciando para aplicar la nueva versión…
          </p>
        ) : (
          <div className="space-y-4">
            <button
              onClick={check}
              disabled={checking}
              className="inline-flex items-center gap-2 rounded-md bg-brand px-3.5 py-2 text-sm font-medium text-brand-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {checking ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              {checking ? "Comprobando…" : "Buscar actualizaciones"}
            </button>

            {info?.ok && !info.available && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="size-4 text-emerald-500" />
                Tu versión está al día (v{info.currentVersion}).
              </p>
            )}

            {info?.available && (
              <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
                <p className="text-sm font-medium">
                  Nueva versión disponible: v{info.latestVersion}
                  {info.size > 0 && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {(info.size / 1024 / 1024).toFixed(1)} MB
                    </span>
                  )}
                </p>
                {info.notes && (
                  <pre className="max-h-[45dvh] overflow-y-auto whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
                    {info.notes}
                  </pre>
                )}
                {percent === null ? (
                  <button
                    onClick={install}
                    className="inline-flex items-center gap-2 rounded-md bg-brand px-3.5 py-2 text-sm font-medium text-brand-foreground transition-opacity hover:opacity-90"
                  >
                    <Download className="size-4" />
                    Actualizar ahora
                  </button>
                ) : (
                  <div className="space-y-1.5">
                    <div className="h-2 overflow-hidden rounded-full bg-border">
                      <div
                        className="h-full rounded-full bg-brand transition-all"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Descargando… {percent}%</p>
                  </div>
                )}
              </div>
            )}

            {error && (
              <p className="flex items-start gap-2 text-sm text-amber-600 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                {error}
              </p>
            )}
          </div>
        )}

        <p className="mt-5 border-t border-border pt-3 text-xs text-muted-foreground">
          ¿Dudas, avisos o permisos de uso?{" "}
          <a
            href="mailto:nethub2026@outlook.es"
            className="text-brand underline-offset-2 hover:underline"
          >
            nethub2026@outlook.es
          </a>
        </p>
      </div>
    </div>
  );
}
