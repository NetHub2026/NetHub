// Proceso principal de NetHub portable (Electron).
// - Guarda y lee devices-db.json junto al ejecutable.
// - Escaneo ARP nativo, ping ICMP real y Wake-on-LAN por UDP.
// - Servidor HTTP de respaldo en el puerto 8765 (/scan, /ping, /wol).
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const http = require("node:http");
const dgram = require("node:dgram");
const { execFile } = require("node:child_process");

const DB_FILE = "devices-db.json";
const AGENT_PORT = 8765;
const isWindows = process.platform === "win32";

/** Carpeta del ejecutable portable (o del proyecto en desarrollo). */
function baseDir() {
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

/** IP y MAC de la primera interfaz activa de este equipo. */
function localDevice() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family !== "IPv4" || net.internal) continue;
      return {
        ip: net.address,
        mac: normalizeMac(net.mac || ""),
        name: os.hostname(),
        type: "pc",
        online: true,
        tags: ["Este equipo", "Local"],
      };
    }
  }
  return null;
}

async function scanNetwork() {
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
    seen.add(mac);
    hosts.push({ ip, mac, online: true });
  }
  if (local) hosts.push(local);
  return hosts;
}

/* ------------------------------------------------------------------ */
/* Ping ICMP                                                           */
/* ------------------------------------------------------------------ */

async function pingIp(ip) {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(String(ip || ""))) return { ok: false, rtt: null };
  const args = isWindows ? ["-n", "1", "-w", "1000", ip] : ["-c", "1", "-W", "1", ip];
  const output = await run("ping", args, 4000);
  const m = output.match(/(?:tiempo|time)[=<]\s*(\d+(?:[.,]\d+)?)\s*ms/i);
  if (m) return { ok: true, rtt: Math.round(Number(m[1].replace(",", "."))) };
  return { ok: false, rtt: null };
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
/* IPC                                                                 */
/* ------------------------------------------------------------------ */

ipcMain.handle("nethub:read", () => readDevices());
ipcMain.handle("nethub:write", (_e, json) => writeDevices(json));
ipcMain.handle("nethub:scan", () => scanNetwork());
ipcMain.handle("nethub:path", () => dbPath());
ipcMain.handle("nethub:ping", (_e, ip) => pingIp(ip));
ipcMain.handle("nethub:wol", (_e, mac) => sendWol(mac));
ipcMain.handle("nethub:traffic", () => readTraffic());

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
  for (const base of [path.join(__dirname, ".."), process.resourcesPath || "", path.join(process.resourcesPath || "", "app")]) {
    if (!base) continue;
    roots.push(
      path.join(base, "dist", "client"),
      path.join(base, "dist"),
      path.join(base, ".output", "public"),
    );
  }
  return roots;
}

function resolveStaticRoot() {
  return staticRoots().find((dir) => fs.existsSync(path.join(dir, "index.html"))) || null;
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


function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#0b1120",
    title: "NetHub",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

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
  const win = createWindow();
  await loadApp(win);
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
