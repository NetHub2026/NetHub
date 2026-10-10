import { spawnSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
await mkdir("dist-server", { recursive: true });
for (const [command, args] of [
  ["node", ["node_modules/typescript/bin/tsc", "--project", "tsconfig.server.json", "--noEmit"]],
  [
    "bun",
    [
      "build",
      "server/main.ts",
      "--target=node",
      "--format=esm",
      "--outfile=dist-server/server.mjs",
    ],
  ],
  ["node", ["node_modules/vite/bin/vite.js", "build", "--config", "server-ui/vite.config.ts"]],
]) {
  const result = spawnSync(
    command === "bun" && process.platform === "win32" ? "bun.exe" : command,
    args,
    {
      stdio: "inherit",
      shell: false,
    },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
}
