import { useEffect, useLayoutEffect, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Bell,
  FolderOpen,
  HardDriveDownload,
  Monitor,
  MapPin,
  Users,
  Palette,
  Radar,
  RotateCcw,
  Save,
  TriangleAlert,
  X,
} from "lucide-react";
import {
  healthIntervalOptions,
  slaIntervalOptions,
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
  onReset: () => void;
  directoryManagers: { people: React.ReactNode; locations: React.ReactNode };
}

type SectionId = "system" | "appearance" | "network" | "alerts" | "data" | "people" | "locations";

const sections: Array<{ id: SectionId; label: string; icon: React.ReactNode }> = [
  { id: "system", label: "Sistema y arranque", icon: <Monitor className="size-4" /> },
  { id: "appearance", label: "Apariencia", icon: <Palette className="size-4" /> },
  { id: "network", label: "Red y telemetría", icon: <Radar className="size-4" /> },
  { id: "alerts", label: "Alertas y monitorización", icon: <Bell className="size-4" /> },
  { id: "people", label: "Personas", icon: <Users className="size-4" /> },
  { id: "locations", label: "Ubicaciones", icon: <MapPin className="size-4" /> },
  { id: "data", label: "Mantenimiento y datos", icon: <Save className="size-4" /> },
];

/** Panel de preferencias de NetHub, organizado por secciones. */
export function SettingsModal({ open, settings, onClose, onChange, onReset, directoryManagers }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [section, setSection] = useState<SectionId>("system");
  const [message, setMessage] = useState<string | null>(null);
  const desktop = isDesktop();

  const contentRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const confirmInputRef = useRef<HTMLInputElement>(null);
  const resetButtonRef = useRef<HTMLButtonElement>(null);

  // Radix traps focus and handles nested dialogs; fixing the body also preserves
  // the document position when the pointer is over a non-scrollable section.
  useEffect(() => {
    if (!open) {
      setConfirmOpen(false);
      setConfirmText("");
      return;
    }
    const { body, documentElement } = document;
    const x = window.scrollX;
    const y = window.scrollY;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      width: body.style.width,
      overflow: body.style.overflow,
      overscrollBehavior: documentElement.style.overscrollBehavior,
      scrollBehavior: documentElement.style.scrollBehavior,
    };
    Object.assign(body.style, {
      position: "fixed",
      top: `-${y}px`,
      left: `-${x}px`,
      width: "100%",
      overflow: "hidden",
    });
    documentElement.style.overscrollBehavior = "none";
    return () => {
      Object.assign(body.style, {
        position: previous.position,
        top: previous.top,
        left: previous.left,
        width: previous.width,
        overflow: previous.overflow,
      });
      documentElement.style.overscrollBehavior = previous.overscrollBehavior;
      documentElement.style.scrollBehavior = "auto";
      window.scrollTo(x, y);
      documentElement.style.scrollBehavior = previous.scrollBehavior;
    };
  }, [open]);

  useLayoutEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [section, open]);

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
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-background/80 overscroll-none" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-1/2 z-50 flex h-[min(640px,calc(100dvh-2rem))] w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xl outline-none"
          onOpenAutoFocus={() => {
            returnFocusRef.current =
              document.activeElement instanceof HTMLElement ? document.activeElement : null;
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocusRef.current?.focus({ preventScroll: true });
          }}
        >
          <div className="flex shrink-0 items-start gap-3 border-b border-border px-4 py-4 sm:px-6">
            <div className="flex-1">
              <DialogPrimitive.Title className="text-base font-semibold">
                Configuración de NetHub
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 text-xs text-muted-foreground">
                {desktop
                  ? "Las opciones del sistema se aplican al instante en la app de escritorio."
                  : "Algunas opciones del sistema solo funcionan en la app de escritorio."}
              </DialogPrimitive.Description>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              aria-label="Cerrar configuración"
              className="rounded-md border border-border p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="size-4" />
            </Button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
            <nav
              aria-label="Secciones de configuración"
              className="grid shrink-0 grid-cols-2 gap-1 border-b border-border p-2 sm:flex sm:w-60 sm:flex-col sm:border-b-0 sm:border-r sm:p-3"
            >
              {sections.map((s) => (
                <Button
                  variant="ghost"
                  size="sm"
                  key={s.id}
                  onClick={() => setSection(s.id)}
                  aria-current={section === s.id ? "page" : undefined}
                  className={cn(
                    "h-auto min-w-0 justify-start whitespace-normal rounded-md px-3 py-2 text-left text-xs sm:text-sm",
                    section === s.id
                      ? "bg-brand/10 text-brand"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  {s.icon}
                  <span>{s.label}</span>
                </Button>
              ))}
            </nav>

            <div
              ref={contentRef}
              role="region"
              aria-label={sections.find((s) => s.id === section)?.label}
              tabIndex={0}
              className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-none p-4 [scrollbar-gutter:stable] sm:p-6"
            >
              {section === "system" && (
                <div className="space-y-5">
                  <Toggle
                    label="Iniciar NetHub automáticamente con Windows"
                    hint="Abre NetHub al iniciar sesión en Windows."
                    checked={settings.startWithWindows}
                    onChange={(v) => onChange({ startWithWindows: v })}
                  />
                  <Toggle
                    label="Iniciar minimizado a la bandeja"
                    hint="Cuando Windows inicie NetHub, funcionará en segundo plano sin mostrar la ventana."
                    checked={settings.startMinimized}
                    onChange={(v) => onChange({ startMinimized: v })}
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
                        <Button
                          variant="ghost"
                          size="sm"
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
                        </Button>
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
                  <Field
                    label="Escaneo automático en segundo plano"
                    hint="Mientras NetHub esté abierto."
                  >
                    <select
                      aria-label="Escaneo automático en segundo plano"
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
                      onChange={(e) =>
                        onChange({ scanMode: e.target.value as Settings["scanMode"] })
                      }
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
                        onChange={(e) =>
                          onChange({ wolPort: Math.max(1, Number(e.target.value) || 9) })
                        }
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
                    label="Guardián de intrusos (Sentinel)"
                    hint="Alerta de equipos no reconocidos y conflictos de IP en cada escaneo."
                    checked={settings.intruderAlerts}
                    onChange={(v) => onChange({ intruderAlerts: v })}
                  />
                  <Toggle
                    label="Sonido en las alertas"
                    hint="Pitido corto al detectar un intruso o una alerta crítica."
                    checked={settings.alertSound}
                    onChange={(v) => onChange({ alertSound: v })}
                  />
                  <Field
                    label="Health Radar: frecuencia de la prueba de salud"
                    hint="Router local, router secundario/DNS e Internet."
                  >
                    <select
                      value={settings.healthIntervalSeconds}
                      onChange={(e) => onChange({ healthIntervalSeconds: Number(e.target.value) })}
                      className={selectClass}
                    >
                      {healthIntervalOptions.map((o) => (
                        <option key={o.value} value={o.value} className={optionClass}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field
                    label="Nombre de tu operador"
                    hint="Se usa en el diagnóstico (ej. Vodafone, Movistar, Digi)."
                  >
                    <input
                      value={settings.ispName}
                      onChange={(e) => onChange({ ispName: e.target.value })}
                      className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus:border-brand"
                    />
                  </Field>
                  <Field
                    label="Test de velocidad automático (SLA del operador)"
                    hint="Compara la velocidad real con la contratada."
                  >
                    <select
                      value={settings.slaIntervalMinutes}
                      onChange={(e) => onChange({ slaIntervalMinutes: Number(e.target.value) })}
                      className={selectClass}
                    >
                      {slaIntervalOptions.map((o) => (
                        <option key={o.value} value={o.value} className={optionClass}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Toggle
                    label="Modo ausente automático"
                    hint="Se arma solo cuando tus móviles de confianza salen de casa."
                    checked={settings.awayAutoArm}
                    onChange={(v) => onChange({ awayAutoArm: v })}
                  />
                  <Toggle
                    label="No guardar dispositivos con MAC aleatoria o de invitados"
                    hint="Evita que móviles con MAC privada llenen el inventario."
                    checked={settings.skipRandomMac}
                    onChange={(v) => onChange({ skipRandomMac: v })}
                  />
                </div>
              )}

              {section === "people" && directoryManagers.people}
              {section === "locations" && directoryManagers.locations}

              {section === "data" && (
                <div className="space-y-5">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void openFolder()}
                      className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <FolderOpen className="size-4" />
                      Abrir carpeta de datos
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void backup()}
                      className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <HardDriveDownload className="size-4" />
                      Crear copia de seguridad
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    En esa carpeta se guardan el inventario (devices-db.json) y tus preferencias
                    (settings.json), junto al ejecutable de NetHub.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ¿Avisos, dudas o permisos de uso? Escríbele a{" "}
                    <a
                      href="mailto:nethub2026@outlook.es"
                      className="text-brand underline-offset-2 hover:underline"
                    >
                      nethub2026@outlook.es
                    </a>
                    .
                  </p>
                  <Toggle
                    label="Comprobar actualizaciones al iniciar"
                    hint="Busca nuevas versiones publicadas al abrir NetHub."
                    checked={settings.checkUpdatesOnStart}
                    onChange={(v) => onChange({ checkUpdatesOnStart: v })}
                  />
                  <div className="rounded-xl border border-destructive/50 bg-destructive/5 p-4">
                    <p className="flex items-center gap-2 text-sm font-semibold text-destructive">
                      <TriangleAlert className="size-4" />
                      Zona de peligro
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Restablecer borra de forma definitiva los datos de NetHub. No se puede
                      deshacer.
                    </p>
                    <Button
                      ref={resetButtonRef}
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setConfirmText("");
                        setConfirmOpen(true);
                      }}
                      className="mt-3 inline-flex items-center gap-2 rounded-md bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground transition-opacity hover:opacity-90"
                    >
                      <RotateCcw className="size-4" />
                      Restablecer NetHub…
                    </Button>
                  </div>
                  {message && (
                    <p className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
                      {message}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
      <AlertDialogPrimitive.Root open={confirmOpen && open} onOpenChange={setConfirmOpen}>
        <AlertDialogPrimitive.Portal>
          <AlertDialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-background/80 overscroll-none" />
          <AlertDialogPrimitive.Content
            className="fixed left-1/2 top-1/2 z-[60] max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto overscroll-none rounded-lg border border-destructive/50 bg-card p-4 shadow-xl outline-none sm:p-6"
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              confirmInputRef.current?.focus();
            }}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              if (open) resetButtonRef.current?.focus({ preventScroll: true });
            }}
          >
            <AlertDialogPrimitive.Title className="flex items-center gap-2 text-base font-semibold text-destructive">
              <TriangleAlert className="size-5" />
              ¿Restablecer NetHub?
            </AlertDialogPrimitive.Title>
            <AlertDialogPrimitive.Description className="mt-3 text-sm text-muted-foreground">
              Se eliminarán definitivamente:
            </AlertDialogPrimitive.Description>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Todos los dispositivos del inventario y sus nombres, etiquetas y puertos.</li>
              <li>Las personas y ubicaciones creadas.</li>
              <li>El historial de actividad (conexiones y desconexiones).</li>
              <li>Las estadísticas de uso y los patrones aprendidos.</li>
              <li>El estado del modo ausente y el historial del SLA del operador.</li>
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              Se conservan tus preferencias de Configuración. Si quieres guardar tus datos antes,
              usa «Crear copia de seguridad».
            </p>
            <label className="mt-4 block text-sm">
              Escribe <span className="font-mono font-semibold">RESTABLECER</span> para confirmar:
              <input
                ref={confirmInputRef}
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="mt-2 w-full rounded-md border border-input bg-background px-2.5 py-1.5 font-mono text-sm outline-none focus:border-destructive"
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <AlertDialogPrimitive.Cancel asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  Cancelar
                </Button>
              </AlertDialogPrimitive.Cancel>
              <Button
                variant="ghost"
                size="sm"
                disabled={confirmText !== "RESTABLECER"}
                onClick={() => {
                  setConfirmOpen(false);
                  setConfirmText("");
                  onReset();
                }}
                className="rounded-md bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Borrar definitivamente
              </Button>
            </div>
          </AlertDialogPrimitive.Content>
        </AlertDialogPrimitive.Portal>
      </AlertDialogPrimitive.Root>
    </DialogPrimitive.Root>
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
      <Button
        variant="ghost"
        size="sm"
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "mt-0.5 flex h-5 w-9 shrink-0 justify-start rounded-full border p-0 transition-colors",
          checked ? "border-brand bg-brand" : "border-border bg-muted",
        )}
      >
        <span
          className={cn(
            "mx-0.5 size-3.5 rounded-full bg-background transition-transform",
            checked ? "translate-x-4" : "translate-x-0",
          )}
        />
      </Button>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );
}
