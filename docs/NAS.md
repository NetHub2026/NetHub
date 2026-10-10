# NetHub Server 0.1.0 para NAS

NetHub Server monitoriza desde un NAS Linux y ofrece una interfaz web para PC, móvil y tablet. El monitor continúa cuando se cierran los navegadores. Inventario, personas, ubicaciones, posiciones de la casa, actividad, rutinas, conectividad y hasta 100 pruebas se guardan en `/data/server-state.json`, dentro del volumen persistente de Docker.

Esta edición es independiente de la aplicación portable para Windows. No instala Electron en el NAS. No incorpora apagado remoto. La primera versión requiere validar el escaneo en el NAS físico; las pruebas automatizadas utilizan datos sintéticos y no certifican la cobertura de una red real.

## Interfaz compartida con Windows

PC y NAS reutilizan la misma cabecera, navegación, filtros, tarjetas, configuración y vistas: Inventario, Plano y cobertura, Rendimiento, Topología de red, Actividad, Seguridad, Health Radar, Mi casa, Uso y Operador. Las diferencias responden al equipo que monitoriza: el NAS ejecuta y guarda las tareas en el servidor, mientras Windows ofrece las opciones propias de Electron. No se inventa tráfico por dispositivo cuando no está disponible.

Los avisos de seguridad y el modo ausencia se conservan en el JSON del servidor. La detección del proveedor requiere activación expresa y consulta IPWhois desde el servidor; no transmite el inventario. La prueba de velocidad utiliza Cloudflare con consentimiento. Comparar respuestas DNS diferentes no basta para afirmar una manipulación.

## Requisitos

- NAS Linux con Docker y Docker Compose. El UGREEN DXP4800 Pro es el destino previsto; el código no contiene reglas de una casa ni depende de una marca de router.
- Red IPv4 privada; escaneo de la interfaz seleccionada, subred `/22` o menor (máximo 1024 direcciones). Redes de invitados aisladas y VLAN requieren una interfaz que tenga acceso a ellas.
- Acceso desde un navegador de la misma red. Puerto inicial: 8080; puede cambiarse si ya está ocupado.

