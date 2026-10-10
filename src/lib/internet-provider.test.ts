import { describe, expect, it } from "vitest";
import { parseInternetProvider, providerLogo } from "./internet-provider";
import { sanitizeSettings } from "./settings";

describe("Proveedor de Internet", () => {
  it("acepta datos válidos y campos opcionales ausentes", () => {
    expect(parseInternetProvider({ success: true, ip: "203.0.113.42", connection: { isp: " Example Telecom ", asn: 64500 }, city: "Example City", country: "Example Country", timezone: { id: "Etc/UTC" } })).toEqual({ name: "Example Telecom", domain: "", asn: 64500, ip: "203.0.113.42", hostname: "", location: "Example City, Example Country", timezone: "Etc/UTC" });
  });
  it("rechaza errores y no usa dominios arbitrarios como logos", () => {
    expect(parseInternetProvider({ success: false })).toBeNull();
    expect(parseInternetProvider({ success: true, connection: { org: "Example" } })).toBeNull();
    expect(providerLogo("Example Telecom")).toBeNull();
    expect(providerLogo("Telefonica de Espana")).toBeNull();
    expect(providerLogo("Vodafone España")).toBe("https://www.vodafone.es/c/statics/maestro/logo_vodafone.png");
  });
  it("conserva un operador manual de versiones anteriores", () => {
    expect(sanitizeSettings({ ispName: "Example Telecom" }).ispAuto).toBe(false);
    expect(sanitizeSettings({ ispName: "tu operador" }).ispAuto).toBe(true);
    expect(sanitizeSettings({ ispName: "Example Telecom", ispAuto: true }).ispAuto).toBe(true);
  });
});
