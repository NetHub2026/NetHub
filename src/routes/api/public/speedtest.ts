import { createFileRoute } from "@tanstack/react-router";

const MAX_BYTES = 8_000_000;

/**
 * Endpoint de apoyo para el test de velocidad de la app.
 * GET  -> devuelve `bytes` de datos sintéticos (máx. 8 MB) para medir descarga.
 * POST -> acepta el cuerpo enviado y responde el tamaño recibido, para medir subida.
 * No lee ni devuelve datos personales.
 */
export const Route = createFileRoute("/api/public/speedtest")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const requested = Number(url.searchParams.get("bytes") ?? "1000000");
        const size = Math.max(1, Math.min(MAX_BYTES, Number.isFinite(requested) ? requested : 1));
        const chunk = new Uint8Array(size);
        for (let i = 0; i < size; i += 1) chunk[i] = i % 251;
        return new Response(chunk, {
          headers: {
            "Content-Type": "application/octet-stream",
            "Cache-Control": "no-store",
          },
        });
      },
      POST: async ({ request }) => {
        const buffer = await request.arrayBuffer();
        return Response.json(
          { received: buffer.byteLength },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
