import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "../ui/alert-dialog";
import { useEffect, useState } from "react";
export interface BackupEntry {
  id: string;
  at: string;
  devices: number;
  bytes: number;
}
export interface BackupAdapter {
  list: () => Promise<BackupEntry[]>;
  create: () => Promise<void>;
  read: (id: string) => Promise<unknown>;
  restore: (id: string) => Promise<void>;
}
export function BackupManager({ adapter }: { adapter: BackupAdapter }) {
  const [entries, setEntries] = useState<BackupEntry[]>([]);
  const [confirm, setConfirm] = useState<BackupEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const reload = async () => setEntries(await adapter.list());
  useEffect(() => {
    void reload().catch((e) => setMessage(e.message));
  }, []);
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setMessage("");
    try {
      await action();
      await reload();
      setMessage("Operación completada.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="mt-4 rounded-xl border border-border p-4" aria-label="Copias de seguridad">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Copias de seguridad</h3>
        <button
          disabled={busy}
          className="rounded-md border border-border px-3 py-2 text-xs disabled:opacity-50"
          onClick={() => void run(adapter.create)}
        >
          Crear copia
        </button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Se conservan las siete últimas. Restaurar sustituye el inventario y los historiales; antes
        se guarda una copia del estado actual. Las preferencias de la instalación se conservan.
      </p>
      <ul className="mt-3 space-y-2">
        {!entries.length && (
          <li className="text-xs text-muted-foreground">Todavía no hay copias guardadas.</li>
        )}
        {entries.map((entry) => (
          <li
            key={entry.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/30 p-2 text-xs"
          >
            <span>
              {new Date(entry.at).toLocaleString()} · {entry.devices} dispositivos ·{" "}
              {Math.ceil(entry.bytes / 1024)} KB
            </span>
            <div className="flex gap-2">
              <button
                disabled={busy}
                className="rounded border border-border px-2 py-1"
                onClick={() =>
                  void run(async () => {
                    const data = await adapter.read(entry.id);
                    const url = URL.createObjectURL(
                      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
                    );
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = "nethub-copia.json";
                    link.click();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                  })
                }
              >
                Descargar
              </button>
              <button
                disabled={busy}
                className="rounded border border-border px-2 py-1"
                onClick={() => setConfirm(entry)}
              >
                Restaurar
              </button>
            </div>
          </li>
        ))}
      </ul>
      {message && (
        <p role="status" className="mt-3 text-xs">
          {message}
        </p>
      )}
      <AlertDialog
        open={!!confirm}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>¿Restaurar esta copia?</AlertDialogTitle>
          <AlertDialogDescription>
            La copia del {confirm ? new Date(confirm.at).toLocaleString() : ""} sustituirá el
            inventario y los historiales actuales. Antes se guardará una copia del estado actual.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const id = confirm?.id;
                setConfirm(null);
                if (id) void run(() => adapter.restore(id));
              }}
            >
              Restaurar copia
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
