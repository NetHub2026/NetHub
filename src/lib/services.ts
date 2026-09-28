/**
 * Detección de puertos y servicios comunes.
 *
 * Desde el navegador no existe acceso TCP directo: se sondea cada puerto con
 * una petición `no-cors` con tiempo límite. Si la conexión se establece (aunque
 * la respuesta sea opaca) se considera el puerto abierto; si expira, cerrado.
 * En la app portable el mismo resultado se puede sustituir por un escaneo
 * nativo manteniendo la forma de `ServiceHit`.
 */

export interface ServiceDefinition {
  port: number;
  label: string;
  /** Esquema para construir el enlace de administración. */
  scheme: "http" | "https" | null;
  /** Ruta del panel de administración, si la tiene. */
  path?: string;
  hint: string;
}

export interface ServiceHit {
  port: number;
  label: string;
  url: string | null;
  hint: string;
  /** Tiempo de respuesta del puerto (ms), si se midió */
  rtt?: number | null;
}

export interface PortScanProgress {
  done: number;
  total: number;
  found: number;
}

export const commonServices: ServiceDefinition[] = [
  { port: 80, label: "HTTP", scheme: "http", hint: "Panel web sin cifrar" },
  { port: 443, label: "HTTPS", scheme: "https", hint: "Panel web cifrado" },
  {
    port: 8123,
    label: "Home Assistant",
    scheme: "http",
    hint: "Interfaz de Home Assistant",
  },
  { port: 22, label: "SSH", scheme: null, hint: "Acceso remoto por consola" },
  {
    port: 53,
    label: "DNS / Pi-hole",
    scheme: "http",
    path: "/admin",
    hint: "Servidor DNS local o Pi-hole",
  },
  { port: 8080, label: "HTTP alternativo", scheme: "http", hint: "Panel web secundario" },
  { port: 8081, label: "Cámara / Proxy", scheme: "http", hint: "Cámara IP o proxy web" },
  { port: 3000, label: "Grafana / Node", scheme: "http", hint: "Panel de aplicación" },
  { port: 9090, label: "Prometheus", scheme: "http", hint: "Métricas" },
  { port: 32400, label: "Plex", scheme: "http", path: "/web", hint: "Servidor multimedia" },
  { port: 8006, label: "Proxmox", scheme: "https", hint: "Hipervisor" },
  { port: 1883, label: "MQTT", scheme: null, hint: "Bus de mensajes IoT" },
  { port: 445, label: "SMB", scheme: null, hint: "Carpetas compartidas" },
  { port: 631, label: "IPP / Impresora", scheme: "http", hint: "Impresora en red" },
  { port: 9100, label: "Impresora RAW", scheme: null, hint: "Impresión directa (JetDirect)" },
  { port: 3389, label: "RDP", scheme: null, hint: "Escritorio remoto de Windows" },
  { port: 554, label: "RTSP / Cámara", scheme: null, hint: "Vídeo en directo de cámaras IP" },
  { port: 8443, label: "HTTPS alternativo", scheme: "https", hint: "Panel web cifrado secundario" },
  { port: 5000, label: "Synology / App web", scheme: "http", hint: "NAS o aplicación web" },
  { port: 139, label: "NetBIOS", scheme: null, hint: "Compartición de Windows antigua" },
  { port: 23, label: "Telnet", scheme: null, hint: "Acceso remoto sin cifrar (inseguro)" },
  { port: 21, label: "FTP", scheme: null, hint: "Transferencia de archivos" },
];

export function serviceUrl(ip: string, def: ServiceDefinition): string | null {
  if (!def.scheme) return null;
  const port = (def.scheme === "http" && def.port === 80) || (def.scheme === "https" && def.port === 443)
    ? ""
    : `:${def.port}`;
  return `${def.scheme}://${ip}${port}${def.path ?? ""}`;
}

async function probePort(ip: string, def: ServiceDefinition, timeout: number): Promise<boolean> {
  const scheme = def.scheme ?? "http";
  const url = `${scheme}://${ip}:${def.port}/`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    await fetch(url, { mode: "no-cors", signal: controller.signal, cache: "no-store" });
    return true;
  } catch {
    // Un fallo inmediato (antes del tiempo límite) suele indicar conexión
    // rechazada; si se abortó, el puerto no respondió.
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function toHit(ip: string, def: ServiceDefinition, rtt: number | null): ServiceHit {
  return { port: def.port, label: def.label, url: serviceUrl(ip, def), hint: def.hint, rtt };
}

/**
 * Sondea los servicios comunes de una IP. En escritorio usa sockets TCP reales;
 * en el navegador, peticiones web con tiempo límite. Informa del progreso.
 */
export async function detectServices(
  ip: string,
  onProgress?: (p: PortScanProgress) => void,
  timeout = 1500,
): Promise<{ hits: ServiceHit[]; native: boolean }> {
  const { nativeScanPorts } = await import("./desktop");
  const total = commonServices.length;
  const hits: ServiceHit[] = [];
  let done = 0;
  const chunkSize = 6;
  let native = true;
  for (let i = 0; i < total; i += chunkSize) {
    const chunk = commonServices.slice(i, i + chunkSize);
    const nativeRes = native ? await nativeScanPorts(ip, chunk.map((d) => d.port), 900) : null;
    if (nativeRes) {
      for (const r of nativeRes) {
        const def = chunk.find((d) => d.port === r.port);
        if (def && r.open) hits.push(toHit(ip, def, r.rtt));
      }
    } else {
      native = false;
      await Promise.all(
        chunk.map(async (def) => {
          const t0 = performance.now();
          if (await probePort(ip, def, timeout)) {
            hits.push(toHit(ip, def, Math.max(1, Math.round(performance.now() - t0))));
          }
        }),
      );
    }
    done += chunk.length;
    onProgress?.({ done, total, found: hits.length });
  }
  hits.sort((a, b) => a.port - b.port);
  return { hits, native };
}

/** Servicios probables según el tipo de dispositivo, para sugerir enlaces. */
export function likelyServices(ip: string, type: string): ServiceHit[] {
  const ports =
    type === "home-assistant"
      ? [8123, 22, 80]
      : type === "iot"
        ? [80, 443]
        : type === "tv"
          ? [8080, 80]
          : type === "pc"
            ? [22, 445]
            : [80, 443];
  return commonServices
    .filter((d) => ports.includes(d.port))
    .map((def) => ({
      port: def.port,
      label: def.label,
      url: serviceUrl(ip, def),
      hint: def.hint,
    }));
}
