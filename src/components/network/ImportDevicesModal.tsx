import { useEffect, useRef, useState } from "react";
import { DatabaseBackup, FileJson, Upload, X } from "lucide-react";
import { parseArpOutput, parseHostsJson } from "@/lib/scanner";
import { parseBackup } from "@/lib/backup";
import type { Device } from "@/lib/devices";
import { cn } from "@/lib/utils";

export type RestoreMode = "merge" | "replace";

interface ImportDevicesModalProps {
  open: boolean;
  onClose: () => void;
  onImport: (devices: Device[], source: "arp" | "json") => void;
  onRestore: (devices: Device[], mode: RestoreMode) => void;
}

export function ImportDevicesModal({
  open,
  onClose,
  onImport,
  onRestore,
}: ImportDevicesModalProps) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<RestoreMode>("merge");
  const fileRef = useRef<HTMLInputElement>(null);
  const backupRef = useRef<HTMLInputElement>(null);

  const restoreFile = async (file: File) => {
    try {
      const devices = parseBackup(await file.text(), file.name);
      if (devices.length === 0) {
        setError("La copia de seguridad no contiene dispositivos reconocibles.");
        return;
      }
      onRestore(devices, mode);
      onClose();
    } catch {
      setError("No se ha podido leer la copia de seguridad.");
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (open) {
      setText("");
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  const importArp = () => {
    const devices = parseArpOutput(text);
    if (devices.length === 0) {
      setError("No se han encontrado pares IP + MAC en el texto pegado.");
      return;
    }
    onImport(devices, "arp");
    onClose();
  };

  const importFile = async (file: File) => {
    try {
      const raw = await file.text();
      const devices = file.name.endsWith(".json")
        ? parseHostsJson(JSON.parse(raw))
        : parseArpOutput(raw);
      if (devices.length === 0) {
        setError("El archivo no contiene dispositivos reconocibles.");
        return;
      }
      onImport(devices, file.name.endsWith(".json") ? "json" : "arp");
      onClose();
    } catch {
      setError("No se ha podido leer el archivo. Comprueba que el JSON sea válido.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-8">
      <button
        aria-label="Cerrar"
        onClick={onClose}
        className="fixed inset-0 bg-background/75 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Importar dispositivos"
        className="relative w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              <Upload className="size-5 text-brand" />
              Importar dispositivos
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Alternativa manual si el agente local no está activo. La lista importada se
              guarda en este navegador y sigue disponible al volver a abrir la web.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Cerrar"
          >
            <X className="size-4" />
          </button>
        </div>

        <h3 className="mt-6 text-sm font-semibold">1 · Pegar la salida de arp -a</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          En Windows abre PowerShell o CMD, ejecuta{" "}
          <code className="font-mono">arp -a</code> y pega aquí todo el resultado.
        </p>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError(null);
          }}
          rows={8}
          spellCheck={false}
          placeholder={"Interfaz: 192.168.1.20 --- 0x5\n  192.168.1.1   02:00:00:00:00:01   dinámico"}
          className="mt-3 w-full rounded-xl border border-input bg-background p-3 font-mono text-xs outline-none focus:border-brand"
        />
        <button
          onClick={importArp}
          disabled={!text.trim()}
          className={cn(
            "mt-3 inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-opacity",
            text.trim()
              ? "bg-brand text-brand-foreground hover:opacity-90"
              : "cursor-not-allowed bg-muted text-muted-foreground",
          )}
        >
          Importar del texto
        </button>

        <h3 className="mt-8 text-sm font-semibold">2 · O subir un archivo</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Acepta JSON con{" "}
          <code className="font-mono">
            {"[{ \"ip\": \"192.168.1.20\", \"mac\": \"02:00:00:00:00:01\", \"name\": \"PC\" }]"}
          </code>{" "}
          (o un objeto con la clave <code className="font-mono">devices</code>), y también
          un .txt con la salida de arp.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".json,.txt,application/json,text/plain"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void importFile(file);
            e.target.value = "";
          }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          className="mt-3 inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm transition-colors hover:bg-accent"
        >
          <FileJson className="size-4" />
          Elegir archivo JSON o TXT
        </button>

        <h3 className="mt-8 flex items-center gap-2 text-sm font-semibold">
          <DatabaseBackup className="size-4 text-brand" />
          3 · Restaurar una copia de seguridad
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Recupera un inventario exportado desde NetHub (JSON o CSV) con sus nombres,
          marcas, redes, etiquetas y notas.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {([
            { id: "merge" as RestoreMode, label: "Fusionar con lo existente" },
            { id: "replace" as RestoreMode, label: "Reemplazar todo" },
          ]).map((option) => (
            <button
              key={option.id}
              onClick={() => setMode(option.id)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-xs transition-colors",
                mode === option.id
                  ? "border-brand bg-brand/10 text-brand"
                  : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
              aria-pressed={mode === option.id}
            >
              {option.label}
            </button>
          ))}
        </div>
        <input
          ref={backupRef}
          type="file"
          accept=".json,.csv,application/json,text/csv,text/plain"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void restoreFile(file);
            e.target.value = "";
          }}
        />
        <button
          onClick={() => backupRef.current?.click()}
          className="mt-3 inline-flex items-center gap-2 rounded-md border border-brand px-4 py-2 text-sm font-medium text-brand transition-colors hover:bg-brand/10"
        >
          <DatabaseBackup className="size-4" />
          Elegir copia de seguridad (JSON o CSV)
        </button>


        {error && (
          <p className="mt-4 rounded-md bg-destructive/15 px-3 py-2 text-xs text-destructive">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
