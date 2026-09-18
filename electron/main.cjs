// Proceso principal de NetHub portable (Electron).
// - Guarda y lee devices-db.json junto al ejecutable.
// - Escaneo ARP nativo, ping ICMP real y Wake-on-LAN por UDP.
// - Servidor HTTP de respaldo en el puerto 8765 (/scan, /ping, /wol).
const { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const http = require("node:http");
const https = require("node:https");
const dgram = require("node:dgram");
const net = require("node:net");
const { execFile, spawn } = require("node:child_process");

const DB_FILE = "devices-db.json";
const AGENT_PORT = 8765;
const isWindows = process.platform === "win32";
// Repositorios de actualización: se prueba el nuevo nombre y, si no existe,
// el antiguo (por si el repo aún no se ha renombrado).
const GITHUB_REPOS = ["oyogor1985/nethub", "oyogor1985/connected-clan"];

const UPDATE_ASSET = "NetHub.exe";
const USER_AGENT = "NetHub-Updater";


/** Carpeta del ejecutable portable (o del proyecto en desarrollo). */
function baseDir() {
  if (process.env.PORTABLE_EXECUTABLE_DIR) {
    return process.env.PORTABLE_EXECUTABLE_DIR;
  }
  return app.isPackaged ? path.dirname(app.getPath("exe")) : path.join(__dirname, "..");
}

function dbPath() {
  return path.join(baseDir(), DB_FILE);
}

/* ------------------------------------------------------------------ */
/* Persistencia                                                        */
/* ------------------------------------------------------------------ */

function readDevices() {
  try {
    return fs.existsSync(dbPath()) ? fs.readFileSync(dbPath(), "utf8") : null;
  } catch {
    return null;
  }
}

function writeDevices(json) {
  try {
    fs.writeFileSync(dbPath(), json, "utf8");
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Escaneo ARP + equipo local                                          */
/* ------------------------------------------------------------------ */

function run(cmd, args, timeout = 8000) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout, windowsHide: true }, (_err, stdout, stderr) => {
      resolve(`${stdout || ""}\n${stderr || ""}`);
    });
  });
}

function normalizeMac(mac) {
  return mac.replace(/-/g, ":").toLowerCase();
}

function connectionTagForInterfaceName(name = "") {
  const text = String(name).toLowerCase();
  if (/wi-?fi|wireless|wlan|802\.11|inal[aá]mbrica|inalambrica/.test(text)) return "Wi-Fi";
  if (/ethernet|cable|gbe|lan|realtek|intel|killer|marvell/.test(text)) return "Cableado / Ethernet";
  return null;
}

/** Interfaces IPv4 activas con su máscara, para calcular el rango a barrer. */
function activeIPv4Interfaces() {
  const result = [];
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const iface of nets[name] || []) {
      if (iface.family !== "IPv4" || iface.internal) continue;
      result.push({
        name,
        address: iface.address,
        netmask: iface.netmask || "255.255.255.0",
        mac: normalizeMac(iface.mac || ""),
        connectionTag: connectionTagForInterfaceName(name),
      });
    }
  }
  return result;
}

/** IP, MAC y tipo de conexión de la primera interfaz activa de este equipo. */
function localDevice() {
  const iface = activeIPv4Interfaces()[0];
  if (!iface) return null;
  return {
    ip: iface.address,
    mac: iface.mac,
    name: os.hostname(),
    type: "pc",
    online: true,
    tags: ["Este equipo", "Local", iface.connectionTag || "Cableado / Ethernet"],
  };
}

/** Lista de IPs a sondear (máximo /24: .1 a .254) para cada interfaz activa. */
function sweepTargets() {
  const targets = new Set();
  for (const { address, netmask } of activeIPv4Interfaces()) {
    const ipParts = address.split(".").map(Number);
    const maskParts = netmask.split(".").map(Number);
    // Solo barremos redes locales de tamaño /24 o menor (evita rangos enormes).
    if (maskParts[0] !== 255 || maskParts[1] !== 255 || maskParts[2] !== 255) {
      if (!(maskParts[0] === 255 && maskParts[1] === 255 && maskParts[2] >= 0)) continue;
    }
    const prefix = `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}`;
    for (let host = 1; host <= 254; host++) targets.add(`${prefix}.${host}`);
  }
  return [...targets];
}

