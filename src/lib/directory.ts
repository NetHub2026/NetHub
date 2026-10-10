import type { Device } from "./devices";

/** Listas reutilizables de personas y ubicaciones creadas por el usuario. */
export interface Directory {
  people: string[];
  locations: string[];
}

export const emptyDirectory: Directory = { people: [], locations: [] };

const DIRECTORY_KEY = "nethub.directory.v1";

function clean(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const value = String(raw ?? "").trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out.sort((a, b) => a.localeCompare(b, "es"));
}

export function sanitizeDirectory(value: unknown): Directory {
  const raw = (value ?? {}) as { people?: unknown; locations?: unknown };
  return { people: clean(raw.people), locations: clean(raw.locations) };
}

/** Añade un valor a una lista (sin duplicados, ignorando mayúsculas). */
export function withEntry(list: string[], value: string): string[] {
  return clean([...list, value]);
}

/** Completa las listas con las personas y ubicaciones ya usadas en los dispositivos. */
export function directoryFromDevices(
  devices: Device[],
  base: Directory = emptyDirectory,
): Directory {
  return sanitizeDirectory({
    people: [...base.people, ...devices.map((d) => d.person ?? "")],
    locations: [...base.locations, ...devices.map((d) => d.location ?? "")],
  });
}

export type DirectoryKind = keyof Directory;

/** Rename or remove an entry and its assignments together, including legacy-only entries. */
export function changeDirectoryEntry(
  devices: Device[],
  directory: Directory,
  kind: DirectoryKind,
  previous: string,
  replacement: string,
) {
  const field = kind === "people" ? "person" : "location";
  const matches = (value: string | undefined) =>
    value?.trim().toLowerCase() === previous.trim().toLowerCase();
  const name = replacement.trim();
  const options = directoryFromDevices(devices, directory);
  if (
    name &&
    options[kind].some((value) => !matches(value) && value.toLowerCase() === name.toLowerCase())
  ) {
    throw new Error("Ya existe un nombre igual. Elige otro.");
  }
  return {
    directory: {
      ...options,
      [kind]: clean([...options[kind].filter((value) => !matches(value)), name]),
    },
    devices: devices.map((device) =>
      matches(device[field]) ? { ...device, [field]: name || undefined } : device,
    ),
  };
}

export function loadStoredDirectory(): Directory {
  if (typeof window === "undefined") return emptyDirectory;
  try {
    const raw = window.localStorage.getItem(DIRECTORY_KEY);
    return raw ? sanitizeDirectory(JSON.parse(raw)) : emptyDirectory;
  } catch {
    return emptyDirectory;
  }
}

export function saveStoredDirectory(directory: Directory) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DIRECTORY_KEY, JSON.stringify(sanitizeDirectory(directory)));
  } catch {
    /* sin almacenamiento */
  }
}

export function clearStoredDirectory() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(DIRECTORY_KEY);
  } catch {
    /* sin almacenamiento */
  }
}
