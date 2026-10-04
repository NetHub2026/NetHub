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

## Listo para publicar (3/10)
- Flujo de release preparado: .github/workflows/release.yml compila el .exe portable en GitHub Actions y publica el Release con `NetHub.exe` y la etiqueta `v<versión>` tomada de package.json (o la que se indique al lanzarlo). Falta solo: GitHub → Actions → "Release NetHub portable" → Run workflow.

## Probado en el .exe portable real (3/10)
- [x] Ping con fallback TCP, escaneo de puertos, comprobación de DNS, gemelo digital y anomalías funcionan correctamente con el agente nativo.

## Completado v1.3.0 (3/10)
- [x] Gemelo digital de la casa: pestaña "Mi casa" con plano por habitaciones, punto luminoso por equipo, estado en vivo, intrusos en rojo y tráfico real del PC (En directo).
- [x] Detección de anomalías por patrones (src/lib/patterns.ts): aprendizaje hora a hora, aviso de conexiones/desconexiones inusuales, picos de tráfico; panel "Anomalías aprendidas" con barra 0/5 días de aprendizaje; aviso nativo y sonido.
- [x] Versión 1.3.0 en package.json y APP_VERSION.

## Completado (22/9)
- Ficha con acciones reales: abrir panel web y copiar IP/MAC, manteniendo ping y Wake-on-LAN.
- Arranque opcional de Windows directamente minimizado en la bandeja, persistido en `settings.json`.
- Icono de aplicación recortado sin baldosa exterior y regenerado para Windows en varias resoluciones.

## Completado (21/9)
- Mapa interactivo de topología: selector Inventario/Topología de red, agrupación automática por subred, ramas plegables, estado y conexión de cada equipo y acceso directo a su ficha.

## Completado (18/9, tercera ronda)
- Personas y ubicaciones: modelo y `devices-db.json` con listas reutilizables, selectores con creación al instante en la ficha, indicadores en las tarjetas, filtros por persona y ubicación y columnas nuevas en el CSV.
- Área de notificación de Windows: icono en la bandeja con menú Abrir NetHub / Escanear ahora / Salir y ocultado al minimizar o cerrar para seguir escaneando en segundo plano.
- Pantallas Full HD: ventana de escritorio 1520x920 centrada y contenedor hasta 1720 px con rejilla de 3-4 columnas.
- Tipos ampliados con iconos propios: PC de sobremesa, Portátil, Smartphone, Tablet, Decodificador/TV Box, NAS/Servidor, Enchufe, Bombilla y Tira LED, con inferencia automática por nombre y fabricante.
- Icono de bandeja corregido: `public/**/*` incluido en el paquete, búsqueda robusta de `favicon.ico`/`app-icon.png` en desarrollo y portable, y redimensionado nativo 16x16 para Windows.
- Clasificación inicial de conexión: móviles, tablets y domótica Wi-Fi reciben etiqueta `Wi-Fi`; el PC local detecta Wi-Fi o `Cableado / Ethernet`; la ficha permite alternar una sola etiqueta de conexión.

## Completado (18/9, segunda ronda)
- Etiqueta "Escaneado" eliminada: no se añade en los escaneos y se limpia al cargar, guardar y fusionar dispositivos ya guardados.
- Monitorización automática: selector Cada 2 min / Cada 5 min / Desactivado (persistente), escaneo silencioso en segundo plano y cuenta atrás con pulso discreto.
- Avisos de dispositivos nuevos: insignia "Nuevo", aviso flotante con nombre/IP/fabricante y acciones "Ver ficha" y "Reconocer".

## Completado (18/9)
- Test de velocidad de ~20 s (descarga/subida continuas, velocímetro en vivo, pico, barra de progreso) verificado en navegador.
- Icono con fondo 100% transparente (sin recuadro blanco en Windows): app-icon.png, favicon.png y favicon.ico multiresolución; empaquetado apunta a public/favicon.ico.

- [x] Tarjetas de descarga y uso del enlace conectadas al tráfico real del adaptador
- [x] Tarjetas de dispositivo limpias (icono de conexión, ubicación con su badge, sin icono de fabricante)
- [x] Menú de Configuración completo (sistema, apariencia, red, alertas, datos)

- [x] Historial de actividad (Timeline) con presencia en la ficha (26/9)
- [x] Escaneo TCP de puertos y servicios en la ficha (26/9)

## Completado v1.1.0 (28/9)
- [x] Sentinel: De confianza / Por verificar, alertas de intrusos y conflictos de IP, aviso nativo y sonido (configurable)
- [x] Pestaña Seguridad: puntuación 0-100, semáforo, vulnerabilidades por puerto y recomendaciones paso a paso
- [x] Health Radar: prueba de 3 puntos, diagnóstico del corte, historial, microcortes y jitter
- [x] Versión 1.1.0; alertas e historial de salud en devices-db.json, ajustes nuevos en settings.json

## v1.2.0
- [x] Modo Ausente (alarma por presencia de móviles)
- [x] Estadísticas de uso por equipo
- [x] SLA del operador (tests programados + CSV)
- [x] Detector de DNS secuestrado (escritorio)

## Identidad y contacto (4/10)
- [x] Correo oficial de la app: nethub2026@outlook.es (cuenta exclusiva creada por Gorka)
- [x] Licencia restrictiva + © 2026 oyogor en LICENSE, panel Acerca de, Ajustes › Mantenimiento y Actualizaciones
- [x] Menú nativo (File/Edit/View/Window/Help) eliminado de la ventana