/**
 * Envía un datagrama UDP a cada IP del rango: el kernel debe resolver la MAC
 * antes de enviarlo, así que emite un ARP "Who has X?" y puebla la tabla ARP.
 * Es instantáneo (fire and forget) y no necesita respuesta del dispositivo.
 */
function udpTouch(ips) {
  return new Promise((resolve) => {
    let socket;
    try {
      socket = dgram.createSocket("udp4");
    } catch {
      resolve();
      return;
    }
    socket.on("error", () => {});
    const payload = Buffer.from([0x00]);
    let index = 0;
    const BATCH = 50;
    const step = () => {
      const end = Math.min(index + BATCH, ips.length);
      for (; index < end; index++) {
        try {
          socket.send(payload, 0, payload.length, 9, ips[index], () => {});
        } catch {
          /* ignoramos IPs inalcanzables */
        }
      }
      if (index < ips.length) setTimeout(step, 12);
      else
        setTimeout(() => {
          try {
            socket.close();
          } catch {
            /* ya cerrado */
          }
          resolve();
        }, 150);
    };
    step();
  });
}

/** Sondeo TCP ligero en lotes: refuerza el ARP en equipos que ignoran el UDP. */
async function tcpTouch(ips, ports = [80, 443], timeout = 320, batch = 48) {
  for (let i = 0; i < ips.length; i += batch) {
    const slice = ips.slice(i, i + batch);
    await Promise.all(
      slice.flatMap((ip) => ports.map((port) => tcpProbe(ip, port, timeout).catch(() => null))),
    );
  }
}

/** Barrido activo de la subred para forzar que Windows rellene su tabla ARP. */
async function sweepSubnet() {
  const ips = sweepTargets();
  if (ips.length === 0) return;
  await udpTouch(ips);
  await tcpTouch(ips);
}

async function scanNetwork() {
  // 1) Barrido activo: los móviles y la domótica no hablan con el PC, así que
  //    provocamos el ARP nosotros antes de leer la tabla.
  try {
    await sweepSubnet();
  } catch {
    /* si el barrido falla seguimos con la tabla ARP existente */
  }

  // 2) Recolectamos la tabla ARP ya poblada.
  const output = await run("arp", ["-a"]);
  const hosts = [];
  const seen = new Set();
  const local = localDevice();
  if (local?.mac) seen.add(local.mac);

  const re = /(\d{1,3}(?:\.\d{1,3}){3})\s+([0-9a-fA-F]{2}(?:[:-][0-9a-fA-F]{2}){5})/g;
  let match;
  while ((match = re.exec(output))) {
    const ip = match[1];
    const mac = normalizeMac(match[2]);
    if (mac === "ff:ff:ff:ff:ff:ff" || mac.startsWith("01:00:5e") || seen.has(mac)) continue;
    if (mac === "00:00:00:00:00:00" || ip.endsWith(".255")) continue;
    seen.add(mac);
    hosts.push({ ip, mac, online: true });
  }
  if (local) hosts.push(local);
  return hosts;
}


/* ------------------------------------------------------------------ */
/* Ping ICMP                                                           */
/* ------------------------------------------------------------------ */

/** Prueba TCP: muchos equipos bloquean ICMP pero responden (o rechazan) en puertos comunes. */
function tcpProbe(ip, port, timeout = 800) {
  return new Promise((resolve) => {
    const started = Date.now();
    const socket = new net.Socket();
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(ok ? { ok: true, rtt: Math.max(1, Date.now() - started) } : null);
    };
    socket.setTimeout(timeout);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", (error) => finish(error && error.code === "ECONNREFUSED"));
    try {
      socket.connect(port, ip);
    } catch {
      finish(false);
    }
  });
}

