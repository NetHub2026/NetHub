const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const valid = /^devices-db-[0-9TZ-]+-[a-f0-9-]{36}\.json$/;
function validate(raw) {
  const data = JSON.parse(raw);
  const devices = Array.isArray(data) ? data : data?.devices;
  if (
    !Array.isArray(devices) ||
    devices.length > 5000 ||
    devices.some(
      (d) =>
        !d ||
        ["id", "name", "ip", "mac"].some((k) => typeof d[k] !== "string") ||
        !Array.isArray(d.tags),
    )
  )
    throw new Error("Copia de NetHub no válida.");
  return data;
}
function atomic(target, raw) {
  const temp = target + ".tmp";
  const fd = fs.openSync(temp, "w", 0o600);
  try {
    fs.writeFileSync(fd, raw, "utf8");
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(temp, target);
}
function entries(directory) {
  const folder = path.join(directory, "backups");
  if (!fs.existsSync(folder)) return [];
  return fs
    .readdirSync(folder)
    .filter((n) => valid.test(n))
    .sort()
    .reverse()
    .flatMap((id) => {
      try {
        const filename = path.join(folder, id),
          info = fs.lstatSync(filename);
        if (!info.isFile()) return [];
        const data = validate(fs.readFileSync(filename, "utf8"));
        return [
          {
            id,
            at: info.mtime.toISOString(),
            bytes: info.size,
            devices: (Array.isArray(data) ? data : data.devices).length,
          },
        ];
      } catch {
        return [];
      }
    });
}
function read(directory, id) {
  if (!valid.test(id) || !entries(directory).some((e) => e.id === id))
    throw new Error("Copia no válida o no disponible.");
  return validate(fs.readFileSync(path.join(directory, "backups", id), "utf8"));
}
function create(directory, source) {
  const raw = fs.readFileSync(source, "utf8");
  validate(raw);
  const folder = path.join(directory, "backups");
  fs.mkdirSync(folder, { recursive: true, mode: 0o700 });
  const id = `devices-db-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID()}.json`;
  atomic(path.join(folder, id), raw);
  for (const old of entries(directory).slice(7)) fs.unlinkSync(path.join(folder, old.id));
  return path.join(folder, id);
}
function restore(directory, source, id) {
  const data = read(directory, id);
  if (fs.existsSync(source)) create(directory, source);
  atomic(source, JSON.stringify(data, null, 2));
}
module.exports = { entries, read, create, restore, atomic };
