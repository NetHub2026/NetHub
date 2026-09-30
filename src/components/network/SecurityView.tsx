import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Globe, ShieldAlert, ShieldCheck, ShieldQuestion, Siren, Trash2 } from "lucide-react";
import type { Device } from "@/lib/devices";
import { auditNetwork, gradeLabels, riskLabels, type RiskLevel } from "@/lib/security";
import { alertKindLabels, trustLabels, trustOf, type SentinelAlert } from "@/lib/sentinel";
import { formatDateTime } from "@/lib/activity";
import { checkDns, type DnsCheckResult } from "@/lib/desktop";
import { cn } from "@/lib/utils";

interface Props {
  devices: Device[];
  alerts: SentinelAlert[];
  gatewayIp: string;
  onSelectDevice: (id: string) => void;
  onTrust: (id: string) => void;
  onResolveAlert: (id: string) => void;
  onClearAlerts: () => void;
}

const levelClass: Record<RiskLevel, string> = {
  critical: "border-destructive/50 bg-destructive/10 text-destructive",
  high: "border-warning/50 bg-warning/10 text-warning",
  medium: "border-brand/40 bg-brand/10 text-brand",
  low: "border-border bg-muted/50 text-muted-foreground",
};

/** Auditoría de seguridad (0-100) + guardián Sentinel + DNS. */
export function SecurityView({ devices, alerts, gatewayIp, onSelectDevice, onTrust, onResolveAlert, onClearAlerts }: Props) {
  const report = useMemo(() => auditNetwork(devices), [devices]);
  const [open, setOpen] = useState<string | null>(null);
  const [dns, setDns] = useState<DnsCheckResult | null>(null);
  const [dnsBusy, setDnsBusy] = useState(false);
  const runDnsCheck = async () => {
    setDnsBusy(true);
    try {
      setDns(await checkDns(gatewayIp));
    } finally {
      setDnsBusy(false);
    }
  };
  const unverified = devices.filter((d) => trustOf(d) === "unverified");
  const active = alerts.filter((a) => !a.resolved);
  const gradeColor =
    report.grade === "excellent" ? "text-success" : report.grade === "good" ? "text-brand" : report.grade === "risk" ? "text-warning" : "text-destructive";
  const ring = 2 * Math.PI * 52;

  return (
    <section className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="flex flex-col items-center rounded-2xl border border-border bg-card p-6">
          <h2 className="self-start text-sm font-semibold">Puntuación de seguridad</h2>
          <svg viewBox="0 0 120 120" className="mt-4 size-40 -rotate-90">
            <circle cx="60" cy="60" r="52" className="fill-none stroke-muted" strokeWidth="10" />
            <circle
              cx="60" cy="60" r="52" strokeWidth="10" strokeLinecap="round"
              className={cn("fill-none transition-all", gradeColor)} stroke="currentColor"
              strokeDasharray={ring} strokeDashoffset={ring * (1 - report.score / 100)}
            />
          </svg>
          <p className={cn("-mt-28 mb-16 text-4xl font-bold tabular-nums", gradeColor)}>{report.score}</p>
          <p className={cn("text-sm font-semibold", gradeColor)}>{gradeLabels[report.grade]}</p>
          <div className="mt-3 flex gap-1.5" aria-label="Semáforo de riesgo">
            {(["critical", "risk", "good", "excellent"] as const).map((g) => (
              <span key={g} className={cn("h-2 w-8 rounded-full", report.grade === g ? (g === "critical" ? "bg-destructive" : g === "risk" ? "bg-warning" : g === "good" ? "bg-brand" : "bg-success") : "bg-muted")} />
            ))}
          </div>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            {report.scannedDevices} de {report.totalDevices} equipos con puertos analizados. Usa «Escanear puertos» en cada ficha para una auditoría completa.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-2">
            <Siren className="size-4 text-warning" />
            <h2 className="text-sm font-semibold">Sentinel · alertas de intrusos</h2>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{active.length} activas</span>
            {alerts.length > 0 && (
              <button onClick={onClearAlerts} className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <Trash2 className="size-3.5" /> Vaciar
              </button>
            )}
          </div>
          {active.length === 0 ? (
            <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="size-4 text-success" /> Sin alertas activas. NetHub vigila cada escaneo.
            </p>
          ) : (
            <ul className="mt-4 max-h-72 space-y-2 overflow-auto">
              {active.slice(0, 30).map((a) => (
                <li key={a.id} className={cn("flex items-start gap-3 rounded-xl border p-3", a.severity === "critical" ? "border-destructive/50 bg-destructive/5" : "border-warning/40 bg-warning/5")}>
                  <AlertTriangle className={cn("mt-0.5 size-4 shrink-0", a.severity === "critical" ? "text-destructive" : "text-warning")} />
                  <button className="min-w-0 flex-1 text-left" onClick={() => a.deviceId && onSelectDevice(a.deviceId)}>
                    <p className="text-sm font-medium">{a.title}</p>
                    <p className="text-xs text-muted-foreground">{a.detail}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{alertKindLabels[a.kind]} · {formatDateTime(a.at)}</p>
                  </button>
                  <button onClick={() => onResolveAlert(a.id)} className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent">Resuelta</button>
                </li>
              ))}
            </ul>
          )}

          <h3 className="mt-6 flex items-center gap-2 text-sm font-semibold">
            <ShieldQuestion className="size-4 text-warning" /> Por verificar ({unverified.length})
          </h3>
          {unverified.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">Todos los equipos están clasificados como {trustLabels.trusted.toLowerCase()}.</p>
          ) : (
            <ul className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {unverified.map((d) => (
                <li key={d.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                  <button className="min-w-0 flex-1 text-left" onClick={() => onSelectDevice(d.id)}>
                    <p className="truncate text-sm font-medium">{d.name}</p>
                    <p className="truncate font-mono text-[11px] text-muted-foreground">{d.ip} · {d.mac}</p>
                  </button>
                  <button onClick={() => onTrust(d.id)} className="inline-flex items-center gap-1 rounded-md bg-brand px-2 py-1 text-xs text-brand-foreground">
                    <CheckCircle2 className="size-3.5" /> De confianza
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Globe className="size-4" /> Integridad del DNS
          </h2>
          <button
            onClick={() => void runDnsCheck()}
            disabled={dnsBusy}
            className="ml-auto rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-60"
          >
            {dnsBusy ? "Comprobando…" : "Comprobar DNS"}
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Compara la respuesta del DNS de tu router con la de 8.8.8.8 para un dominio conocido.
          Si difieren, alguien está manipulando las direcciones de tu red (phishing o bloqueo).
        </p>
        {dns && (
          <div
            className={cn(
              "mt-3 rounded-xl border p-4 text-sm",
              !dns.available
                ? "border-border bg-muted/40"
                : dns.hijacked
                  ? "border-destructive/50 bg-destructive/10 text-destructive"
                  : dns.ok
                    ? "border-success/50 bg-success/10 text-success"
                    : "border-warning/50 bg-warning/10 text-warning",
            )}
          >
            {!dns.available ? (
              <p>{dns.error}</p>
            ) : dns.hijacked ? (
              <>
                <p className="font-medium">¡Posible DNS secuestrado!</p>
                <p className="mt-1 text-xs">
                  {dns.domain} resuelve en tu router a {dns.gatewayIps.join(", ")} pero en 8.8.8.8
                  a {dns.publicIps.join(", ")}. Revisa el DNS del router y los equipos con
                  software sospechoso.
                </p>
              </>
            ) : dns.ok ? (
              <p>
                DNS íntegro: tu router y 8.8.8.8 responden lo mismo
                {dns.gatewayRtt !== null ? ` (${dns.gatewayRtt} ms)` : ""}.
              </p>
            ) : (
              <p className="text-warning">
                No se ha podido completar la comprobación
                {dns.error ? `: ${dns.error}` : "."}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <ShieldAlert className="size-4" /> Vulnerabilidades y recomendaciones ({report.findings.length})
        </h2>
        {report.findings.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No se han encontrado puertos críticos expuestos.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {report.findings.map((f) => (
              <li key={f.id} className="rounded-xl border border-border">
                <button onClick={() => setOpen(open === f.id ? null : f.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                  <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-medium", levelClass[f.level])}>{riskLabels[f.level]}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{f.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{f.deviceName} · {f.ip}{f.port ? `:${f.port}` : ""}</span>
                  </span>
                  <span className="text-xs tabular-nums text-muted-foreground">−{Math.round(f.penalty)} pts</span>
                </button>
                {open === f.id && (
                  <div className="border-t border-border px-4 py-3 text-sm">
                    <p className="text-muted-foreground">{f.why}</p>
                    <ol className="mt-2 list-decimal space-y-1 pl-5">
                      {f.steps.map((s) => <li key={s}>{s}</li>)}
                    </ol>
                    <button onClick={() => onSelectDevice(f.deviceId)} className="mt-3 rounded-md border border-border px-2.5 py-1 text-xs hover:bg-accent">Abrir ficha</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