async function tcpPing(ip) {
  const ports = [80, 443, 445, 8080, 53, 22];
  const results = await Promise.all(ports.map((port) => tcpProbe(ip, port)));
  const alive = results.filter(Boolean);
  if (!alive.length) return { ok: false, rtt: null };
  return alive.reduce((best, cur) => (cur.rtt < best.rtt ? cur : best));
}

async function pingIp(ip) {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(String(ip || ""))) return { ok: false, rtt: null };
  const args = isWindows ? ["-n", "2", "-w", "1500", ip] : ["-c", "2", "-W", "1", ip];
  const output = await run("ping", args, 6000);

  const time = output.match(/(?:tiempo|time)\s*[=<]\s*(\d+(?:[.,]\d+)?)\s*ms/i);
  if (time) return { ok: true, rtt: Math.round(Number(time[1].replace(",", "."))) };
  const avg = output.match(/(?:media|promedio|average)\s*=\s*(\d+(?:[.,]\d+)?)\s*ms/i);
  if (avg) return { ok: true, rtt: Math.round(Number(avg[1].replace(",", "."))) };
  if (/(?:tiempo|time)\s*<\s*1\s*ms/i.test(output)) return { ok: true, rtt: 1 };

  return tcpPing(ip);
}

/* ------------------------------------------------------------------ */
/* Wake-on-LAN (Magic Packet)                                          */
/* ------------------------------------------------------------------ */

function sendWol(mac) {
  return new Promise((resolve) => {
    const clean = String(mac || "").replace(/[^0-9a-fA-F]/g, "");
    if (clean.length !== 12) return resolve(false);
    const target = Buffer.from(clean, "hex");
    const packet = Buffer.alloc(102, 0xff);
    for (let i = 0; i < 16; i++) target.copy(packet, 6 + i * 6);

    const socket = dgram.createSocket("udp4");
    socket.once("error", () => {
      socket.close();
      resolve(false);
    });
    socket.bind(() => {
      socket.setBroadcast(true);
      socket.send(packet, 0, packet.length, 9, "255.255.255.255", (err) => {
        socket.close();
        resolve(!err);
      });
    });
  });
}

/* ------------------------------------------------------------------ */
/* Tráfico de red en vivo (delta por segundo → Mbps)                   */
/* ------------------------------------------------------------------ */

let lastCounters = null; // { rx, tx, at }

/** Contadores acumulados de bytes recibidos/enviados del sistema. */
async function readCounters() {
  if (isWindows) {
    const output = await run("netstat", ["-e"], 4000);
    const numbers = [];
    for (const line of output.split(/\r?\n/)) {
      const found = line.match(/(\d{3,})\s+(\d{3,})/);
      if (found) numbers.push([Number(found[1]), Number(found[2])]);
    }
    if (numbers.length === 0) return null;
    const [rx, tx] = numbers[0];
    return { rx, tx };
  }
  try {
    const content = fs.readFileSync("/proc/net/dev", "utf8");
    let rx = 0;
    let tx = 0;
    for (const line of content.split("\n").slice(2)) {
      const [name, rest] = line.split(":");
      if (!rest || name.trim() === "lo") continue;
      const cols = rest.trim().split(/\s+/).map(Number);
      rx += cols[0] || 0;
      tx += cols[8] || 0;
    }
    return { rx, tx };
  } catch {
    return null;
  }
}

async function readTraffic() {
  const counters = await readCounters();
  const now = Date.now();
  if (!counters) return { rxMbps: 0, txMbps: 0, totalMbps: 0 };

  const previous = lastCounters;
  lastCounters = { ...counters, at: now };
  if (!previous) return { rxMbps: 0, txMbps: 0, totalMbps: 0 };

  const seconds = Math.max((now - previous.at) / 1000, 0.2);
  const toMbps = (bytes) => Math.max(0, (bytes * 8) / seconds / 1_000_000);
  const rxMbps = toMbps(counters.rx - previous.rx);
  const txMbps = toMbps(counters.tx - previous.tx);
  return {
    rxMbps: Number(rxMbps.toFixed(2)),
    txMbps: Number(txMbps.toFixed(2)),
    totalMbps: Number((rxMbps + txMbps).toFixed(2)),
  };
}

