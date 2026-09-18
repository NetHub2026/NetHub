# NetHub — Hoja de ruta

## Hecho
- Panel de red: métricas, gráfico de ancho de banda, listado con filtros/búsqueda, panel de detalle con etiquetas y controles, modo oscuro.
- Escáner de red: agente local (http://localhost:8765/scan), importación de `arp -a` y JSON, estado Conectado/Desconectado, última hora de escaneo, modal de configuración (Python y PowerShell).
- App portable: detección de entorno (web/Tauri/Electron), persistencia dual (devices-db.json en escritorio, localStorage en web), escaneo ARP nativo con fallback, exportación manual del JSON y modal "Empaquetar App Portable" con comandos Tauri y Electron Builder.
- Reconocimiento de fabricantes por MAC (base OUI local), nombre sugerido e icono de marca.
- Detección de dispositivos nuevos: fusión de escaneos, badge "Nuevo", alerta en la vista general y marcar como conocido/confiable.
- Puertos y servicios comunes en el detalle del dispositivo con enlaces al panel de administración.
- Edición individual: tipo con icono, nombre, fabricante, eliminación/olvido y preservación de cambios manuales.
- Mejoras actuales: selector con contraste correcto, OUI ampliada con resolución externa/fallback por hostname y etiquetas rápidas.
- Scripts del agente actualizados para incluir el propio PC local con nombre, IP, MAC, tipo PC y etiquetas.
- Escaneo optimizado: PowerShell evita DNS bloqueante por IP y la consulta externa de fabricantes queda en segundo plano.
- Ping en tiempo real en la ficha (RTT, alcanzabilidad e histórico) con endpoint `/ping` en los agentes y ping nativo en escritorio.
- Test de velocidad con velocímetro (latencia, jitter, descarga, subida) e historial de pruebas.
- Wake-on-LAN desde la ficha con Magic Packet vía agente (`/wol`) o nativo.
- Segmentación por redes: pestañas con contadores, detección por subred y asignación manual en la ficha.
- Copia de seguridad: exportar inventario en JSON o CSV y restaurar fusionando o reemplazando.
- Fabricantes online desde el agente (`/vendor`, consultas secuenciales con pausa y caché en fichero), MAC privadas etiquetadas como "MAC privada (Móvil/Portátil)" y botón "Buscar fabricante en Internet" en la ficha.
- Asistente portable con pestaña de un solo clic: `build-portable.bat` genera `NetHub.exe` y `update-portable.bat` lo actualiza conservando `devices-db.json` junto al ejecutable.

- Interfaz universal: sin asistentes de escáner ni empaquetado, redes detectadas automáticamente por subred y OUI ampliado con routers de operadora españoles (Sagemcom, Sercomm, Arcadyan, Technicolor, MitraStar, Askey, Zyxel, Comtrend, Huawei, TP-Link, AVM).
- Barra de acciones minimalista: solo Escanear red, Exportar inventario (CSV) y Restablecer (sin importar ni descargas JSON).

## Pendiente
- Ninguna tarea abierta.

## Completado (18/9, segunda ronda)
- Etiqueta "Escaneado" eliminada: no se añade en los escaneos y se limpia al cargar, guardar y fusionar dispositivos ya guardados.
- Monitorización automática: selector Cada 2 min / Cada 5 min / Desactivado (persistente), escaneo silencioso en segundo plano y cuenta atrás con pulso discreto.
- Avisos de dispositivos nuevos: insignia "Nuevo", aviso flotante con nombre/IP/fabricante y acciones "Ver ficha" y "Reconocer".

## Completado (18/9)
- Test de velocidad de ~20 s (descarga/subida continuas, velocímetro en vivo, pico, barra de progreso) verificado en navegador.
- Icono con fondo 100% transparente (sin recuadro blanco en Windows): app-icon.png, favicon.png y favicon.ico multiresolución; empaquetado apunta a public/favicon.ico.
