/**
 * Auditoría de seguridad: puntuación 0-100 a partir de los puertos abiertos
 * detectados (escaneo de puertos de cada ficha) y de los equipos sin verificar.
 */
import type { Device } from "./devices";

export type RiskLevel = "critical" | "high" | "medium" | "low";

export interface SecurityFinding {
  id: string;
  deviceId: string;
  deviceName: string;
  ip: string;
  port?: number;
  level: RiskLevel;
  title: string;
  why: string;
  steps: string[];
  penalty: number;
}

export interface SecurityReport {
  score: number;
  grade: "excellent" | "good" | "risk" | "critical";
  findings: SecurityFinding[];
  scannedDevices: number;
  totalDevices: number;
}

export const gradeLabels: Record<SecurityReport["grade"], string> = {
  excellent: "Excelente",
  good: "Bueno",
  risk: "En riesgo",
  critical: "Crítico",
};

export const riskLabels: Record<RiskLevel, string> = {
  critical: "Crítico",
  high: "Alto",
  medium: "Medio",
  low: "Bajo",
};

const sensitive = new Set(["router", "nas", "camera", "home-assistant", "printer"]);

export function auditNetwork(devices: Device[]): SecurityReport {
  const findings: SecurityFinding[] = [];
  const add = (d: Device, f: Omit<SecurityFinding, "id" | "deviceId" | "deviceName" | "ip">) =>
    findings.push({ id: `${d.id}-${f.port ?? f.title}`, deviceId: d.id, deviceName: d.name, ip: d.ip, ...f });

  for (const d of devices) {
    const ports = new Set((d.services ?? []).map((s) => s.port));
    if (ports.has(23))
      add(d, {
        port: 23, level: "critical", penalty: 25,
        title: "Telnet abierto (puerto 23)",
        why: "Telnet envía usuario y contraseña en texto plano; es la puerta de entrada favorita de las botnets.",
        steps: ["Entra en el panel del equipo.", "Desactiva Telnet (Administración / Acceso remoto).", "Si necesitas acceso remoto, usa SSH con una contraseña fuerte."],
      });
    if (ports.has(21))
      add(d, {
        port: 21, level: "high", penalty: 10,
        title: "FTP sin cifrar (puerto 21)",
        why: "Las credenciales y los archivos viajan sin cifrar.",
        steps: ["Desactiva el servidor FTP si no lo usas.", "Usa SFTP o SMB con cifrado en su lugar."],
      });
    if (ports.has(445) || ports.has(139))
      add(d, {
        port: ports.has(445) ? 445 : 139, level: d.type === "pc" || d.type === "laptop" || d.type === "nas" ? "medium" : "high", penalty: 10,
        title: "Carpetas compartidas SMB expuestas",
        why: "SMB ha sido el vector de ransomware como WannaCry; en equipos que no son servidores no debería estar abierto.",
        steps: ["Desactiva SMBv1 en «Activar o desactivar características de Windows».", "Comparte solo las carpetas necesarias y con contraseña.", "Marca la red como «Privada» y el Firewall activo."],
      });
    if (ports.has(3389))
      add(d, {
        port: 3389, level: "high", penalty: 15,
        title: "Escritorio remoto (RDP) accesible",
        why: "RDP recibe ataques de fuerza bruta constantes si llega a exponerse a Internet.",
        steps: ["Si no lo usas: Configuración → Sistema → Escritorio remoto → Desactivar.", "Si lo usas: activa la autenticación a nivel de red (NLA).", "No redirijas nunca el puerto 3389 en el router; usa una VPN."],
      });
    if (ports.has(80) && !ports.has(443) && sensitive.has(d.type))
      add(d, {
        port: 80, level: d.type === "router" ? "high" : "medium", penalty: d.type === "router" ? 10 : 6,
        title: "Panel web sin cifrar (HTTP)",
        why: "La contraseña de administración viaja en claro por la red.",
        steps: ["Activa HTTPS en el panel de administración si está disponible.", "Cambia la contraseña por defecto del equipo.", "Desactiva la administración remota desde Internet."],
      });
    if (ports.has(554))
      add(d, {
        port: 554, level: "high", penalty: 10,
        title: "Cámara con vídeo RTSP abierto",
        why: "Muchas cámaras permiten ver el vídeo por RTSP sin contraseña.",
        steps: ["Activa la autenticación RTSP en la app de la cámara.", "Actualiza el firmware.", "Si puedes, mueve las cámaras a una red de invitados/IoT aislada."],
      });
    if (ports.has(53) && d.type !== "router" && d.type !== "nas")
      add(d, {
        port: 53, level: "medium", penalty: 5,
        title: "Servidor DNS abierto en un equipo que no es router",
        why: "Un DNS abierto puede usarse para ataques de amplificación o indicar software no deseado.",
        steps: ["Comprueba si es Pi-hole/AdGuard intencionado.", "Si no lo reconoces, desinstala el servicio o bloquéalo en el firewall."],
      });
    if (ports.has(1883))
      add(d, {
        port: 1883, level: "low", penalty: 3,
        title: "MQTT sin cifrar (1883)",
        why: "Los mensajes de domótica viajan sin cifrado y a veces sin usuario.",
        steps: ["Configura usuario y contraseña en el broker MQTT.", "Usa el puerto 8883 con TLS si tus dispositivos lo soportan."],
      });
  }

  const unverified = devices.filter((d) => !d.trusted);
  if (unverified.length > 0) {
    const penalty = Math.min(15, unverified.length * 3);
    for (const d of unverified.slice(0, 5)) {
      add(d, {
        level: "low", penalty: penalty / Math.min(5, unverified.length),
        title: "Equipo sin verificar",
        why: "No has confirmado que este equipo sea tuyo.",
        steps: ["Abre la ficha y comprueba nombre, fabricante y ubicación.", "Si es tuyo, márcalo como «De confianza».", "Si no lo reconoces, cambia la contraseña del Wi-Fi."],
      });
    }
  }

  const total = findings.reduce((sum, f) => sum + f.penalty, 0);
  const score = Math.max(0, Math.round(100 - total));
  const grade = score >= 90 ? "excellent" : score >= 70 ? "good" : score >= 45 ? "risk" : "critical";
  const order: Record<RiskLevel, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  findings.sort((a, b) => order[a.level] - order[b.level]);
  return {
    score,
    grade,
    findings,
    scannedDevices: devices.filter((d) => d.servicesScannedAt).length,
    totalDevices: devices.length,
  };
}
