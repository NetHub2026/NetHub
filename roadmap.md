# Roadmap NetHub

## Hecho
- [x] Panel de red: métricas, gráfico de ancho de banda, listado con filtros, detalle con etiquetas/control, modo oscuro.
- [x] Escáner: botón "Escanear red" contra agente local, importación de `arp -a` / JSON, persistencia en localStorage, estado de conexión y última hora de escaneo.

## En curso
- [ ] Modo escritorio portable (Windows)
  - [ ] Persistencia dual: `devices-db.json` en el directorio de la app (desktop) + localStorage (web), con exportación/importación.
  - [ ] Capa de abstracción del escáner nativo (ARP/ping vía sistema en desktop, fallback en preview).
  - [ ] Modal "Empaquetar App Portable" con comandos Tauri/Electron y rutas del .exe y del fichero de datos.
  - [ ] Mantener interfaz actual (panel, métricas, filtros, modo oscuro).
