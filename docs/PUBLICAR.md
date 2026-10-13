# Cómo publicar DREAMS en internet

Mientras DREAMS corre en tu Mac, solo tú lo ves (`localhost`). Para que cualquier persona abra
la página de DREAMS, las páginas de tus clientes, «¿Qué hago?» y el directorio de negocios, hay que
ponerlo en un **servidor en la nube** (un computador que está encendido 24 horas) con un **dominio**.

## Lo que necesitas (una sola vez)

| Qué | Para qué | Costo aproximado (verifica antes de comprar) |
|---|---|---|
| **Dominio** (ej. `dreams.com.co` o `dreamsapp.co`) | La dirección que escribe la gente | USD 10–40 al año, según la extensión |
| **Servidor en la nube** con Ubuntu 24.04, **4 GB de RAM**, 2 CPU, 80 GB de disco | Donde vive DREAMS | USD 20–30 al mes (DigitalOcean, Hetzner, AWS Lightsail, Vultr…) |
| Un correo | Para el certificado de seguridad (candado HTTPS) | — |

Con 2 GB de RAM funciona para empezar, pero la primera construcción es lenta. Con más clientes se puede subir de tamaño sin reinstalar.

## Paso a paso

1. **Compra el dominio** en un registrador (por ejemplo, el del proveedor de nube, GoDaddy, Namecheap o un registrador colombiano). Revisa antes en la SIC que el nombre no choque con una marca registrada.
2. **Crea el servidor**: elige Ubuntu 24.04, 4 GB de RAM, región Estados Unidos-Este o la más cercana a Colombia. Anota la **dirección IP** que te dan.
3. **Apunta el dominio al servidor**: en el panel del dominio (DNS) crea dos registros tipo **A**:
   - `@` → la IP del servidor
   - `www` → la IP del servidor
   (Puede tardar desde minutos hasta unas horas en propagarse.)
4. **Lleva la carpeta DREAM al servidor**. La forma más sencilla:
   - Sube la carpeta a un repositorio **privado** de GitHub y clónala en el servidor, o
   - cópiala con `scp -r ~/Documents/DREAM root@IP-DEL-SERVIDOR:/opt/dream` (no copies `node_modules`).
5. **Instala** (en el servidor, dentro de la carpeta):
   ```
   sudo bash scripts/instalar-servidor.sh midominio.com.co micorreo@ejemplo.com
   ```
   El script instala Docker, genera claves secretas aleatorias en `deploy/.env.produccion`,
   abre solo los puertos 80 y 443, enciende DREAMS con HTTPS automático (Caddy + Let's Encrypt),
   carga los planes y programa una copia de seguridad diaria de la base de datos.
6. **Abre `https://midominio.com.co`** y crea tu cuenta. Tu correo queda como administrador de la
   plataforma (verificación de abogados).
7. **Guarda en un lugar seguro** el archivo `deploy/.env.produccion` (sobre todo `ENCRYPTION_KEY`):
   sin él no se pueden leer los datos cifrados.

Desde ese momento:
- Las páginas de los negocios quedan en `https://midominio.com.co/tienda/nombre-del-negocio`.
- El directorio en `https://midominio.com.co/negocios`.
- «¿Qué hago?» en `https://midominio.com.co/ayuda`.
- Los enlaces y los códigos QR del panel «Compartir» de cada negocio usan el dominio real automáticamente.

## Para actualizar después de un cambio

```
cd /opt/dream && git pull          # o copia los archivos nuevos
sudo bash scripts/instalar-servidor.sh
```

## Después de publicar

- **Google**: registra el dominio en Google Search Console para que las páginas aparezcan en búsquedas.
- **WhatsApp**: configura las variables `WHATSAPP_*` en `deploy/.env.produccion` (ver `docs/WHATSAPP.md`) y el webhook `https://midominio.com.co/api/whatsapp/webhook`.
- **Pagos de los planes**: llaves de Wompi en `WOMPI_SAAS_*`.
- **Legal**: publica términos y condiciones y la política de tratamiento de datos (Ley 1581) e inscribe las bases de datos en el RNBD de la SIC si aplica.
- **Copias de seguridad**: quedan en la carpeta `respaldos/` del servidor (14 días). Descarga una copia periódicamente o activa los respaldos automáticos del proveedor de nube.

## Más adelante (opcional)

- **Subdominio por negocio** (`luna.midominio.com.co`) y **dominio propio del cliente** (`www.lunaaccesorios.com`):
  se configuran con un registro DNS comodín y reglas en `deploy/Caddyfile`.
