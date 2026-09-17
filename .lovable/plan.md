# NetHub — 5 mejoras: ping, speedtest, WOL, redes y copias

## 1. Ping en tiempo real
- Nuevo bloque "Latencia" en la ficha de detalle: botón **Hacer Ping**, indicador grande de milisegundos, estado (Alcanzable / Sin respuesta) y mini-historial de las últimas 10 medidas con gráfico de barras.
- Mide de tres formas, en orden: agente local (`/ping?ip=...`), ping nativo en la app portable, y como último recurso una medida aproximada en el navegador (tiempo de respuesta al abrir una conexión al dispositivo). Si nada está disponible, se avisa con un mensaje claro en lugar de inventar un valor.
- Los scripts de Python y PowerShell del modal "Configurar escáner Windows" ganan el endpoint `/ping` con ICMP real (1 paquete, 1 s de espera) devolviendo el tiempo en milisegundos.

## 2. Test de velocidad
- Nueva sección "Test de velocidad" en el panel principal, con velocímetro semicircular animado y tres cifras: latencia + jitter, descarga y subida.
- La medición se hace en el navegador contra un endpoint propio de la app (descarga de bloques de datos y envío de bloques), así funciona igual en preview y en la app portable.
- Cada test se guarda en el historial local (fecha, ping, jitter, bajada, subida) y se muestra la lista de los últimos resultados.

## 3. Wake-on-LAN
- Botón **Encender con Wake-on-LAN** en la ficha, visible solo para tipos compatibles (PC, consola, TV, router, impresora, NAS/otros) y con más énfasis cuando el equipo está apagado.
- Envía el Magic Packet mediante el agente local (`/wol?mac=...`) o de forma nativa en la app portable; confirma el envío o explica que hace falta el agente.
- Los scripts Python y PowerShell añaden el endpoint `/wol` que construye y envía el paquete por UDP al puerto 9 en difusión.

## 4. Redes y topología
- Pestañas de red sobre el listado: **Todas las redes**, **Router Vodafone**, **Archer AX50 (Principal)**, **Red Invitados / Domótica**, con el número de equipos en cada una.
- Asignación automática por subred (rango de IP configurado en cada red) y selector manual de red en la ficha de detalle, que se guarda y se respeta en escaneos posteriores.
- El contador de dispositivos y los filtros existentes (tipo, búsqueda, solo conectados) se combinan con la red seleccionada.

## 5. Copia de seguridad
- Menú **Exportar inventario** con dos opciones: JSON completo (todo el inventario, incluidas etiquetas, notas y personalizaciones) y CSV listo para hoja de cálculo.
- El diálogo de importación acepta ahora también un CSV o un JSON de copia de seguridad, con dos modos: fusionar con lo existente o reemplazar todo, indicando cuántos equipos se han restaurado.

## Notas técnicas
- Nuevos módulos: `src/lib/ping.ts` (ping multi-entorno + historial), `src/lib/speedtest.ts` (medición y historial en localStorage), `src/lib/wol.ts`, `src/lib/networks.ts` (catálogo de redes y detección por subred), `src/lib/backup.ts` (serialización JSON/CSV).
- Nuevos componentes: `SpeedTestPanel.tsx`, `PingCard.tsx`, `NetworkTabs.tsx`; ampliación de `DeviceDetailPanel.tsx`, `ImportDevicesModal.tsx`, `ScannerSetupModal.tsx` y `src/routes/index.tsx`.
- `Device` gana `networkId?`, `latency?: { rtt: number | null; at: string }[]` (últimas medidas) y `wolCapable` se deriva del tipo; `desktop.ts` gana `nativePing` y `nativeWol`.
- El endpoint de speedtest se implementa como ruta de servidor `src/routes/api/public/speedtest.ts` (GET devuelve bloque de datos, POST acepta la subida) sin datos personales.
