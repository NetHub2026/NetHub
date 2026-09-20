import { useState } from "react";
import {
  Bell,
  FolderOpen,
  HardDriveDownload,
  Monitor,
  Palette,
  Radar,
  Save,
  X,
} from "lucide-react";
import {
  linkSpeedOptions,
  scanIntervalOptions,
  type Settings,
} from "@/lib/settings";
import { backupDataFile, isDesktop, openDataFolder } from "@/lib/desktop";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  settings: Settings;
  onClose: () => void;
  onChange: (patch: Partial<Settings>) => void;
}

type SectionId = "system" | "appearance" | "network" | "alerts" | "data";

const sections: Array<{ id: SectionId; label: string; icon: React.ReactNode }> = [
  { id: "system", label: "Sistema y arranque", icon: <Monitor className="size-4" /> },
  { id: "appearance", label: "Apariencia", icon: <Palette className="size-4" /> },
  { id: "network", label: "Red y telemetría", icon: <Radar className="size-4" /> },
  { id: "alerts", label: "Alertas y monitorización", icon: <Bell className="size-4" /> },
  { id: "data", label: "Mantenimiento y datos", icon: <Save className="size-4" /> },
];

/** Panel de preferencias de NetHub, organizado por secciones. */
export function SettingsModal({ open, settings, onClose, onChange }: Props) {
  const [section, setSection] = useState<SectionId>("system");
  const [message, setMessage] = useState<string | null>(null);
  const desktop = isDesktop();

  if (!open) return null;

  const openFolder = async () => {
    const result = await openDataFolder();
    setMessage(
      result.ok
        ? `Carpeta abierta: ${result.path ?? ""}`
        : result.error || "No se ha podido abrir la carpeta.",
    );
  };

  const backup = async () => {
    const result = await backupDataFile();
    setMessage(
      result.ok
        ? `Copia de seguridad creada: ${result.path ?? ""}`
        : result.error || "No se ha podido crear la copia.",
    );
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
        <div className="flex items-start gap-3 border-b border-border px-6 py-4">
          <div className="flex-1">
            <h2 className="text-base font-semibold">Configuración de NetHub</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {desktop
                ? "Las opciones del sistema se aplican al instante en la app de escritorio."
                : "Algunas opciones del sistema solo funcionan en la app de escritorio."}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar configuración"
            className="rounded-md border border-border p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-border p-3 sm:w-60 sm:flex-col sm:border-b-0 sm:border-r">
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors",
                  section === s.id
                    ? "bg-brand/10 text-brand"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {s.icon}
                <span className="truncate">{s.label}</span>
              </button>
            ))}
          </nav>

          <div className="min-h-0 flex-1 overflow-auto p-6">
            {section === "system" && (
              <div className="space-y-5">
                <Toggle
                  label="Iniciar NetHub automáticamente con Windows"
                  hint="La app arranca minimizada en la bandeja al encender el equipo."
                  checked={settings.startWithWindows}
                  onChange={(v) => onChange({ startWithWindows: v })}
                />
                <Field
                  label="Al pulsar el botón cerrar [X]"
                  hint="Puedes mantener NetHub trabajando en segundo plano."
                >
                  <select
                    value={settings.closeAction}
                    onChange={(e) =>
                      onChange({ closeAction: e.target.value as Settings["closeAction"] })
                    }
                    className={selectClass}
                  >
                    <option value="tray" className={optionClass}>
                      Minimizar a la bandeja del sistema
                    </option>
                    <option value="quit" className={optionClass}>
                      Salir de la aplicación
                    </option>
                  </select>
                </Field>
                <Toggle
                  label="Minimizar a la bandeja de notificaciones"
                  hint="Al minimizar, la ventana desaparece de la barra de tareas."
                  checked={settings.minimizeToTray}
                  onChange={(v) => onChange({ minimizeToTray: v })}
                />
              </div>
            )}

            {section === "appearance" && (
              <div className="space-y-5">
                <Field label="Tema" hint="«Automático» sigue la preferencia de Windows.">
                  <select
                    value={settings.theme}
                    onChange={(e) => onChange({ theme: e.target.value as Settings["theme"] })}
                    className={selectClass}
                  >
                    <option value="light" className={optionClass}>
                      Claro
                    </option>
                    <option value="dark" className={optionClass}>
                      Oscuro
                    </option>
                    <option value="auto" className={optionClass}>
                      Automático (según Windows)
                    </option>
                  </select>
                </Field>
              </div>
            )}

            {section === "network" && (
              <div className="space-y-5">
                <Field
                  label="Velocidad de conexión contratada (Mbps)"
                  hint="Se usa para calcular el porcentaje de uso del enlace."
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {linkSpeedOptions.map((value) => (
                      <button
                        key={value}
                        onClick={() => onChange({ linkSpeedMbps: value })}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs transition-colors",
                          settings.linkSpeedMbps === value
                            ? "border-brand bg-brand text-brand-foreground"
                            : "border-border text-muted-foreground hover:bg-accent",
                        )}
                      >
                        {value} Mbps
                      </button>
                    ))}
                    <input
                      type="number"
                      min={1}
                      value={settings.linkSpeedMbps}
                      onChange={(e) =>
                        onChange({ linkSpeedMbps: Math.max(1, Number(e.target.value) || 1) })
                      }
                      aria-label="Velocidad contratada personalizada"
                      className="w-28 rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-brand"
                    />
                  </div>
                </Field>
                <Field label="Escaneo automático en segundo plano" hint="Mientras NetHub esté abierto.">
                  <select
                    value={settings.scanIntervalSeconds}
                    onChange={(e) => onChange({ scanIntervalSeconds: Number(e.target.value) })}
                    className={selectClass}
                  >
                    {scanIntervalOptions.map((o) => (
                      <option key={o.value} value={o.value} className={optionClass}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  label="Modo de escaneo"
                  hint="El modo profundo comprueba además los puertos y servicios habituales."
                >
                  <select
                    value={settings.scanMode}
                    onChange={(e) => onChange({ scanMode: e.target.value as Settings["scanMode"] })}
                    className={selectClass}
                  >
                    <option value="fast" className={optionClass}>
                      Rápido
                    </option>
                    <option value="deep" className={optionClass}>
                      Profundo (comprueba puertos comunes)
                    </option>
                  </select>
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Puerto Wake-on-LAN" hint="Por defecto 9.">
                    <input
                      type="number"
                      min={1}
                      value={settings.wolPort}
                      onChange={(e) => onChange({ wolPort: Math.max(1, Number(e.target.value) || 9) })}
                      className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus:border-brand"
                    />
                  </Field>
                  <Field label="Dirección de broadcast" hint="Normalmente 255.255.255.255.">
                    <input
                      value={settings.wolBroadcast}
                      onChange={(e) => onChange({ wolBroadcast: e.target.value })}
                      className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 font-mono text-sm outline-none focus:border-brand"
                    />
                  </Field>
                </div>
              </div>
            )}

            {section === "alerts" && (
              <div className="space-y-5">
                <Toggle
                  label="Avisar en Windows al detectar un dispositivo nuevo"
                  hint="Notificación nativa además del aviso dentro de la app."
                  checked={settings.notifyNewDevices}
                  onChange={(v) => onChange({ notifyNewDevices: v })}
                />
                <Toggle
                  label="Alertar si un equipo crítico (24/7) deja de responder"
                  hint="Se aplica a los dispositivos con la etiqueta «24/7» o «Crítico»."
                  checked={settings.alertCriticalOffline}
                  onChange={(v) => onChange({ alertCriticalOffline: v })}
                />
                <Toggle
                  label="No guardar dispositivos con MAC aleatoria o de invitados"
                  hint="Evita que móviles con MAC privada llenen el inventario."
                  checked={settings.skipRandomMac}
                  onChange={(v) => onChange({ skipRandomMac: v })}
                />
              </div>
            )}

            {section === "data" && (
              <div className="space-y-5">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => void openFolder()}
                    className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <FolderOpen className="size-4" />
                    Abrir carpeta de datos
                  </button>
                  <button
                    onClick={() => void backup()}
                    className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <HardDriveDownload className="size-4" />
                    Crear copia de seguridad
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  En esa carpeta se guardan el inventario (devices-db.json) y tus preferencias
                  (settings.json), junto al ejecutable de NetHub.
                </p>
                <Toggle
                  label="Comprobar actualizaciones al iniciar"
                  hint="Busca nuevas versiones publicadas al abrir NetHub."
                  checked={settings.checkUpdatesOnStart}
                  onChange={(v) => onChange({ checkUpdatesOnStart: v })}
                />
                {message && (
                  <p className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
                    {message}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const selectClass =
  "w-full rounded-md border border-input bg-popover px-2.5 py-1.5 text-sm text-popover-foreground outline-none focus:border-brand";
const optionClass = "bg-popover text-popover-foreground";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-sm font-medium">{label}</p>
      {hint && <p className="mb-2 mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      <div className={hint ? "" : "mt-2"}>{children}</div>
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors",
          checked ? "border-brand bg-brand" : "border-border bg-muted",
        )}
      >
        <span
          className={cn(
            "mx-0.5 size-3.5 rounded-full bg-background transition-transform",
            checked ? "translate-x-4" : "translate-x-0",
          )}
        />
      </button>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );
}
