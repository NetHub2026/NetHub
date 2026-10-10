const fs = require("node:fs");
const path = require("node:path");

function resolveIconPath(file, { resourcesPath, appPath, electronDir }) {
  const bases = [
    resourcesPath ? path.join(resourcesPath, "icons") : "",
    path.join(electronDir, "..", "public"),
    appPath ? path.join(appPath, "public") : "",
    path.join(electronDir, "..", "dist", "client"),
    path.join(electronDir, "..", "dist"),
  ];
  // Prefer the requested format across all locations before falling back.
  const names = file === "favicon.ico" ? [file, "app-icon.png"] : [file, "favicon.ico"];
  for (const name of names) {
    for (const base of bases) {
      if (!base) continue;
      const candidate = path.join(base, name);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return path.join(electronDir, "..", "public", file);
}

/** Windows reads taskbar metadata after the portable payload may have disappeared. */
function persistentTaskbarIcon(source, cacheDir) {
  try {
    const bytes = fs.readFileSync(source);
    const digest = require("node:crypto").createHash("sha256").update(bytes).digest("hex").slice(0,16);
    fs.mkdirSync(cacheDir, { recursive: true });
    const target = path.join(cacheDir, `nethub-${digest}${path.extname(source)}`);
    if (!fs.existsSync(target) || !fs.readFileSync(target).equals(bytes)) fs.writeFileSync(target, bytes);
    return target;
  } catch {
    return source;
  }
}
module.exports = { resolveIconPath, persistentTaskbarIcon };