/* ------------------------------------------------------------------ */
/* Actualización automática desde GitHub Releases                      */
/* ------------------------------------------------------------------ */

function currentVersion() {
  try {
    return app.getVersion();
  } catch {
    return "0.0.0";
  }
}

/** Petición HTTPS con seguimiento de redirecciones; devuelve el texto. */
function httpsText(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      { headers: { "User-Agent": USER_AGENT, Accept: "application/vnd.github+json" } },
      (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          httpsText(res.headers.location).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`GitHub respondió ${res.statusCode}`));
          return;
        }
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => resolve(body));
      },
    );
    request.on("error", reject);
    request.setTimeout(15000, () => request.destroy(new Error("Tiempo de espera agotado")));
  });
}

function normalizeVersion(value) {
  return String(value || "").trim().replace(/^v/i, "");
}

/** Compara versiones semánticas: >0 si a es mayor que b. */
function compareVersions(a, b) {
  const pa = normalizeVersion(a).split(/[.\-+]/).map((n) => Number(n) || 0);
  const pb = normalizeVersion(b).split(/[.\-+]/).map((n) => Number(n) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

async function checkUpdate() {
  const version = currentVersion();
  try {
    let raw = null;
    let lastError = null;
    for (const repo of GITHUB_REPOS) {
      try {
        raw = await httpsText(`https://api.github.com/repos/${repo}/releases/latest`);
        break;
      } catch (error) {
        lastError = error;
        raw = null;
      }
    }
    if (!raw) throw lastError || new Error("No se pudo consultar GitHub");
    const release = JSON.parse(raw);
    const latest = normalizeVersion(release.tag_name || release.name);

    const asset = (release.assets || []).find(
      (a) => String(a.name || "").toLowerCase() === UPDATE_ASSET.toLowerCase(),
    );
    return {
      ok: true,
      currentVersion: version,
      latestVersion: latest || version,
      available: Boolean(latest) && compareVersions(latest, version) > 0 && Boolean(asset),
      notes: release.body || "",
      downloadUrl: asset?.browser_download_url || null,
      size: asset?.size || 0,
      publishedAt: release.published_at || null,
    };
  } catch (error) {
    return {
      ok: false,
      currentVersion: version,
      latestVersion: version,
      available: false,
      notes: "",
      downloadUrl: null,
      size: 0,
      error: String(error?.message || error),
    };
  }
}

/** Descarga el asset informando del progreso al renderer. */
function downloadFile(url, target, total, onProgress) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { headers: { "User-Agent": USER_AGENT } }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        downloadFile(res.headers.location, target, total, onProgress).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`Descarga fallida (${res.statusCode})`));
        return;
      }
      const size = Number(res.headers["content-length"]) || total || 0;
      let received = 0;
      const file = fs.createWriteStream(target);
      res.on("data", (chunk) => {
        received += chunk.length;
        onProgress(received, size);
      });
      res.pipe(file);
      file.on("finish", () => file.close(() => resolve(true)));
      file.on("error", reject);
      res.on("error", reject);
    });
    request.on("error", reject);
    request.setTimeout(60000, () => request.destroy(new Error("Tiempo de espera agotado")));
  });
}

