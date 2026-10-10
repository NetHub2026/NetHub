export interface PlanPosition {
  x: number;
  y: number;
}
export interface PlanRoom extends PlanPosition {
  id: string;
  name: string;
  width: number;
  height: number;
}
export interface CoveragePoint extends PlanPosition {
  id: string;
  at: string;
  session: string;
  label: string;
  latencyMs: number;
  jitterMs: number;
  downloadMbps: number;
  band: "unknown" | "2.4" | "5" | "6";
  connection: "unknown" | "wifi" | "wired";
}
export interface FloorPlan {
  version: 1;
  updatedAt: string;
  image: string;
  name: string;
  width: number;
  height: number;
  positions: Record<string, PlanPosition>;
  rooms: PlanRoom[];
  measurements: CoveragePoint[];
}
const coordinate = (n: unknown): n is number =>
  typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 100;
const text = (s: unknown, max: number): s is string => typeof s === "string" && s.length <= max;
const positive = (n: unknown): n is number =>
  typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 100000;
export function validateFloorPlan(value: unknown): FloorPlan | null {
  if (value === null || value === undefined) return null;
  const p = value as FloorPlan;
  if (
    !p ||
    p.version !== 1 ||
    !text(p.name, 150) ||
    !text(p.updatedAt, 40) ||
    !Number.isFinite(Date.parse(p.updatedAt)) ||
    !text(p.image, 2_000_000) ||
    !/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(p.image) ||
    !Number.isInteger(p.width) ||
    !Number.isInteger(p.height) ||
    p.width < 1 ||
    p.height < 1 ||
    p.width > 2400 ||
    p.height > 2400 ||
    !p.positions ||
    typeof p.positions !== "object" ||
    Array.isArray(p.positions) ||
    Object.keys(p.positions).length > 5000 ||
    !Array.isArray(p.rooms) ||
    p.rooms.length > 40 ||
    !Array.isArray(p.measurements) ||
    p.measurements.length > 200
  )
    throw new Error("Plano no válido o demasiado grande.");
  const positions = Object.fromEntries(
    Object.entries(p.positions).map(([id, position]) => {
      if (!text(id, 400) || !position || !coordinate(position.x) || !coordinate(position.y))
        throw new Error("Posición no válida.");
      return [id, { x: position.x, y: position.y }];
    }),
  );
  const rooms = p.rooms.map((r) => {
    if (
      !r ||
      !text(r.id, 100) ||
      !text(r.name, 100) ||
      !coordinate(r.x) ||
      !coordinate(r.y) ||
      !coordinate(r.width) ||
      !coordinate(r.height) ||
      r.width <= 0 ||
      r.height <= 0 ||
      r.x + r.width > 100.01 ||
      r.y + r.height > 100.01
    )
      throw new Error("Habitación no válida.");
    return { id: r.id, name: r.name, x: r.x, y: r.y, width: r.width, height: r.height };
  });
  const measurements = p.measurements.map((m) => {
    if (
      !m ||
      !text(m.id, 100) ||
      !text(m.at, 40) ||
      !Number.isFinite(Date.parse(m.at)) ||
      !text(m.label, 100) ||
      !text(m.session, 100) ||
      !coordinate(m.x) ||
      !coordinate(m.y) ||
      !positive(m.latencyMs) ||
      !positive(m.jitterMs) ||
      !positive(m.downloadMbps) ||
      !["unknown", "2.4", "5", "6"].includes(m.band) ||
      !["unknown", "wifi", "wired"].includes(m.connection)
    )
      throw new Error("Medición no válida.");
    return {
      id: m.id,
      at: m.at,
      label: m.label,
      session: m.session,
      x: m.x,
      y: m.y,
      latencyMs: m.latencyMs,
      jitterMs: m.jitterMs,
      downloadMbps: m.downloadMbps,
      band: m.band,
      connection: m.connection,
    };
  });
  return {
    version: 1,
    updatedAt: p.updatedAt,
    name: p.name,
    image: p.image,
    width: p.width,
    height: p.height,
    positions,
    rooms,
    measurements,
  };
}

export async function readPlanImage(
  file: File,
): Promise<Pick<FloorPlan, "image" | "width" | "height" | "name">> {
  if (!["image/png", "image/jpeg"].includes(file.type) || file.size > 15 * 1024 * 1024)
    throw new Error("Selecciona una imagen PNG o JPG de hasta 15 MB.");
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width * bitmap.height > 40_000_000)
      throw new Error("La imagen es demasiado grande.");
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No se ha podido procesar la imagen.");
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const image = canvas.toDataURL("image/jpeg", 0.82);
    if (image.length > 2_000_000)
      throw new Error("El plano tiene demasiado detalle. Recorta la imagen antes de importarla.");
    return { image, width: canvas.width, height: canvas.height, name: file.name.slice(0, 150) };
  } finally {
    bitmap.close();
  }
}

/** Measures the browser-to-server HTTP path, never the speed of the ISP. */
export async function measureLocalCoverage(signal: AbortSignal) {
  const request = async (payload: boolean) => {
    const start = performance.now();
    const response = await fetch(
      `/api/coverage-${payload ? "payload" : "ping"}?t=${Date.now()}-${Math.random()}`,
      { cache: "no-store", credentials: "same-origin", signal },
    );
    if (!response.ok) throw new Error("No se ha podido medir la conexión con NetHub en el NAS.");
    const bytes = (await response.arrayBuffer()).byteLength;
    return { ms: performance.now() - start, bytes };
  };
  await request(false);
  const timings: number[] = [];
  for (let i = 0; i < 6; i++) timings.push((await request(false)).ms);
  const transfers = [];
  for (let i = 0; i < 3; i++) transfers.push(await request(true));
  const latencyMs = timings.reduce((a, b) => a + b, 0) / timings.length;
  const jitterMs =
    timings.slice(1).reduce((sum, t, i) => sum + Math.abs(t - timings[i]!), 0) /
    (timings.length - 1);
  const seconds = transfers.reduce((sum, t) => sum + t.ms, 0) / 1000;
  const downloadMbps = (transfers.reduce((sum, t) => sum + t.bytes, 0) * 8) / seconds / 1_000_000;
  if (![latencyMs, jitterMs, downloadMbps].every(positive))
    throw new Error("La medición no ha producido un resultado válido.");
  return { latencyMs, jitterMs, downloadMbps };
}

export const planId = () =>
  typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : Array.from(crypto.getRandomValues(new Uint8Array(16)), (n) =>
        n.toString(16).padStart(2, "0"),
      ).join("");
