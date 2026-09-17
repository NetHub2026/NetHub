// Garantiza que .output/public/index.html exista antes de empaquetar el .exe.
// Si el prerender no lo generó, se crea uno mínimo con los bundles compilados.
import fs from "node:fs";
import path from "node:path";

const candidates = [
  path.resolve(".output/public"),
  path.resolve("dist/client"),
  path.resolve("dist"),
];

function build(dir) {
  const indexFile = path.join(dir, "index.html");
  if (fs.existsSync(indexFile)) {
    console.log(`[ensure-index-html] OK: ${indexFile}`);
    return true;
  }
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
  console.log(`[ensure-index-html] Generado: ${indexFile}`);
  return true;
}

const done = candidates.some((dir) => fs.existsSync(dir) && build(dir));
if (!done) {
  console.warn("[ensure-index-html] No se encontró ninguna carpeta compilada con assets/.");
}