async function downloadAndInstall(sender) {
  const info = await checkUpdate();
  if (!info.available || !info.downloadUrl) {
    return { ok: false, error: info.error || "No hay ninguna actualización disponible." };
  }

  const temp = path.join(os.tmpdir(), "NetHub-update.exe");
  try {
    if (fs.existsSync(temp)) fs.unlinkSync(temp);
    await downloadFile(info.downloadUrl, temp, info.size, (received, size) => {
      const percent = size > 0 ? Math.min(100, Math.round((received / size) * 100)) : 0;
      try {
        sender?.send("nethub:update-progress", { received, total: size, percent });
      } catch {
        /* ventana cerrada */
      }
    });
  } catch (error) {
    return { ok: false, error: String(error?.message || error) };
  }

  const targetExe = process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;
  const script = path.join(os.tmpdir(), "nethub-update.bat");
  const content = `@echo off\r\ntimeout /t 1 /nobreak >nul\r\nmove /y "${temp}" "${targetExe}" >nul\r\nstart "" "${targetExe}"\r\n`;
  try {
    fs.writeFileSync(script, content, "utf8");
    spawn("cmd.exe", ["/c", script], { detached: true, windowsHide: true, stdio: "ignore" }).unref();
  } catch (error) {
    return { ok: false, error: String(error?.message || error) };
  }

  setTimeout(() => app.quit(), 400);
  return { ok: true, version: info.latestVersion, restarting: true };
}

/* ------------------------------------------------------------------ */
/* IPC                                                                 */
/* ------------------------------------------------------------------ */

ipcMain.handle("nethub:read", () => readDevices());
ipcMain.handle("nethub:write", (_e, json) => writeDevices(json));
ipcMain.handle("nethub:scan", () => scanNetwork());
ipcMain.handle("nethub:path", () => dbPath());
ipcMain.handle("nethub:ping", (_e, ip) => pingIp(ip));
ipcMain.handle("nethub:wol", (_e, mac) => sendWol(mac));
ipcMain.handle("nethub:traffic", () => readTraffic());
ipcMain.handle("nethub:check-update", () => checkUpdate());
ipcMain.handle("nethub:download-and-install", (event) => downloadAndInstall(event.sender));


/* ------------------------------------------------------------------ */
/* Servidor HTTP de respaldo (compatibilidad con el agente local)      */
/* ------------------------------------------------------------------ */

function startAgentServer() {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://localhost:${AGENT_PORT}`);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    if (req.method === "OPTIONS") {
      res.writeHead(204).end();
      return;
    }
    try {
      if (url.pathname === "/scan") {
        res.end(JSON.stringify(await scanNetwork()));
        return;
      }
      if (url.pathname === "/ping") {
        res.end(JSON.stringify(await pingIp(url.searchParams.get("ip"))));
        return;
      }
      if (url.pathname === "/traffic") {
        res.end(JSON.stringify(await readTraffic()));
        return;
      }
      if (url.pathname === "/wol") {
        res.end(JSON.stringify({ ok: await sendWol(url.searchParams.get("mac")) }));
        return;
      }
      res.writeHead(404).end(JSON.stringify({ error: "not found" }));
    } catch (error) {
      res.writeHead(500).end(JSON.stringify({ error: String(error) }));
    }
  });
  server.on("error", () => {
    /* puerto ocupado: la app sigue funcionando con IPC */
  });
  server.listen(AGENT_PORT, "127.0.0.1");
}

/* ------------------------------------------------------------------ */
/* Ventana                                                             */
/* ------------------------------------------------------------------ */

/** Raíces posibles de la app compilada, en orden de preferencia. */
function staticRoots() {
  const roots = [];
  let appPath = "";
  try {
    appPath = app.getAppPath();
  } catch {
    appPath = "";
  }
  const bases = [
    path.join(__dirname, ".."),
    appPath,
    process.resourcesPath || "",
    path.join(process.resourcesPath || "", "app"),
    path.join(process.resourcesPath || "", "app.asar"),
  ];
  for (const base of bases) {
    if (!base) continue;
    roots.push(
      path.join(base, "dist", "client"),
      path.join(base, "dist"),
      path.join(base, ".output", "public"),
    );
  }
  return roots;
}

/**
 * Si existe la carpeta compilada pero falta index.html (build sin prerender),
 * genera uno mínimo enlazando los bundles encontrados en assets/.
 */
