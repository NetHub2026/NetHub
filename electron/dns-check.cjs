/** Construye un paquete DNS de consulta A sin dependencias externas. */
function buildDnsQuery(id, domain) {
  const labels = String(domain)
    .split(".")
    .filter(Boolean)
    .map((l) => Buffer.from(l, "ascii"));
  const qname = Buffer.concat([
    ...labels.map((l) => Buffer.concat([Buffer.from([l.length]), l])),
    Buffer.from([0]),
  ]);
  const header = Buffer.alloc(12);
  header.writeUInt16BE(id & 0xffff, 0);
  header.writeUInt16BE(0x0100, 2); // recursión deseada
  header.writeUInt16BE(1, 4); // 1 pregunta
  const tail = Buffer.alloc(4);
  tail.writeUInt16BE(1, 0); // tipo A
  tail.writeUInt16BE(1, 2); // clase IN
  return Buffer.concat([header, qname, tail]);
}

/** Salta un nombre de DNS (soporta punteros de compresión 0xc0). */
function skipDnsName(buf, offset) {
  let ptr = offset;
  while (ptr < buf.length) {
    const len = buf[ptr];
    if (len === 0) return ptr + 1;
    if ((len & 0xc0) === 0xc0) return ptr + 2;
    ptr += len + 1;
  }
  return ptr;
}

/** Extrae las direcciones IPv4 de una respuesta DNS. */
function parseDnsAnswer(buf) {
  const rcode = buf.length > 3 ? buf[3] & 0x0f : 1;
  const ips = [];
  try {
    let ancount = buf.readUInt16BE(6);
    let ptr = skipDnsName(buf, 12);
    ptr += 4; // tipo + clase de la pregunta
    while (ancount-- > 0 && ptr + 12 <= buf.length) {
      ptr = skipDnsName(buf, ptr);
      const type = buf.readUInt16BE(ptr);
      const rdlength = buf.readUInt16BE(ptr + 8);
      const rdstart = ptr + 10;
      if (type === 1 && rdlength === 4 && rdstart + 4 <= buf.length) {
        ips.push(`${buf[rdstart]}.${buf[rdstart + 1]}.${buf[rdstart + 2]}.${buf[rdstart + 3]}`);
      }
      ptr = rdstart + rdlength;
    }
  } catch {
    /* respuesta malformada: se devuelven las IP encontradas */
  }
  return { rcode, ips };
}

/** Consulta DNS UDP directa con timeout. */
function createDnsChecker(lanTarget, createSocket = require("node:dgram").createSocket) {
const PUBLIC_DNS = "8.8.8.8";

function dnsQuery(rawServer, domain, timeout = 1500) {
  const serverIp = rawServer === PUBLIC_DNS ? PUBLIC_DNS : lanTarget(rawServer);
  return new Promise((resolve) => {
    if (!serverIp) return resolve({ ok: false, ips: [], rtt: null });
    const id = Math.floor(Math.random() * 0xffff);
    const query = buildDnsQuery(id, domain);
    const socket = createSocket("udp4");
    const started = Date.now();
    let settled = false;
    const timer = setTimeout(() => finish({ ok: false, ips: [], rtt: null }), timeout);
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        socket.close();
      } catch {
        /* ya cerrado */
      }
      resolve(result);
    };
    socket.on("message", (msg, peer) => {
      if (settled || peer.address !== serverIp || peer.port !== 53 || msg.length < 12 || msg.readUInt16BE(0) !== id || !(msg[2] & 0x80) || (msg[2] & 0x02)) return;
      const rtt = Date.now() - started;
      const { rcode, ips } = parseDnsAnswer(msg);
      finish({ ok: rcode === 0 && ips.length > 0, ips, rtt });
    });
    socket.once("error", () => finish({ ok: false, ips: [], rtt: null }));
    try {
      socket.send(query, 53, serverIp, (err) => {
        if (err) finish({ ok: false, ips: [], rtt: null });
      });
    } catch { finish({ ok: false, ips: [], rtt: null }); }
  });
}

async function dnsCheck(gatewayIp, domain) {
  const clean = String(domain || "www.google.com")
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, "");
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(clean)) {
    return { ok: false, error: "Dominio no válido." };
  }
  const gw = lanTarget(gatewayIp);
  if (!gw) {
    return { ok: false, domain: clean, error: "No se conoce la IP del router; escanea la red primero." };
  }
  const [local, pub] = await Promise.all([dnsQuery(gw, clean), dnsQuery(PUBLIC_DNS, clean)]);
  const common = local.ips.filter((ip) => pub.ips.includes(ip));
  const hijacked =
    local.ok && pub.ok && local.ips.length > 0 && pub.ips.length > 0 && common.length === 0;
  return {
    ok: local.ok && pub.ok,
    ...(!local.ok || !pub.ok ? { error: !local.ok && !pub.ok ? "Ninguno de los servidores DNS respondió con direcciones IPv4. Puede haber un bloqueo de consultas UDP o un tiempo de espera agotado." : !local.ok ? "El router no respondió con direcciones IPv4. Puede que no actúe como servidor DNS; no se puede comparar." : "8.8.8.8 no respondió con direcciones IPv4. Puede estar bloqueado o no disponible; no se puede comparar." } : {}),
    domain: clean,
    gateway: gw,
    gatewayIps: local.ips,
    publicIps: pub.ips,
    gatewayRtt: local.rtt,
    hijacked,
  };
}


return { dnsQuery, dnsCheck };
}
module.exports = { createDnsChecker, buildDnsQuery };
