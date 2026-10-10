import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Device } from "@/lib/devices";
import type { DirectoryKind } from "@/lib/directory";

interface Props {
  kind: DirectoryKind;
  names: string[];
  devices: Device[];
  onCreate: (name: string) => void;
  onChange: (previous: string, replacement: string) => void;
}

export function DirectoryManager({ kind, names, devices, onCreate, onChange }: Props) {
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const people = kind === "people";
  const title = people ? "Personas" : "Ubicaciones";
  const field = people ? "person" : "location";
  const count = (entry: string) =>
    devices.filter((d) => d[field]?.trim().toLowerCase() === entry.toLowerCase()).length;
  const reset = () => {
    setName("");
    setEditing(null);
    setRemoving(null);
    setError("");
  };
  const save = () => {
    const value = name.trim();
    if (!value) {
      setError("Escribe un nombre.");
      return;
    }
    if (names.some((entry) => entry !== editing && entry.toLowerCase() === value.toLowerCase())) {
      setError("Ya existe un nombre igual. Elige otro.");
      return;
    }
    if (editing !== null) onChange(editing, value);
    else onCreate(value);
    reset();
  };
  return (
    <section className="space-y-4">
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">
        Crea y organiza las {title.toLowerCase()} de tu inventario. Renombrar actualiza también los
        dispositivos asignados.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
        className="space-y-2"
      >
        <label htmlFor={`directory-${kind}`} className="text-sm font-medium">
          {editing === null ? "Nuevo nombre" : `Renombrar «${editing}»`}
        </label>
        <div className="flex gap-2">
          <input
            id={`directory-${kind}`}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setError("");
            }}
            maxLength={100}
            className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <Button type="submit">{editing === null ? "Crear" : "Guardar"}</Button>
        </div>
        {editing !== null && (
          <Button type="button" variant="ghost" onClick={reset}>
            Cancelar edición
          </Button>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </form>
      {names.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Todavía no has creado {title.toLowerCase()}.
        </p>
      )}
      <ul className="space-y-2">
        {names.map((entry) => (
          <li key={entry} className="rounded-lg border border-border p-3">
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className="break-words font-medium">{entry}</p>
                <p className="text-xs text-muted-foreground">
                  {count(entry)} dispositivos asignados
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Renombrar ${entry}`}
                onClick={() => {
                  reset();
                  setEditing(entry);
                  setName(entry);
                }}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Eliminar ${entry}`}
                onClick={() => {
                  reset();
                  setRemoving(entry);
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
            {removing === entry && (
              <div className="mt-3 space-y-2 border-t pt-3">
                <p className="text-sm">
                  ¿Eliminar «{entry}»? {count(entry)} dispositivos quedarán sin{" "}
                  {people ? "persona" : "ubicación"}. Los dispositivos se conservarán.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    onClick={() => {
                      onChange(entry, "");
                      reset();
                    }}
                  >
                    Eliminar
                  </Button>
                  <Button variant="outline" onClick={reset}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