function ensureIndexHtml(dir) {
  try {
    const indexFile = path.join(dir, "index.html");
    if (fs.existsSync(indexFile)) return true;
    if (!fs.existsSync(dir)) return false;
    const assetsDir = path.join(dir, "assets");
    if (!fs.existsSync(assetsDir)) return false;
    const files = fs.readdirSync(assetsDir);
    const js = files.filter((f) => f.endsWith(".js") && /^(index|client|main|entry)/i.test(f));
    const css = files.filter((f) => f.endsWith(".css"));
    if (!js.length) return false;
    const html = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>NetHub</title>
${css.map((f) => `    <link rel="stylesheet" href="/assets/${f}" />`).join("\n")}
  </head>
  <body>
    <div id="root"></div>
${js.map((f) => `    <script type="module" src="/assets/${f}"></script>`).join("\n")}
  </body>
</html>
`;
    fs.writeFileSync(indexFile, html, "utf8");
    return true;
  } catch {
    return false;
  }
}

function resolveStaticRoot() {
  const roots = staticRoots();
  const direct = roots.find((dir) => fs.existsSync(path.join(dir, "index.html")));
  if (direct) return direct;
  return roots.find((dir) => ensureIndexHtml(dir)) || null;
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

/**
 * Servidor de estáticos interno en un puerto efímero de localhost:
 * la app portable funciona sin vite, sin red y sin nada instalado.
 */
function startStaticServer(root) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let pathname = "/";
      try {
        pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
      } catch {
        pathname = "/";
      }
      const safe = path.normalize(pathname).replace(/^(\.\.[/\\])+/, "");
      let file = path.join(root, safe);
      if (!file.startsWith(root)) file = path.join(root, "index.html");
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
        file = path.join(file, "index.html");
      }
      if (!fs.existsSync(file)) file = path.join(root, "index.html"); // SPA fallback
      try {
        res.writeHead(200, {
          "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream",
        });
        res.end(fs.readFileSync(file));
      } catch {
        res.writeHead(500);
        res.end("Error interno");
      }
    });
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve(`http://127.0.0.1:${port}/`);
    });
    server.on("error", () => resolve(null));
  });
}

