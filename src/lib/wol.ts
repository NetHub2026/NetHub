import { nativeWol } from "./desktop";
import type { DeviceType } from "./devices";
import { AGENT_BASE } from "./ping";

/** Tipos que normalmente admiten encendido remoto por Wake-on-LAN. */
const wolTypes: DeviceType[] = ["pc", "console", "tv", "router", "printer", "other"];

export function supportsWol(type: DeviceType): boolean {
  return wolTypes.includes(type);
}

export interface WolResult {
  ok: boolean;
  message: string;
}

export async function wakeDevice(mac: string): Promise<WolResult> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(`${AGENT_BASE}/wol?mac=${encodeURIComponent(mac)}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timer);
    if (res.ok) {
      return {
        ok: true,
        message: "Magic Packet enviado por el agente local (UDP 9). El equipo puede tardar unos segundos en arrancar.",
      };
    }
  } catch {
    /* sin agente: probamos con el envío nativo */
  }

  if (await nativeWol(mac)) {
    return {
      ok: true,
      message: "Magic Packet enviado desde la app portable (UDP 9). El equipo puede tardar unos segundos en arrancar.",
    };
  }

  return {
    ok: false,
    message:
      "No se ha podido enviar el Magic Packet. Inicia el agente local o abre NetHub como app portable; además el equipo debe tener Wake-on-LAN activado en la BIOS y en el adaptador de red.",
  };
}
