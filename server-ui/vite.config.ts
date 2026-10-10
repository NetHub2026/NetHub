import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL(".", import.meta.url));
export default defineConfig({
  root,
  publicDir: fileURLToPath(new URL("../public", import.meta.url)),
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
  build: {
    outDir: fileURLToPath(new URL("../dist-server/web", import.meta.url)),
    emptyOutDir: true,
  },
  server: { host: "127.0.0.1", port: 8086, proxy: { "/api": "http://127.0.0.1:8087" } },
});
