import { useEffect, useRef, useState, type PointerEvent } from "react";
import { MapPin, Upload, Download, Move, Radio, Square, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import type { Device } from "@/lib/devices";
import { DeviceTypeIcon } from "./DeviceTypeIcon";
import {
  planId,
  polygonRoom,
  roomPoints,
  roomContains,
  readPlanImage,
  validateFloorPlan,
  measureLocalCoverage,
  type FloorPlan,
  type PlanPosition,
  type CoveragePoint,
} from "@/lib/floor-plan";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

type Props = {
  devices: Device[];
  plan: FloorPlan | null;
  onSave: (plan: FloorPlan | null, expected: string | null) => Promise<boolean>;
  canMeasure?: boolean;
  demo?: boolean;
};
const control =
  "rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-50";
const pointColor = (m: CoveragePoint) =>
  m.downloadMbps >= 100 && m.latencyMs < 30
    ? "#13a779"
    : m.downloadMbps >= 25 && m.latencyMs < 100
      ? "#e7a126"
      : "#f15c67";

export function FloorPlanView({ devices, plan, onSave, canMeasure = false, demo = false }: Props) {
  const [draft, setDraft] = useState(plan);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"devices" | "measure" | "rooms">("devices");
  const [deviceId, setDeviceId] = useState("");
  const [roomName, setRoomName] = useState("");
  const [corners, setCorners] = useState<PlanPosition[]>([]);
  const [editingRoom, setEditingRoom] = useState<string | null>(null);
  const [position, setPosition] = useState<PlanPosition | null>(null);
  const [session, setSession] = useState("Primera visita");
  const [filterSession, setFilterSession] = useState("all");
  const [connection, setConnection] = useState<CoveragePoint["connection"]>("unknown");
  const [band, setBand] = useState<CoveragePoint["band"]>("unknown");
  const [confirm, setConfirm] = useState<"replace" | "clear" | null>(null);
  const surface = useRef<HTMLDivElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);
  const dragging = useRef<string | null>(null);
  useEffect(() => {
    if (!busy) setDraft(plan);
  }, [plan?.updatedAt, busy]);
  useEffect(() => () => abort.current?.abort(), []);

  async function save(next: FloorPlan | null) {
    if (busy) return false;
    setBusy(true);
    const stamped = next ? { ...next, updatedAt: new Date().toISOString() } : null;
    try {
      if (!(await onSave(stamped, plan?.updatedAt ?? null)))
        throw new Error("El plano no se ha guardado. Revisa la conexión y vuelve a intentarlo.");
      setDraft(stamped);
      toast.success("Plano guardado");
      return true;
    } catch (error) {
      toast.error((error as Error).message);
      setDraft(plan);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function upload(file?: File) {
    if (!file) return;
    try {
      const image = await readPlanImage(file);
      await save({
        version: 1,
        updatedAt: new Date().toISOString(),
        ...image,
        positions: {},
        rooms: [],
        measurements: [],
      });
      setPosition(null);
      setCorners([]);
      setEditingRoom(null);
      setFilterSession("all");
    } catch (error) {
      toast.error((error as Error).message);
    }
  }
  function coordinates(event: PointerEvent): PlanPosition {
    const rect = surface.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100)),
    };
  }
  function place(event: PointerEvent<HTMLDivElement>) {
    if (!draft || busy || event.target !== event.currentTarget) return;
    const p = coordinates(event);
    if (mode === "measure") setPosition(p);
    if (mode === "devices") {
      if (!deviceId) {
        toast.info("Elige un dispositivo y toca su posición en el plano.");
        return;
      }
      void save({ ...draft, positions: { ...draft.positions, [deviceId]: p } });
    }
    if (mode === "rooms") {
      if (!roomName.trim()) {
        toast.info("Escribe el nombre de la habitación.");
        return;
      }
      if (editingRoom) return;
      if (corners.length >= 40) {
        toast.info("Puedes marcar hasta 40 esquinas.");
        return;
      }
      setCorners([...corners, p]);
    }
  }
  async function finishRoom() {
    if (!draft || busy || !roomName.trim()) return;
    try {
      if (draft.rooms.length >= 40) throw new Error("Puedes marcar hasta 40 habitaciones.");
      const room = polygonRoom(planId(), roomName.trim().slice(0, 100), corners);
      if (await save({ ...draft, rooms: [...draft.rooms, room] })) {
        setCorners([]);
        setRoomName("");
      }
    } catch (error) {
      toast.error((error as Error).message);
    }
  }
  async function measure() {
    if (!draft || !position || busy || !canMeasure || demo) return;
    if (!session.trim()) {
      toast.info("Pon un nombre a esta visita para comparar mediciones.");
      return;
    }
    const current = draft,
      p = position;
    const controller = new AbortController();
    abort.current = controller;
    const timer = setTimeout(() => controller.abort(), 45000);
    setBusy(true);
    try {
      const result = await measureLocalCoverage(controller.signal);
      const label = current.rooms.find((r) => roomContains(r, p))?.name ?? "Punto del plano";
      const next: FloorPlan = {
        ...current,
        updatedAt: new Date().toISOString(),
        measurements: [
          ...current.measurements,
          {
            ...p,
            ...result,
            id: planId(),
            at: new Date().toISOString(),
            label,
            session: session.trim().slice(0, 100),
            connection,
            band: connection === "wifi" ? band : "unknown",
          },
        ].slice(-200),
      };
      if (!(await onSave(next, plan?.updatedAt ?? null)))
        throw new Error("No se ha podido guardar la medición.");
      setDraft(next);
      toast.success(`Medido: ${result.downloadMbps.toFixed(1)} Mbps hacia el NAS`);
    } catch (error) {
      toast.error(
        controller.signal.aborted
          ? "Medición cancelada o conexión demasiado lenta."
          : (error as Error).message,
      );
    } finally {
      clearTimeout(timer);
      abort.current = null;
      setBusy(false);
    }
  }
  const points =
    draft?.measurements.filter((m) => filterSession === "all" || m.session === filterSession) ?? [];
  const sessions = [...new Set(draft?.measurements.map((m) => m.session) ?? [])];
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <MapPin className="size-5 text-primary" />
            Plano y cobertura
          </h2>
          <p className="text-sm text-muted-foreground">
            Tu plano real, tus equipos y mediciones donde tú estás.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            disabled={busy}
            className={control}
            onClick={() => (draft ? setConfirm("replace") : imageInput.current?.click())}
          >
            <Upload className="mr-1 inline size-4" />
            {draft ? "Cambiar plano" : "Subir plano"}
          </button>
          {draft && (
            <button
              disabled={busy}
              className={control}
              onClick={() => {
                const url = URL.createObjectURL(
                  new Blob([JSON.stringify(draft, null, 2)], { type: "application/json" }),
                );
                const a = document.createElement("a");
                a.href = url;
                a.download = "nethub-plano.json";
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}
            >
              <Download className="mr-1 inline size-4" />
              Guardar copia
            </button>
          )}
          {!draft && (
            <label className={control}>
              Importar copia
              <input
                className="hidden"
                type="file"
                accept=".json"
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file && file.size <= 3_000_000)
                    void file
                      .text()
                      .then((text) => validateFloorPlan(JSON.parse(text)))
                      .then((next) => save(next))
                      .catch((error) => toast.error((error as Error).message));
                  else if (file) toast.error("La copia es demasiado grande.");
                }}
              />
            </label>
          )}
        </div>
      </div>
      <input
        ref={imageInput}
        type="file"
        accept="image/png,image/jpeg"
        className="hidden"
        onChange={(e) => {
          void upload(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {!draft ? (
        <div className="rounded-2xl border border-dashed border-primary/40 bg-card p-10 text-center">
          <MapPin className="mx-auto mb-4 size-12 text-primary" />
          <h3 className="mb-2 text-xl font-semibold">Empieza con el plano de tu casa</h3>
          <p className="mx-auto max-w-lg text-sm text-muted-foreground">
            Sube una imagen PNG o JPG. Puedes fotografiar un plano o dibujarlo. Se guarda localmente
            y puedes llevarlo de PC a NAS mediante una copia.
          </p>
          <button
            className="mt-5 rounded-lg bg-primary px-5 py-3 text-primary-foreground"
            onClick={() => imageInput.current?.click()}
          >
            Elegir imagen
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
            {(
              [
                ["devices", "Equipos", Move],
                ["rooms", "Habitaciones", Square],
                ["measure", "Medir cobertura", Radio],
              ] as const
            ).map(([key, label, Icon]) => (
              <button
                key={key}
                disabled={busy}
                className={`${control} ${mode === key ? "border-primary text-primary" : ""}`}
                onClick={() => {
                  setMode(key);
                  setCorners([]);
                  setEditingRoom(null);
                }}
              >
                <Icon className="mr-1 inline size-4" />
                {label}
              </button>
            ))}
            {mode === "devices" && (
              <select
                aria-label="Equipo que colocar"
                disabled={busy}
                className={`${control} max-w-full`}
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
              >
                <option value="">Elige un equipo para colocarlo</option>
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                    {draft.positions[d.id] ? " · colocado" : ""}
                  </option>
                ))}
              </select>
            )}
            {mode === "rooms" && (
              <>
                <input
                  aria-label="Nombre de habitación"
                  maxLength={100}
                  disabled={busy}
                  className={control}
                  placeholder="Nombre de habitación"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                />
                <button
                  className={control}
                  disabled={busy || corners.length < 3 || !roomName.trim()}
                  onClick={() => void finishRoom()}
                >
                  Cerrar habitación
                </button>
                <button
                  className={control}
                  disabled={busy || !corners.length}
                  onClick={() => setCorners(corners.slice(0, -1))}
                >
                  Deshacer esquina
                </button>
                {(corners.length > 0 || editingRoom) && (
                  <button
                    className={control}
                    disabled={busy}
                    onClick={() => {
                      setCorners([]);
                      setEditingRoom(null);
                    }}
                  >
                    Cancelar edición
                  </button>
                )}
                <span className="text-xs text-muted-foreground">
                  {editingRoom
                    ? "Arrastra las esquinas para corregir el contorno"
                    : "Toca cada esquina y cierra el contorno"}
                </span>
              </>
            )}
            {mode === "measure" && (
              <span className="text-xs text-muted-foreground">
                Toca en el plano el lugar donde estás.
              </span>
            )}
          </div>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="self-start overflow-hidden rounded-2xl border border-border bg-white">
              <div
                ref={surface}
                className="relative w-full select-none"
                style={{
                  aspectRatio: `${draft.width}/${draft.height}`,
                  maxWidth: `calc(max(240px, 100dvh - 350px) * ${draft.width / draft.height})`,
                  margin: "0 auto",
                  backgroundImage: `url(${draft.image})`,
                  backgroundSize: "100% 100%",
                  touchAction: mode === "devices" ? "pan-y" : "manipulation",
                }}
                onPointerUp={place}
              >
                <svg
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  className="pointer-events-none absolute inset-0 h-full w-full"
                >
                  {draft.rooms.map((room) => (
                    <polygon
                      key={room.id}
                      points={roomPoints(room)
                        .map((p) => `${p.x},${p.y}`)
                        .join(" ")}
                      fill="rgba(56,189,248,0.12)"
                      stroke="#0ea5e9"
                      strokeWidth="1"
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
                  {!!corners.length && (
                    <polyline
                      points={corners.map((p) => `${p.x},${p.y}`).join(" ")}
                      fill="none"
                      stroke="#0284c7"
                      strokeWidth="2"
                      strokeDasharray="5 3"
                      vectorEffect="non-scaling-stroke"
                    />
                  )}
                </svg>
                {draft.rooms.map((room) => (
                  <span
                    key={room.id}
                    className="pointer-events-none absolute rounded bg-white/90 px-1 text-xs font-semibold text-slate-800"
                    style={{
                      left: `${roomPoints(room)[0]!.x}%`,
                      top: `${roomPoints(room)[0]!.y}%`,
                    }}
                  >
                    {room.name}
                  </span>
                ))}
                {mode === "rooms" &&
                  corners.map((p, i) => (
                    <button
                      key={i}
                      aria-label={
                        i === 0 ? "Cerrar contorno en la primera esquina" : `Esquina nueva ${i + 1}`
                      }
                      className="absolute z-30 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-sky-600 text-xs text-white"
                      style={{ left: `${p.x}%`, top: `${p.y}%` }}
                      onClick={() => {
                        if (i === 0) void finishRoom();
                      }}
                    >
                      {i + 1}
                    </button>
                  ))}
                {mode === "rooms" &&
                  draft.rooms
                    .filter((r) => r.id === editingRoom)
                    .flatMap((room) =>
                      roomPoints(room).map((p, i) => (
                        <button
                          key={`${room.id}-${i}`}
                          aria-label={`Mover esquina ${i + 1} de ${room.name}`}
                          disabled={busy}
                          className="absolute z-30 size-6 -translate-x-1/2 -translate-y-1/2 touch-none rounded-full border-2 border-white bg-sky-600 text-xs text-white"
                          style={{ left: `${p.x}%`, top: `${p.y}%` }}
                          onPointerDown={(event) => {
                            event.stopPropagation();
                            dragging.current = `${room.id}:${i}`;
                            event.currentTarget.setPointerCapture(event.pointerId);
                          }}
                          onPointerMove={(event) => {
                            if (dragging.current !== `${room.id}:${i}`) return;
                            const next = roomPoints(room).map((v, j) =>
                              j === i ? coordinates(event) : v,
                            );
                            setDraft((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    rooms: prev.rooms.map((r) =>
                                      r.id === room.id ? { ...r, points: next } : r,
                                    ),
                                  }
                                : prev,
                            );
                          }}
                          onPointerUp={(event) => {
                            event.stopPropagation();
                            if (dragging.current !== `${room.id}:${i}`) return;
                            dragging.current = null;
                            try {
                              const next = polygonRoom(
                                room.id,
                                room.name,
                                roomPoints(room).map((v, j) => (j === i ? coordinates(event) : v)),
                              );
                              void save({
                                ...draft,
                                rooms: draft.rooms.map((r) => (r.id === room.id ? next : r)),
                              });
                            } catch (error) {
                              toast.error((error as Error).message);
                              setDraft(plan);
                            }
                          }}
                          onPointerCancel={() => {
                            dragging.current = null;
                            setDraft(plan);
                          }}
                        >
                          {i + 1}
                        </button>
                      )),
                    )}
                {points.map((m, i) => (
                  <button
                    key={m.id}
                    className="absolute z-10 flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white shadow-lg sm:size-9"
                    style={{ left: `${m.x}%`, top: `${m.y}%`, backgroundColor: pointColor(m) }}
                    title={`${m.label} · ${m.session}: ${m.downloadMbps.toFixed(1)} Mbps / ${m.latencyMs.toFixed(1)} ms`}
                    onClick={() => {
                      setPosition({ x: m.x, y: m.y });
                      setMode("measure");
                    }}
                  >
                    {i + 1}
                  </button>
                ))}
                {mode === "devices" &&
                  devices
                    .filter((d) => draft.positions[d.id])
                    .map((d) => {
                      const p = draft.positions[d.id]!;
                      return (
                        <button
                          key={d.id}
                          aria-label={`Mover ${d.name}`}
                          title={d.name}
                          className={`absolute z-20 flex size-9 -translate-x-1/2 -translate-y-1/2 touch-none items-center justify-center rounded-full border-2 border-white shadow-lg ${d.status === "online" ? "bg-sky-600 text-white" : "bg-slate-500 text-white"}`}
                          style={{ left: `${p.x}%`, top: `${p.y}%` }}
                          disabled={busy}
                          onPointerDown={(event) => {
                            event.stopPropagation();
                            dragging.current = d.id;
                            event.currentTarget.setPointerCapture(event.pointerId);
                          }}
                          onPointerMove={(event) => {
                            if (dragging.current !== d.id) return;
                            const p = coordinates(event);
                            setDraft((prev) =>
                              prev
                                ? { ...prev, positions: { ...prev.positions, [d.id]: p } }
                                : prev,
                            );
                          }}
                          onPointerUp={(event) => {
                            event.stopPropagation();
                            if (dragging.current !== d.id) return;
                            dragging.current = null;
                            void save({
                              ...draft,
                              positions: { ...draft.positions, [d.id]: coordinates(event) },
                            });
                          }}
                          onPointerCancel={() => {
                            dragging.current = null;
                            setDraft(plan);
                          }}
                        >
                          <DeviceTypeIcon type={d.type} className="size-4" />
                        </button>
                      );
                    })}
                {position && mode === "measure" && (
                  <span
                    className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-1/2 text-3xl font-bold text-sky-700"
                    style={{ left: `${position.x}%`, top: `${position.y}%` }}
                  >
                    +
                  </span>
                )}
              </div>
            </div>
            <aside className="space-y-4 rounded-2xl border border-border bg-card p-4">
              <h3 className="font-semibold">
                {mode === "measure" ? "Mediciones reales" : "Tu red sobre el plano"}
              </h3>
              {mode !== "measure" && (
                <>
                  <p className="text-sm">
                    {devices.filter((d) => draft.positions[d.id]).length} equipos colocados ·{" "}
                    {draft.rooms.length} habitaciones
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {mode === "devices"
                      ? "Elige un equipo y toca el plano para colocarlo. Arrastra su icono para moverlo."
                      : "Escribe el nombre y toca cada esquina. Cierra con el primer punto o «Cerrar habitación». Para corregir una habitación, pulsa «Editar» y arrastra sus esquinas."}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {draft.measurements.length} mediciones guardadas. Abre «Medir cobertura» para
                    medir y comparar visitas.
                  </p>
                </>
              )}
              {mode === "measure" && (
                <>
                  <p className="text-xs text-muted-foreground">
                    Velocidad de descarga y latencia HTTP entre este dispositivo y NetHub en el NAS.
                    No es un test de Internet ni una medición de señal Wi-Fi.
                  </p>
                  {!canMeasure && (
                    <p className="rounded-lg bg-primary/10 p-3 text-sm">
                      Para medir caminando con el móvil, abre NetHub desde la dirección del NAS.
                      Aquí puedes preparar y colocar los equipos en el plano.
                    </p>
                  )}
                  {demo && (
                    <p className="text-sm text-amber-500">
                      Las mediciones están desactivadas en la demostración.
                    </p>
                  )}
                  <label className="block text-xs text-muted-foreground">
                    Visita / configuración
                    <input
                      maxLength={100}
                      className={`${control} mt-1 w-full`}
                      value={session}
                      onChange={(e) => setSession(e.target.value)}
                      placeholder="Antes de mover el router"
                    />
                  </label>
                  <label className="block text-xs text-muted-foreground">
                    Conexión indicada por ti
                    <select
                      className={`${control} mt-1 w-full`}
                      value={connection}
                      onChange={(e) => {
                        setConnection(e.target.value as CoveragePoint["connection"]);
                        setBand("unknown");
                      }}
                    >
                      <option value="unknown">Sin indicar</option>
                      <option value="wifi">Wi-Fi</option>
                      <option value="wired">Cable</option>
                    </select>
                  </label>
                  {connection === "wifi" && (
                    <select
                      aria-label="Banda indicada"
                      className={`${control} w-full`}
                      value={band}
                      onChange={(e) => setBand(e.target.value as CoveragePoint["band"])}
                    >
                      <option value="unknown">Banda sin indicar</option>
                      <option value="2.4">2,4 GHz</option>
                      <option value="5">5 GHz</option>
                      <option value="6">6 GHz</option>
                    </select>
                  )}
                  <button
                    disabled={busy || !position || !canMeasure || demo}
                    className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-40"
                    onClick={() => void measure()}
                  >
                    {busy ? (
                      <>
                        <LoaderCircle className="mr-1 inline size-4 animate-spin" />
                        Procesando…
                      </>
                    ) : (
                      "Medir en este punto"
                    )}
                  </button>
                  {busy && abort.current && (
                    <button className={control} onClick={() => abort.current?.abort()}>
                      Cancelar medición
                    </button>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Cada prueba transfiere 12 MB por la conexión local. Se conservan los últimos 200
                    puntos.
                  </p>
                  <select
                    aria-label="Mostrar visita"
                    className={`${control} w-full`}
                    value={filterSession}
                    onChange={(e) => setFilterSession(e.target.value)}
                  >
                    <option value="all">Todas las visitas</option>
                    {sessions.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <div className="space-y-2 text-xs">
                    <p>
                      <span className="text-emerald-500">●</span> ≥100 Mbps y &lt;30 ms
                    </p>
                    <p>
                      <span className="text-amber-500">●</span> ≥25 Mbps y &lt;100 ms
                    </p>
                    <p>
                      <span className="text-rose-500">●</span> Por debajo de esos umbrales
                    </p>
                    <p className="text-muted-foreground">
                      Los colores describen puntos medidos; no estiman la cobertura entre puntos ni
                      a través de paredes.
                    </p>
                  </div>
                </>
              )}
            </aside>
          </div>
          {!!points.length && (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted">
                  <tr>
                    {[
                      "Punto",
                      "Visita",
                      "Fecha",
                      "Descarga al NAS",
                      "Latencia / variación",
                      "",
                    ].map((h, i) => (
                      <th className="p-3" key={i}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {points
                    .slice()
                    .reverse()
                    .map((m) => (
                      <tr key={m.id} className="border-t border-border">
                        <td className="p-3">{m.label}</td>
                        <td className="p-3">{m.session}</td>
                        <td className="whitespace-nowrap p-3">
                          {new Date(m.at).toLocaleString("es-ES")}
                        </td>
                        <td className="p-3 font-mono">{m.downloadMbps.toFixed(1)} Mbps</td>
                        <td className="p-3 font-mono">
                          {m.latencyMs.toFixed(1)} / {m.jitterMs.toFixed(1)} ms
                        </td>
                        <td className="p-3">
                          <button
                            disabled={busy}
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() =>
                              void save({
                                ...draft,
                                measurements: draft.measurements.filter(
                                  (point) => point.id !== m.id,
                                ),
                              })
                            }
                          >
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
          {!!draft.rooms.length && (
            <div className="flex flex-wrap gap-2">
              {draft.rooms.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <span>{r.name}</span>
                  <button
                    disabled={busy}
                    className="text-primary"
                    aria-label={`Editar ${r.name}`}
                    onClick={() => {
                      setMode("rooms");
                      setCorners([]);
                      setEditingRoom(r.id);
                    }}
                  >
                    Editar
                  </button>
                  <button
                    disabled={busy}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label={`Quitar ${r.name}`}
                    onClick={() => {
                      setEditingRoom(null);
                      void save({
                        ...draft,
                        rooms: draft.rooms.filter((room) => room.id !== r.id),
                      });
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          {deviceId && draft.positions[deviceId] && (
            <button
              disabled={busy}
              className={control}
              onClick={() => {
                const positions = { ...draft.positions };
                delete positions[deviceId];
                void save({ ...draft, positions });
              }}
            >
              Quitar equipo del plano
            </button>
          )}
          <button
            disabled={busy}
            className="text-xs text-muted-foreground hover:text-destructive"
            onClick={() => setConfirm("clear")}
          >
            Eliminar plano y mediciones
          </button>
        </>
      )}
      <AlertDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === "replace" ? "¿Cambiar el plano?" : "¿Eliminar el plano?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán las posiciones, habitaciones y mediciones de este plano. Puedes guardar
              una copia antes de continuar. El inventario de dispositivos se conserva.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirm === "replace") imageInput.current?.click();
                else void save(null);
                setConfirm(null);
              }}
            >
              Continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
