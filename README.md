# Home Network Hub

Crear una aplicación web moderna tipo dashboard para monitorizar y gestionar dispositivos de una red doméstica (PCs, consolas, Smart TVs, Home Assistant e IoT). Debe incluir una vista general de la red (dispositivos activos/inactivos, consumo de ancho de banda simulado o preparado para API/integración), listado y filtrado por tipo de dispositivo con detalles (nombre, IP, MAC, estado, fabricante, última conexión), modal o panel de detalle por dispositivo con opciones de control o etiquetado, y un diseño limpio y moderno con modo oscuro.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/b8fc483b-526d-4c70-a9a5-d10ff69950a5).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## NetHub Server para NAS

Edición Docker con monitorización continua y una interfaz compartida para PC, móvil y tablet. Consulta [instalación, alcance y copias de seguridad](docs/NAS.md). El monitor del NAS funciona sin navegadores abiertos y guarda sus datos en un volumen persistente.

### Funciones comunes de PC y NAS

Ambas ediciones incluyen selección filtrada del inventario para CSV, historial de presencia con tiempo conectado observado, vigilancia por dispositivo con margen configurable y aviso de recuperación, y un gestor para descargar o restaurar las siete últimas copias. La restauración pide confirmación y guarda previamente el estado actual. Los avisos se registran en Actividad; Windows puede mostrarlos como notificaciones del sistema y el NAS los muestra a los navegadores conectados, sin enviar mensajes a servicios externos.
