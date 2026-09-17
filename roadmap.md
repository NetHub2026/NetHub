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

## Pendiente
- Ninguna tarea abierta.