UGREEN explica la instalación de Docker y los proyectos Compose en su [guía oficial](https://ai.ugreen.com/blogs/knowledge/docker-docker-compose-ugreen-nas). La [red host de Docker](https://docs.docker.com/engine/network/drivers/host/) permite que el contenedor vea la interfaz del NAS. No se utiliza modo privilegiado: únicamente se añade `NET_RAW`, necesario para ARP y ping.

## Instalación con el paquete de imagen

1. Instala Docker desde el centro de aplicaciones de UGOS.
2. Crea una carpeta para NetHub con la subcarpeta `secrets`. Docker creará el volumen de datos automáticamente. Copia `compose.server.yaml` a ella.
3. Crea `secrets/admin-password.txt` con una contraseña propia de 12–256 caracteres. No reutilices los ejemplos de pruebas. El archivo debe ser legible para el contenedor (por ejemplo, permiso 644) y la carpeta `secrets` debe estar restringida a tu usuario (por ejemplo, 700). No compartas esta carpeta con otros usuarios.
4. Descomprime `nethub-server-0.1.0-amd64.tar.gz` e importa el `.tar` en Docker. También puede cargarse desde una terminal:

   ```sh
   gzip -dc nethub-server-0.1.0-amd64.tar.gz | docker load
   ```

5. Crea un proyecto Compose con la carpeta y `compose.server.yaml`. El Compose del paquete utiliza la imagen importada y no intenta descargarla ni construirla.
6. Desde una terminal, el equivalente es:

   ```sh
   docker compose -f compose.server.yaml up -d --no-build
   ```

7. Abre `http://IP_DEL_NAS:8080` e inicia sesión con tu contraseña. En Configuración selecciona la interfaz de red si hay varias. El primer escaneo se realizará automáticamente.

La imagen Linux amd64 corresponde al DXP4800 Pro. Las publicaciones de validación conservan el paquete durante 30 días; no son una actualización de NetHub.exe.

## Instalación desde código fuente

Obtén la rama que contiene NetHub Server, prepara las carpetas y la contraseña anteriores y ejecuta:

```sh
docker compose -f compose.server.yaml up -d --build
```

La construcción incluye el servidor y la web. Los datos, contraseñas, archivos de entorno y el historial Git quedan excluidos del contexto de construcción. No debe copiarse una carpeta privada de Windows al repositorio público.

## Pasar tus datos desde Windows

1. Obtén una copia de `devices-db.json` de tu aplicación de Windows. Cierra la aplicación antes de copiarlo para que termine de guardar.
2. En NetHub Server abre **Configuración → Datos y copias → Importar JSON**.
3. Selecciona la copia y confirma. Se sustituye el inventario del NAS y se guarda previamente `server-state.backup.json`. La importación conserva personas, habitaciones, posiciones, actividad, rutinas, uso y pruebas compatibles.
4. Las pruebas SLA antiguas sin jitter se señalan como migradas: el jitter se presenta como desconocido. Se conservan hasta 100 pruebas entre ambos historiales.

La contraseña, interfaz seleccionada y tareas del NAS se conservan al importar. No existe sincronización automática entre el JSON del PC y el del NAS: todos los navegadores conectados al servidor utilizan la misma copia del NAS.

Para utilizar una carpeta visible del NAS en vez del volumen, sustituye `nethub_data:/data` por una ruta absoluta de esa carpeta seguida de `:/data`. El contenedor funciona como UID 0 con capacidades limitadas: esa carpeta debe permitir escritura a UID 0; una carpeta propiedad de otro usuario con permisos 755 no basta. El volumen predeterminado evita este problema.

## Qué se mide

- **Dispositivos:** ARP en la red local. No garantiza detectar equipos dormidos, IPv6 o redes aisladas. Un error del escáner conserva el estado anterior y muestra el problema.
- **Identificación:** catálogo IEEE local y reglas generales; una MAC privada no identifica al fabricante. Los campos editados y las conexiones unificadas se conservan.
- **Cable o Wi-Fi:** solo cuenta lo indicado en la ficha o recibido de una fuente compatible. ARP no permite deducir la banda Wi-Fi de otros equipos.
- **Conectividad:** ping al gateway detectado y referencias públicas. La ausencia de respuesta ICMP puede deberse a un filtro; no demuestra por sí sola un corte del proveedor.
- **Tráfico:** contadores de la interfaz del NAS, que incluyen tráfico local e Internet. No representa el tráfico agregado de toda la casa ni el tráfico individual de cada equipo.
- **Velocidad:** prueba desde el NAS con Cloudflare. La IP pública será visible para ese servicio; no se envía el inventario. Las pruebas pueden consumir varios GB y están desactivadas inicialmente. Las programadas requieren activación explícita.

Los valores mostrados en modo demostración son sintéticos. Este modo no escanea la red, no ejecuta Wake-on-LAN y no realiza pruebas reales.

## Preferencias de despliegue

Opcionalmente crea `.env` junto al Compose:

```dotenv
NETHUB_PORT=8080
NETHUB_ALLOWED_HOSTS=
NETHUB_SECURE_COOKIES=false
TZ=UTC
```

`NETHUB_ALLOWED_HOSTS` admite nombres explícitos separados por comas, por ejemplo el nombre local que tú hayas asignado al NAS. El acceso por una IP privada funciona sin añadir nombres. La sesión caduca a las 12 horas y al reiniciar el servidor; cinco fallos de contraseña bloquean nuevos intentos desde esa dirección durante 15 minutos.

Para acceso remoto utiliza una VPN. No abras el puerto en el router directamente a Internet. Con un proxy HTTPS configura `NETHUB_SECURE_COOKIES=true`, el nombre exacto en `NETHUB_ALLOWED_HOSTS` y conserva el encabezado Host. El proxy debe transmitir el origen HTTPS; la aplicación rechaza ediciones desde otros orígenes. Esta primera versión usa una contraseña compartida de administración, sin usuarios individuales.

## Copias, actualización y recuperación

El volumen `nethub_data` persiste al recrear el contenedor. No elimines ese volumen ni uses `docker compose down -v` al actualizar. Se genera una copia adicional cada 24 horas; puedes crearla o descargar un JSON desde Configuración. Además de `server-state.backup.json`, se conservan las siete últimas versiones en `/data/backups/`, con fecha en el nombre. Las copias manuales y las previas a una importación también cuentan dentro de ese límite; no equivale necesariamente a siete días. Para recuperar una versión antigua, copia ese JSON al PC e impórtalo desde la web, o restaura el archivo con el contenedor detenido. Incluye el volumen de Docker en las copias de seguridad del NAS, o descarga periódicamente el JSON.

Antes de actualizar, descarga una copia. Importa la nueva imagen y recrea el contenedor conservando el volumen `nethub_data` y el secreto. Cambiar la contraseña requiere editar el archivo privado y reiniciar; la contraseña no se guarda en el JSON ni en la imagen.

Si `server-state.json` está dañado, el servicio se detiene y conserva el archivo. Detén el contenedor y restaura la copia del NAS sobre `/data/server-state.json` en el volumen de datos. También puedes volver a iniciar con un volumen nuevo e importar la copia desde la web. Si aparece un error de permisos ARP, comprueba `NET_RAW` y red host; no actives modo privilegiado como solución automática.

## Desarrollo y comprobaciones

```sh
bun install --frozen-lockfile
bun run build:server
bunx vitest run
```

Para iniciar una demostración local, establece `NETHUB_PASSWORD_FILE` apuntando a un archivo de contraseña de pruebas, `NETHUB_DEMO_MODE=true`, `NETHUB_BIND_ADDRESS=127.0.0.1`, `NETHUB_PORT=8087`, y ejecuta `bun run start:server`.

El workflow **Validate NetHub Server** construye la imagen Linux, verifica autenticación, monitorización sin navegador y persistencia después de reiniciar el contenedor, sin acceso a ninguna red real. La prueba ARP de una instalación física queda pendiente hasta disponer del NAS.

## Mejoras compartidas con Windows

En Configuración → Datos y copias puedes listar las siete copias, descargarlas y restaurarlas con confirmación. Se guarda una copia previa al reemplazo. La restauración conserva contraseña, interfaz y tareas del servidor; restaura inventario e historiales compatibles. Las preferencias locales de Windows también se conservan. Windows crea una copia automáticamente al guardar si la última tiene más de 24 horas; el servidor tiene además su tarea continua diaria.

En la ficha de cada dispositivo puedes consultar hasta 50 eventos de presencia, cambios de IP y conexión, y tiempo conectado observado en los últimos 30 días. El tiempo solo procede de escaneos y no cubre periodos en que el monitor estuvo detenido.

La vigilancia se activa por dispositivo: 1, 5, 10, 30 o 60 minutos sin respuesta, con aviso opcional al recuperarse. Se evalúa al completar un escaneo correcto y no repite la misma ausencia. Los intervalos reales de escaneo condicionan el momento del aviso; tras una pausa de más de 15 minutos se reinicia el margen de observación pendiente. La configuración y la ausencia ya avisada persisten en el JSON. En Windows hay aviso nativo y en la app; en NAS los eventos se registran sin navegador y se muestran en Actividad, con aviso visual para los navegadores conectados. No se envían mensajes externos ni notificaciones al móvil con el navegador cerrado.

Exportar selección ofrece CSV y Excel (.xlsx) con resumen, tabla filtrable y cabeceras fijas. Utiliza los filtros activos del inventario, incluyendo personas, ubicaciones y tipos. Los valores que podrían interpretarse como fórmulas en una hoja de cálculo se exportan como texto.

## Plano real y mediciones locales

En «Plano y cobertura» puedes subir PNG/JPG (hasta 15 MB, convertido localmente a una imagen de hasta 2000 píxeles y 2 MB), colocar equipos, arrastrarlos y marcar habitaciones. Cambiar o eliminar el plano pide confirmación; descarga primero una copia si quieres conservar posiciones y mediciones. La copia JSON se puede importar en la misma sección vacía de PC o NAS. El JSON general y las copias del NAS incluyen el plano. El inventario se conserva al cambiarlo.

Para medir, abre NetHub desde el móvil conectado a la red, pulsa «Medir cobertura», toca tu posición y nombra la visita. Se mide la ruta HTTP desde ese navegador al NAS (12 MB por prueba), no Internet ni señal Wi-Fi. Banda y medio de conexión se indican manualmente. Los puntos muestran descarga, latencia y variación; las visitas permiten distinguir antes/después y se conservan los últimos 200 puntos. No se colorean zonas sin mediciones. Un proxy/VPN puede influir en la ruta y el resultado. En PC sin servidor se prepara el plano; las mediciones requieren el NAS.

El servicio exige sesión para servir los datos de medición, evita caché, limita las transferencias a cuatro pruebas por minuto y detecta ediciones simultáneas del plano. La imagen no se descarga de nuevo en cada actualización del inventario. La demostración usa un plano ficticio y desactiva transferencias; la validación en una vivienda real queda pendiente.