/** Pantalla amigable si faltan los archivos compilados. */
function fallbackPage() {
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>NetHub</title><style>
body{margin:0;height:100vh;display:grid;place-items:center;background:#0b1120;color:#e2e8f0;
font-family:system-ui,-apple-system,Segoe UI,sans-serif;text-align:center;padding:2rem}
h1{font-size:1.4rem;margin:0 0 .5rem}p{color:#94a3b8;max-width:34rem;line-height:1.6}
code{background:#1e293b;padding:.15rem .4rem;border-radius:.35rem}
button{margin-top:1.5rem;padding:.6rem 1.2rem;border:0;border-radius:.6rem;background:#2563eb;color:#fff;font-size:.95rem;cursor:pointer}
</style></head><body><div><h1>No se han encontrado los archivos de NetHub</h1>
<p>Falta la carpeta compilada de la aplicación. Ejecuta <code>construir-exe.bat</code>
(o <code>npm run build</code>) en la carpeta del proyecto y vuelve a abrir NetHub.</p>
<button onclick="location.reload()">Reintentar</button></div></body></html>`;
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}


/* ------------------------------------------------------------------ */
/* Icono en el área de notificación (bandeja del sistema)              */
/* ------------------------------------------------------------------ */

let tray = null;
let mainWindow = null;
/** true solo cuando el usuario elige «Salir»: permite cerrar de verdad. */
let quitting = false;

function iconPath(file) {
  let appPath = "";
  try {
    appPath = app.getAppPath();
  } catch {
    appPath = "";
  }
  const names = file === "favicon.ico" ? ["favicon.ico", "app-icon.png"] : [file, "favicon.ico"];
  const bases = [
    path.join(__dirname, "..", "public"),
    path.join(__dirname, "..", "dist", "client"),
    path.join(__dirname, "..", "dist"),
    appPath ? path.join(appPath, "public") : "",
    appPath ? path.join(appPath, "dist", "client") : "",
    appPath ? path.join(appPath, "dist") : "",
    path.join(process.resourcesPath || "", "app", "public"),
    path.join(process.resourcesPath || "", "app", "dist", "client"),
    path.join(process.resourcesPath || "", "app", "dist"),
    path.join(process.resourcesPath || "", "app.asar", "public"),
    path.join(process.resourcesPath || "", "app.asar", "dist", "client"),
    path.join(process.resourcesPath || "", "app.asar", "dist"),
  ];
  for (const base of bases) {
    if (!base) continue;
    for (const name of names) {
      const candidate = path.join(base, name);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return path.join(__dirname, "..", "public", file);
}

function trayIconImage() {
  const candidates = [
    iconPath("favicon.ico"),
    iconPath("app-icon.png"),
    iconPath("favicon.png"),
  ];
  for (const candidate of candidates) {
    const image = nativeImage.createFromPath(candidate);
    if (!image.isEmpty()) return isWindows ? image.resize({ width: 16, height: 16 }) : image;
  }
  const fallback = nativeImage.createEmpty();
  return fallback;
}

function showWindow() {
  if (!mainWindow) {
    mainWindow = createWindow();
    void loadApp(mainWindow);
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function createTray() {
  if (tray) return tray;
  const image = trayIconImage();
  try {
    tray = new Tray(image);
  } catch {
    return null;
  }
  tray.setToolTip("NetHub · monitor de red doméstica");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Abrir NetHub", click: () => showWindow() },
      {
        label: "Escanear ahora",
        click: () => {
          showWindow();
          mainWindow?.webContents.send("nethub:scan-now");
          void scanNetwork().catch(() => null);
        },
      },
      { type: "separator" },
      {
        label: "Salir",
        click: () => {
          quitting = true;
          app.quit();
        },
      },
    ]),
  );
  tray.on("double-click", () => showWindow());
  tray.on("click", () => showWindow());
  return tray;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1520,
    height: 920,
    minWidth: 1024,
    minHeight: 680,
    center: true,
    backgroundColor: "#0b1120",
    title: "NetHub",
    icon: iconPath(isWindows ? "favicon.ico" : "app-icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Minimizar o cerrar deja NetHub en la bandeja: el auto-escaneo y los avisos siguen activos.
  win.on("minimize", (event) => {
    if (!tray) return;
    event.preventDefault();
    win.hide();
  });

  win.on("close", (event) => {
    if (quitting || !tray) return;
    event.preventDefault();
    win.hide();
  });

  mainWindow = win;
  return win;
}

async function loadApp(win) {
  const devUrl = process.env.NETHUB_DEV_URL;
  if (devUrl) {
    await win.loadURL(devUrl).catch(() => win.loadURL(fallbackPage()));
    return;
  }

  const root = resolveStaticRoot();
  if (root) {
    const url = await startStaticServer(root);
    if (url) {
      await win.loadURL(url).catch(() => win.loadFile(path.join(root, "index.html")));
      return;
    }
    await win.loadFile(path.join(root, "index.html")).catch(() => win.loadURL(fallbackPage()));
    return;
  }

  // Último recurso en desarrollo: servidor de vite; si no responde, pantalla amigable.
  try {
    await win.loadURL("http://localhost:8080");
  } catch {
    await win.loadURL(fallbackPage());
  }
}

app.whenReady().then(async () => {
  startAgentServer();
  createTray();
  const win = createWindow();
  await loadApp(win);
  app.on("activate", () => showWindow());
});

app.on("before-quit", () => {
  quitting = true;
});

app.on("window-all-closed", () => {
  // Con icono en la bandeja NetHub sigue trabajando en segundo plano.
  if (!tray && process.platform !== "darwin") app.quit();
});
