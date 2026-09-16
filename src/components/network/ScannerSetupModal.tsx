import { useEffect, useState } from "react";
import { Check, Copy, Terminal, X } from "lucide-react";
import { powershellAgentScript, pythonAgentScript } from "@/lib/scanner";
import { cn } from "@/lib/utils";

interface ScannerSetupModalProps {
  open: boolean;
  onClose: () => void;
}

type Tab = "python" | "powershell";

const steps: Record<Tab, string[]> = {
  python: [
    "Instala Python 3.9 o superior desde python.org (marca «Add python.exe to PATH»).",
    "Guarda el script como nethub_agent.py en una carpeta cualquiera, por ejemplo C:\\NetHub.",
    "Abre PowerShell en esa carpeta y ejecuta: python nethub_agent.py",
    "Deja la ventana abierta y vuelve aquí: pulsa «Escanear red».",
  ],
  powershell: [
    "Guarda el script como nethub-agent.ps1, por ejemplo en C:\\NetHub.",
    "Abre PowerShell (basta con permisos de usuario) en esa carpeta.",
    "Ejecuta: powershell -ExecutionPolicy Bypass -File .\\nethub-agent.ps1",
    "Deja la ventana abierta y vuelve aquí: pulsa «Escanear red».",
  ],
};

export function ScannerSetupModal({ open, onClose }: ScannerSetupModalProps) {
  const [tab, setTab] = useState<Tab>("python");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => setCopied(false), [tab, open]);

  if (!open) return null;

  const script = tab === "python" ? pythonAgentScript : powershellAgentScript;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(script);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
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
        aria-label="Configurar escáner Windows"
        className="relative w-full max-w-3xl rounded-2xl border border-border bg-card p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              <Terminal className="size-5 text-brand" />
              Configurar escáner Windows
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              El navegador no puede leer la tabla ARP por seguridad. Este pequeño agente
              se ejecuta en tu PC, hace el escaneo y publica el resultado en{" "}
              <code className="font-mono text-xs">http://localhost:8765/scan</code> con
              CORS habilitado.
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

        <div className="mt-5 flex gap-2">
          {(["python", "powershell"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm transition-colors",
                tab === t
                  ? "border-brand bg-brand text-brand-foreground"
                  : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {t === "python" ? "Script de Python" : "Script de PowerShell"}
            </button>
          ))}
        </div>

        <ol className="mt-5 space-y-2">
          {steps[tab].map((step, i) => (
            <li key={step} className="flex gap-3 text-sm">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-brand/15 text-[11px] font-semibold text-brand">
                {i + 1}
              </span>
              <span className="text-muted-foreground">{step}</span>
            </li>
          ))}
        </ol>

        <div className="mt-5 overflow-hidden rounded-xl border border-border">
          <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/40 px-4 py-2">
            <span className="font-mono text-xs text-muted-foreground">
              {tab === "python" ? "nethub_agent.py" : "nethub-agent.ps1"}
            </span>
            <button
              onClick={copy}
              className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-brand-foreground transition-opacity hover:opacity-90"
            >
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? "Copiado" : "Copiar código"}
            </button>
          </div>
          <pre className="max-h-80 overflow-auto bg-background p-4 font-mono text-xs leading-relaxed">
            {script}
          </pre>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Consejo: el agente solo escucha en 127.0.0.1, así que no queda expuesto fuera
          de tu equipo. Si Windows Defender pregunta, permite el acceso únicamente en
          redes privadas.
        </p>
      </div>
    </div>
  );
}
