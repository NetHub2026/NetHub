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

module.exports = { resolveIconPath };
