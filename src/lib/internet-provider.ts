export interface InternetProvider { name: string; domain: string; asn: number | null; ip: string; hostname: string; location: string; timezone: string }

export function parseInternetProvider(raw: unknown): InternetProvider | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  if (data["success"] !== true || !data["connection"] || typeof data["connection"] !== "object") return null;
  const connection = data["connection"] as Record<string, unknown>;
  const name = typeof connection["isp"] === "string" ? connection["isp"].trim().slice(0, 120) : "";
  if (!name) return null;
  const domain = typeof connection["domain"] === "string" ? connection["domain"].toLowerCase().trim() : "";
  const text = (value: unknown) => typeof value === "string" ? value.trim().slice(0, 160) : "";
  const timezone = data["timezone"] && typeof data["timezone"] === "object" ? text((data["timezone"] as Record<string, unknown>)["id"]) : "";
  return { name, domain: /^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain) ? domain : "", asn: typeof connection["asn"] === "number" && Number.isSafeInteger(connection["asn"]) && connection["asn"] > 0 ? connection["asn"] : null,
    ip: text(data["ip"]), hostname: text(data["hostname"]), location: [data["city"], data["region"], data["country"]].map(text).filter(Boolean).join(", "), timezone };
}

// Only explicit brands are mapped. A wholesale network does not prove a retail brand.
export function providerLogo(name: string): string | null {
  if (/\bvodafone\b/i.test(name)) return "https://www.vodafone.es/c/statics/maestro/logo_vodafone.png";
  const brands: Array<[RegExp, string]> = [
    [/\bvodafone\b/i, "www.vodafone.es"], [/\bmovistar\b/i, "www.movistar.es"],
    [/\bdigi\b/i, "www.digimobil.es"], [/\borange\b/i, "www.orange.es"],
    [/\bjazztel\b/i, "www.jazztel.com"], [/\byoigo\b/i, "www.yoigo.com"],
    [/\bpepephone\b/i, "www.pepephone.com"], [/\bo2\b/i, "o2online.es"],
    [/\beuskaltel\b/i, "www.euskaltel.com"], [/\bmasmovil\b/i, "www.masmovil.es"],
  ];
  const domain = brands.find(([pattern]) => pattern.test(name))?.[1];
  return domain ? `https://${domain}/favicon.ico` : null;
}
