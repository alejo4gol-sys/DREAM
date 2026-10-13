# DREAMS

Plataforma SaaS para pequeños negocios: ventas, inventario, clientes, proveedores, finanzas, bancos, redes sociales, reportes y asistente de negocio en un solo lugar.

- **Frontend:** Next.js 14 · React · TypeScript · Tailwind (identidad blanco, negro y beige)
- **Backend:** NestJS 11 · Drizzle ORM · PostgreSQL 16 · Redis
- **Arquitectura, modelo de datos, API, roles y seguridad:** [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md)

---

## Opción A — Docker (recomendada)

Requisitos: [Docker Desktop](https://www.docker.com/products/docker-desktop/).

```bash
cp .env.example .env          # luego cambia los secretos (ver más abajo)
docker compose up --build     # la primera vez tarda unos minutos
```

En otra terminal, carga los planes y roles (y si quieres, el negocio de demostración):

```bash
docker compose exec api node dist/db/seed.js --demo
```

Abre **http://localhost:3000** · Demo: `demo@dream.co` / `Dream2026`

## Abrir DREAMS desde el celular

Con DREAMS encendido, ejecuta:

```bash
bash ~/Documents/DREAM/compartir-dream.sh
```

Muestra dos enlaces (también quedan en `enlace-dream.txt`):

- **Enlace público** `https://xxxx.trycloudflare.com`: funciona en cualquier celular o red, con HTTPS. Es temporal: cambia cada vez y funciona mientras el Mac esté encendido.
- **Red Wi-Fi local** `http://IP-del-Mac:3000`: solo para equipos conectados al mismo Wi-Fi.

Para un enlace **permanente** (por ejemplo `app.tunegocio.com`) hay que publicar DREAMS en un servidor en la nube; ver `docs/ARQUITECTURA.md` (Hosting).

## Opción B — Sin Docker (desarrollo)

Requisitos: Node.js 20+ (recomendado 22), PostgreSQL 16 y Redis (opcional).

En Mac con Homebrew:

```bash
brew install node postgresql@16 redis
brew services start postgresql@16 && brew services start redis
createdb dream
```

Luego, desde la carpeta del proyecto:

```bash
npm install
cp .env.example apps/api/.env           # ajusta DATABASE_URL a tu usuario de Postgres
#   ej. DATABASE_URL=postgresql://TU_USUARIO@localhost:5432/dream
npm run db:migrate                       # crea las tablas
npm run db:seed:demo                     # planes, roles y negocio demo
npm run dev --workspace apps/api         # API en http://localhost:4000/api
npm run dev --workspace apps/web         # Web en http://localhost:3000  (otra terminal)
```

> En desarrollo los correos (recuperación de contraseña, invitaciones) se imprimen en la consola del API.

## Secretos

Genera valores propios antes de usarlo con datos reales:

```bash
openssl rand -base64 48   # JWT_SECRET
openssl rand -base64 32   # ENCRYPTION_KEY  (guárdalo bien: sin él no se descifran cuentas ni tokens)
```

## Cobros de planes DREAMS con Wompi

La pestaña **Configuración → Plan y pagos** permite a quien administra el negocio escoger un plan y pagarlo en el checkout seguro de Wompi. Allí el pagador selecciona el medio disponible en la cuenta de DREAMS. DREAMS registra el pago y activa el plan cuando recibe y verifica la confirmación de Wompi. Los cobros se hacen por mes de forma manual; el cliente vuelve a pagar al renovar. No se guardan tarjetas ni se hacen débitos automáticos.

Para habilitarlo, configura en el `.env` de Docker (o en `apps/api/.env` sin Docker) las cuatro llaves del comercio Wompi de DREAMS: `WOMPI_SAAS_PUBLIC_KEY`, `WOMPI_SAAS_PRIVATE_KEY`, `WOMPI_SAAS_INTEGRITY_SECRET` y `WOMPI_SAAS_EVENT_SECRET`. No uses las llaves de las tiendas de tus clientes. En el panel de Wompi registra como webhook `https://TU_API/api/billing/wompi/webhook` y suscribe el evento `transaction.updated`. Usa las llaves de prueba para validar antes de activar las de producción. Reinicia la API después de guardar las variables.

## Comparación de precios

En **Precios del mercado** se puede buscar cualquier producto, aunque no exista en el inventario del comerciante. Agrega `SERPAPI_API_KEY` al `.env` del servidor para la búsqueda agregada de Google Shopping en Colombia. DREAMS también consulta en paralelo Mercado Libre y eBay cuando sus credenciales directas están configuradas: `MERCADOLIBRE_ACCESS_TOKEN`, `EBAY_CLIENT_ID` y `EBAY_CLIENT_SECRET`. Los conectores directos requieren una aplicación de desarrollador aprobada; el token de Mercado Libre vence y debe mantenerse renovado. SerpApi es un proveedor externo y puede cobrar según su plan. Amazon, Falabella y Éxito disponen de APIs enfocadas principalmente en operaciones de vendedores autorizados, no en una búsqueda general anónima; Facebook Marketplace, TuCarro, Alkosto, Ktronix, Homecenter, Jumbo y Carulla quedan con cobertura indirecta únicamente cuando Google Shopping indexa sus ofertas, o requieren un acuerdo/acceso específico para una integración directa. DREAMS muestra etiquetas distintas para conexión directa y cobertura indirecta. Los resultados incluyen el enlace original cuando la fuente lo proporciona.

## Pruebas

```bash
npm test                                   # pruebas unitarias (cálculo de ventas, conciliación, asistente)
node apps/api/test/smoke.mjs               # prueba end-to-end contra el API en ejecución (con datos demo)
node apps/api/test/twofactor.mjs           # registro, 2FA, límites de plan y bloqueo por intentos
```

## Estructura

```
apps/api     NestJS: un módulo por dominio (auth, businesses, catalog, inventory, sales, finance, banks, social…)
apps/web     Next.js: páginas en src/app/(app)/… y componentes en src/components
docs         Arquitectura y decisiones técnicas
```

## Estado del MVP

| Módulo | Estado |
|---|---|
| Autenticación (registro, login, 2FA, sesiones, recuperación) | Funcional |
| Negocio, usuarios y roles | Funcional |
| Dashboard con gráficos | Funcional |
| Productos, categorías e inventario (kárdex, alertas) | Funcional |
| Ventas, abonos, anulación, comprobante imprimible | Funcional |
| Clientes (CRM y segmentos) y proveedores (compras y deudas) | Funcional |
| Gastos, ingresos, cuentas por cobrar/pagar, estado de resultados, flujo de caja | Funcional |
| Bancos: cuentas, movimientos, importación CSV, conciliación sugerida | Funcional · conexión bancaria directa pendiente de proveedor Open Finance (hay un banco *Sandbox* con datos simulados) |
| Centro de redes sociales | Atribución de ventas por canal funcional · conexión con cada red pendiente de apps aprobadas (requisitos documentados en la app) |
| Reportes CSV / Excel / PDF | Funcional |
| Asistente de negocio | Responde las preguntas frecuentes con cálculos exactos; listo para conectar un modelo de lenguaje |
| Suscripciones | Planes y límites aplicados · checkout Wompi y confirmación de pago; renovación mensual manual |
| Facturación electrónica DIAN | Arquitectura preparada (campos reservados); requiere habilitación y proveedor tecnológico |

La contabilidad de DREAMS es **gerencial** y no reemplaza la contabilidad financiera formal ni a un contador público.
