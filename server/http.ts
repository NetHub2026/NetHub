import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { createConnection } from "node:net";
import { createSocket } from "node:dgram";
import { Authentication } from "./auth";
import { Monitor } from "./monitor";
import { inSubnet, privateIp, ping } from "./network";
import type { MergeChoices } from "../src/lib/device-unification";
type Options = {
  password: string;
  staticDirectory: string;
  secureCookies?: boolean;
  allowedHosts?: string[];
};
async function body(req: IncomingMessage, limit = 64 * 1024): Promise<Record<string, unknown>> {
  let length = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    length += chunk.length;
    if (length > limit)
      throw Object.assign(new Error("Solicitud demasiado grande."), { status: 413 });
    chunks.push(chunk);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString() || "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value;
  } catch {
    throw new Error("Solicitud no válida.");
  }
}
const string = (value: unknown) => {
  if (typeof value !== "string" || value.length > 400) throw new Error("Valor no válido.");
  return value;
};
export function createHttpServer(monitor: Monitor, options: Options) {
  const authentication = new Authentication(options.password);
  const root = resolve(options.staticDirectory);
  const json = (res: ServerResponse, status: number, value: unknown) => {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(value));
  };
  return createServer(
    { requestTimeout: 10000, headersTimeout: 10000, maxHeaderSize: 8192 },
    async (req, res) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Referrer-Policy", "no-referrer");
      res.setHeader("Cache-Control", "no-store");
      res.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
      );
      try {
        const host = (req.headers.host ?? "").toLowerCase();
        const hostname = host.replace(/:\d+$/, "");
        if (
          !privateIp(hostname) &&
          !["localhost", "127.0.0.1", "[::1]", ...(options.allowedHosts ?? [])].includes(hostname)
        )
          throw Object.assign(
            new Error(
              "Nombre de servidor no permitido. Configura NETHUB_ALLOWED_HOSTS para utilizar este nombre.",
            ),
            { status: 403 },
          );
        const url = new URL(req.url ?? "/", `http://${host}`);
        const unsafe = !["GET", "HEAD"].includes(req.method ?? "GET");
        if (
          unsafe &&
          req.headers.origin &&
          req.headers.origin !== `${options.secureCookies ? "https" : "http"}://${host}`
        )
          throw Object.assign(new Error("Origen de solicitud no permitido."), { status: 403 });
        if (url.pathname === "/healthz" && req.method === "GET")
          return json(res, 200, { ok: true });
        if (url.pathname === "/api/login" && req.method === "POST") {
          const input = await body(req);
          let session;
          try {
            session = authentication.login(
              input["password"],
              req.socket.remoteAddress ?? "unknown",
            );
          } catch (error) {
            return json(res, 429, { error: (error as Error).message });
          }
          if (!session) return json(res, 401, { error: "Contraseña incorrecta." });
          res.setHeader(
            "Set-Cookie",
            `nethub_session=${session.token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${options.secureCookies ? "; Secure" : ""}`,
          );
          return json(res, 200, { csrf: session.csrf });
        }
        const session = authentication.session(req.headers.cookie);
        if (url.pathname.startsWith("/api/")) {
          if (!session) return json(res, 401, { error: "Inicia sesión para acceder al servidor." });
          if (unsafe && req.headers["x-nethub-csrf"] !== session.csrf)
            return json(res, 403, {
              error: "Sesión de edición no válida. Vuelve a iniciar sesión.",
            });
          if (req.method === "GET" && url.pathname === "/api/session")
            return json(res, 200, { csrf: session.csrf });
          if (req.method === "GET" && url.pathname === "/api/state")
            return json(res, 200, monitor.snapshot());
          if (req.method === "GET" && url.pathname === "/api/export") {
            res.setHeader(
              "Content-Disposition",
              'attachment; filename="nethub-server-backup.json"',
            );
            return json(res, 200, monitor.state);
          }
          if (req.method !== "POST") return json(res, 405, { error: "Método no permitido." });
          const input = await body(
            req,
            url.pathname === "/api/import" ? 10 * 1024 * 1024 : 64 * 1024,
          );
          if (url.pathname === "/api/import") {
            await monitor.importData(input["data"]);
          } else if (url.pathname === "/api/logout") {
            authentication.logout(session.token);
            res.setHeader(
              "Set-Cookie",
              `nethub_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${options.secureCookies ? "; Secure" : ""}`,
            );
            return json(res, 200, { ok: true });
          }
          if (url.pathname === "/api/scan") await monitor.scan();
          else if (url.pathname === "/api/device") {
            if (
              !input["changes"] ||
              typeof input["changes"] !== "object" ||
              !input["expected"] ||
              typeof input["expected"] !== "object"
            )
              throw new Error("Cambios no válidos.");
            await monitor.editDevice(
              string(input["id"]),
              input["changes"] as Record<string, unknown>,
              input["expected"] as Record<string, unknown>,
            );
          } else if (url.pathname === "/api/unify") {
            const choices = (input["choices"] ?? {}) as MergeChoices;
            if (
              Object.entries(choices).some(
                ([k, v]) =>
                  !["name", "vendor", "type", "person", "location"].includes(k) ||
                  !["primary", "other"].includes(v),
              )
            )
              throw new Error("Elección no válida.");
            await monitor.unify(string(input["id"]), string(input["otherId"]), choices);
          } else if (url.pathname === "/api/separate") await monitor.separate(string(input["id"]));
          else if (url.pathname === "/api/remove") await monitor.remove(string(input["id"]));
          else if (url.pathname === "/api/review") {
            if (typeof input["reviewed"] !== "boolean") throw new Error("Revisión no válida.");
            await monitor.review(string(input["id"]), input["reviewed"]);
          } else if (url.pathname === "/api/settings") await monitor.settings(input);
          else if (url.pathname === "/api/directory") {
            if (!["people", "locations"].includes(String(input["kind"])))
              throw new Error("Directorio no válido.");
            await monitor.directory(
              input["kind"] as "people" | "locations",
              input["previous"] === null ? null : string(input["previous"]),
              string(input["replacement"]),
            );
          } else if (url.pathname === "/api/clear-events")
            await monitor.mutate((draft) => {
              draft.events = [];
            });
          else if (url.pathname === "/api/backup") await monitor.store.backup();
          else if (url.pathname === "/api/speed") {
            if (monitor.speedRunning)
              return json(res, 409, { error: "Ya hay una prueba en curso." });
            if (monitor.options.demo)
              return json(res, 400, { error: "Pruebas reales desactivadas en la demostración." });
            void monitor.speed().catch(() => {});
            return json(res, 202, { ok: true });
          } else if (url.pathname === "/api/ping") {
            const ip = knownIp(monitor, input["ip"]);
            return json(res, 200, monitor.options.demo ? { ok: true, rtt: 12 } : await ping(ip));
          } else if (url.pathname === "/api/ports") {
            const ip = knownIp(monitor, input["ip"]);
            const ports = input["ports"];
            if (
              !Array.isArray(ports) ||
              ports.length > 30 ||
              ports.some((p) => !Number.isInteger(p) || p < 1 || p > 65535)
            )
              throw new Error("Puertos no válidos.");
            return json(
              res,
              200,
              monitor.options.demo
                ? ports.map((port) => ({ port, open: false, rtt: null }))
                : await Promise.all(ports.map((port) => probePort(ip, port))),
            );
          } else if (url.pathname === "/api/wol") {
            const id = string(input["id"]);
            const device = monitor.state.devices.find((d) => d.id === id);
            const network = monitor.selectedNetwork();
            if (!device || !network || !inSubnet(device.ip, network.cidr))
              throw new Error("Dispositivo fuera de la red seleccionada.");
            if (monitor.options.demo)
              return json(res, 400, { error: "Wake-on-LAN desactivado en la demostración." });
            await wol(device.mac, network.cidr);
            return json(res, 200, { ok: true });
          } else return json(res, 404, { error: "Acción no disponible." });
          return json(res, 200, monitor.snapshot());
        }
        if (!["GET", "HEAD"].includes(req.method ?? ""))
          return json(res, 405, { error: "Método no permitido." });
        const pathname = decodeURIComponent(url.pathname);
        const file = resolve(root, "." + (pathname === "/" ? "/index.html" : pathname));
        if (file !== root && !file.startsWith(root + sep))
          return json(res, 403, { error: "Ruta no permitida." });
        try {
          if (!(await stat(file)).isFile()) throw new Error();
          const types: Record<string, string> = {
            ".html": "text/html; charset=utf-8",
            ".js": "text/javascript; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".png": "image/png",
            ".ico": "image/x-icon",
            ".svg": "image/svg+xml",
            ".woff2": "font/woff2",
          };
          res.setHeader("Content-Type", types[extname(file)] ?? "application/octet-stream");
          res.end(req.method === "HEAD" ? undefined : await readFile(file));
        } catch {
          return json(res, 404, { error: "Archivo no encontrado." });
        }
      } catch (error) {
        const status = (error as { status?: number }).status ?? 400;
        return json(res, status, { error: (error as Error).message });
      }
    },
  );
}
function knownIp(monitor: Monitor, value: unknown) {
  const ip = string(value),
    network = monitor.selectedNetwork();
  if (
    !network ||
    !inSubnet(ip, network.cidr) ||
    !monitor.state.devices.some((d) => d.ip === ip || d.networkEntries?.some((e) => e.ip === ip))
  )
    throw new Error("El destino debe ser un dispositivo del inventario en la red seleccionada.");
  return ip;
}
function probePort(
  ip: string,
  port: number,
): Promise<{ port: number; open: boolean; rtt: number | null }> {
  return new Promise((resolve) => {
    const start = performance.now();
    const socket = createConnection({ host: ip, port });
    let done = false;
    const finish = (open: boolean) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve({ port, open, rtt: open ? Math.round(performance.now() - start) : null });
    };
    socket.setTimeout(1000, () => finish(false));
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
  });
}
function wol(mac: string, cidr: string): Promise<void> {
  if (!/^[0-9a-f]{2}(?::[0-9a-f]{2}){5}$/i.test(mac)) throw new Error("MAC no válida.");
  const address =
    cidr
      .split("/")[0]!
      .split(".")
      .reduce((n, p) => (n << 8) | Number(p), 0) >>> 0;
  const bits = Number(cidr.split("/")[1]);
  const mask = (0xffffffff << (32 - bits)) >>> 0;
  const value = (address | ~mask) >>> 0;
  const broadcast = [24, 16, 8, 0].map((shift) => (value >>> shift) & 255).join(".");
  const bytes = Buffer.from(mac.replace(/:/g, ""), "hex");
  const packet = Buffer.concat([Buffer.alloc(6, 255), ...Array.from({ length: 16 }, () => bytes)]);
  return new Promise((resolve, reject) => {
    const socket = createSocket("udp4");
    let done = false;
    const timer = setTimeout(() => finish(new Error("Tiempo de espera agotado.")), 3000);
    const finish = (error?: Error | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try {
        socket.close();
      } catch {}
      error ? reject(error) : resolve();
    };
    socket.once("error", finish);
    socket.bind(() => {
      try {
        socket.setBroadcast(true);
        socket.send(packet, 9, broadcast, finish);
      } catch (error) {
        finish(error as Error);
      }
    });
  });
}
