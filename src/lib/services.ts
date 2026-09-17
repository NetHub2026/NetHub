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

/** Sondea los servicios comunes de una IP y devuelve los que responden. */
export async function detectServices(ip: string, timeout = 1500): Promise<ServiceHit[]> {
  const results = await Promise.all(
    commonServices.map(async (def) => ({
      def,
      open: await probePort(ip, def, timeout),
    })),
  );
  return results
    .filter((r) => r.open)
    .map(({ def }) => ({
      port: def.port,
      label: def.label,
      url: serviceUrl(ip, def),
      hint: def.hint,
    }));
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
