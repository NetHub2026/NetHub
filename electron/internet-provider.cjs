const https = require("node:https");
const dns = require("node:dns");
const net = require("node:net");
let pending = null;
let cached = null;
let cachedAt = 0;

function detectInternetProvider() {
  if (cached && Date.now() - cachedAt < 60_000) return Promise.resolve(cached);
  if (pending) return pending;
  pending = new Promise((resolve) => {
    const request = https.get("https://ipwho.is/?fields=success,ip,connection,city,region,country,timezone.id", { headers: { "User-Agent": "NetHub" } }, (response) => {
      if (response.statusCode !== 200) { response.resume(); resolve(null); return; }
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { body += chunk; if (body.length > 16_384) request.destroy(new Error("Response too large")); });
      response.on("error", () => resolve(null));
      response.on("end", () => { try { resolve(JSON.parse(body)); } catch { resolve(null); } });
    });
    request.setTimeout(8000, () => request.destroy(new Error("Timeout")));
    request.on("error", () => resolve(null));
  }).then(async (result) => {
    if (result?.success === true) {
      if (net.isIP(result.ip)) {
        const resolver = new dns.promises.Resolver({ timeout: 2000, tries: 1 });
        try { result.hostname = (await resolver.reverse(result.ip))[0] || ""; } catch { result.hostname = ""; }
      }
      cached = result; cachedAt = Date.now();
    }
    return result;
  }).finally(() => { pending = null; });
  return pending;
}
module.exports = { detectInternetProvider };
