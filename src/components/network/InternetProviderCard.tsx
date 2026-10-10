import { useEffect, useRef, useState } from "react";
import { Globe, RefreshCw } from "lucide-react";
import { readInternetProvider } from "@/lib/desktop";
import { parseInternetProvider, providerLogo, type InternetProvider } from "@/lib/internet-provider";

export function InternetProviderCard({ name, automatic, onDetected, onEnable, compact = false }: {
  name: string; automatic: boolean; onDetected: (name: string) => void; onEnable: () => void; compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failedLogo, setFailedLogo] = useState<string | null>(null);
  const [details, setDetails] = useState<InternetProvider | null>(null);
  const callback = useRef(onDetected);
  callback.current = onDetected;
  const active = useRef(false);
  const generation = useRef(0);
  const detect = async () => {
    if (active.current) return;
    active.current = true;
    const current = generation.current;
    setBusy(true);
    const provider = parseInternetProvider(await readInternetProvider());
    active.current = false;
    if (current !== generation.current) return;
    setBusy(false);
    if (provider) {
      setDetails(provider);
      callback.current(provider.name);
      setMessage(`Detectado por la conexión pública${provider.asn ? ` · AS${provider.asn}` : ""}`);
    } else { setDetails(null); setMessage("No se ha podido detectar el proveedor. Puedes reintentar o escribirlo en Configuración."); }
  };
  useEffect(() => {
    if (automatic) void detect();
    else setBusy(false);
    return () => { generation.current++; active.current = false; };
    // A manual provider is never replaced by an automatic lookup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [automatic]);
  const logo = providerLogo(name);
  return <div className="rounded-2xl border border-border bg-card p-5">
    <h2 className="mb-4 text-base font-semibold">{compact ? "Conexión a Internet" : "Configuración de Internet"}</h2>
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex h-16 w-28 items-center justify-center rounded-xl border border-border bg-white p-2">
        {logo && failedLogo !== logo ? <img src={logo} alt={`Logo de ${name}`} className="max-h-12 max-w-full object-contain" referrerPolicy="no-referrer" onError={() => setFailedLogo(logo)} /> : <Globe className="size-7 text-slate-500" />}
      </div>
      <div className="min-w-0 flex-1"><p className="text-xs text-muted-foreground">Proveedor de Internet</p><p className="break-words text-lg font-semibold">{name === "tu operador" ? busy ? "Detectando…" : "Sin identificar" : name}</p></div>
      {automatic && <button onClick={() => void detect()} disabled={busy} className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm disabled:opacity-50"><RefreshCw className={`size-4 ${busy ? "animate-spin" : ""}`} />{busy ? "Detectando…" : "Volver a detectar"}</button>}
      {!automatic && <button onClick={onEnable} className="rounded-md border border-brand px-3 py-2 text-sm text-brand">Activar detección automática</button>}
    </div>
    {automatic && details && !compact && <dl className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border text-sm">
      {[["Dirección IP pública", details.ip], ["Nombre de host público", details.hostname], ["Ubicación aproximada", details.location], ["Zona horaria", details.timezone]].map(([label, value]) => <div key={label} className="grid gap-1 px-4 py-3 sm:grid-cols-[14rem_1fr]"><dt className="text-muted-foreground">{label}</dt><dd className="break-all">{value || "No disponible"}</dd></div>)}
    </dl>}
    <p role="status" className="mt-3 text-xs text-muted-foreground">{automatic ? message : name === "tu operador" ? "Detección automática desactivada" : "Nombre configurado manualmente"}</p>
    {!automatic && <p className="mt-2 text-xs text-muted-foreground">Al activarla, IPWhois recibirá tu IP pública para identificar el proveedor y la ubicación aproximada. No se envía el inventario. Se sustituirá el nombre manual por el detectado; puedes desactivarla en Configuración.</p>}
    {!compact && <p className="mt-2 text-xs text-muted-foreground">Con VPN o redes compartidas puede aparecer otro operador. Puedes corregirlo en Configuración → Alertas y monitorización.</p>}
    {!compact && automatic && <details className="mt-2 text-xs text-muted-foreground"><summary className="cursor-pointer">Cómo se detecta</summary><p className="mt-2">Consulta IPWhois con tu conexión pública, sin enviar dispositivos ni datos de la red local. La ubicación es una estimación de la IP. Los logos se cargan desde la web del proveedor cuando se reconoce.</p></details>}
  </div>;
}
