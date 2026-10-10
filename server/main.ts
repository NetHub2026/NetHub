import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { StateStore } from "./storage";
import { Monitor } from "./monitor";
import { createHttpServer } from "./http";
async function main() {
  const passwordFile = process.env["NETHUB_PASSWORD_FILE"];
  if (!passwordFile)
    throw new Error(
      "Configura NETHUB_PASSWORD_FILE con un archivo de contraseña de al menos 12 caracteres. Consulta docs/NAS.md.",
    );
  const password = (await readFile(passwordFile, "utf8")).trim();
  const port = Number(process.env["NETHUB_PORT"] ?? 8080);
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw new Error("NETHUB_PORT no válido (1024–65535).");
  const monitor = new Monitor(new StateStore(resolve(process.env["NETHUB_DATA_DIR"] ?? "./data")), {
    demo: process.env["NETHUB_DEMO_MODE"] === "true",
  });
  await monitor.init();
  const server = createHttpServer(monitor, {
    password,
    staticDirectory: resolve(process.env["NETHUB_WEB_DIR"] ?? "./dist-server/web"),
    secureCookies: process.env["NETHUB_SECURE_COOKIES"] === "true",
    allowedHosts: (process.env["NETHUB_ALLOWED_HOSTS"] ?? "")
      .toLowerCase()
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, process.env["NETHUB_BIND_ADDRESS"] ?? "0.0.0.0", resolve);
  });
  monitor.start();
  console.log(
    `NetHub Server 0.1.0 listo en el puerto ${port}${monitor.options.demo ? " (DEMOSTRACIÓN: datos de ejemplo)" : ""}.`,
  );
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    server.close();
    await monitor.stop();
    process.exit(0);
  };
  process.on("SIGTERM", () => void stop());
  process.on("SIGINT", () => void stop());
}
void main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
