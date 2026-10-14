# DREAMS — instrucciones para cualquier asistente de IA que trabaje en este proyecto

Responde siempre en español, claro y sin tecnicismos: la dueña del proyecto no es programadora.

## Qué es
SaaS para pequeños negocios colombianos (ventas, inventario, clientes, finanzas, página web, catálogo, cobros, plantillas jurídicas para abogados). Monorepo npm:
- `apps/api`: NestJS + TypeORM + PostgreSQL + Redis (puerto 4000). Un módulo por carpeta en `apps/api/src/<modulo>` (controller, service, entities, dto).
- `apps/web`: Next.js (App Router) + TypeScript + Tailwind (puerto 3000). Páginas en `apps/web/src/app`, componentes en `apps/web/src/components`, llamadas a la API con `api()` de `@/lib/api`.
- Se ejecuta con Docker: `bash iniciar-dream.sh` (deja el registro en `dream-log.txt`). Usuario demo: demo@dream.co / Dream2026.

## Reglas obligatorias
1. Antes de cambiar archivos, pide a la usuaria que corra `bash guardar-version.sh` (o córrelo tú) para guardar una versión.
2. Cambios pequeños y en pocos archivos. Explica qué vas a cambiar y por qué ANTES de hacerlo.
3. NO instales paquetes nuevos de npm sin pedir permiso. Nunca inventes nombres de paquetes. Verifica que existan.
4. NO toques: `.env` (contiene claves secretas: no lo leas ni lo muestres), `docker-compose*.yml`, `iniciar-dream.sh`, `apps/web/next.config.mjs`, `apps/web/public/sw.js`, `apps/web/public/manifest.webmanifest`, ni las carpetas `_respaldo-*`.
5. No borres archivos ni carpetas. No cambies la estructura de la base de datos sin explicar el riesgo.
6. Respeta el estilo existente (TypeScript, Tailwind, componentes de `apps/web/src/components/ui`). No reescribas archivos completos si basta con editar unas líneas.
7. Después de cambiar, compila: `cd apps/api && npx tsc --noEmit` y `cd apps/web && npx tsc --noEmit`. Si hay errores, corrígelos o deshaz el cambio.
8. Al terminar, indica a la usuaria que corra `bash iniciar-dream.sh` y que revise la página. Si algo se dañó: `bash deshacer-cambios.sh`.
9. No inventes integraciones (bancos, DIAN, redes sociales): si una API externa no está configurada, dilo.
10. Plantillas jurídicas: no inventes artículos de leyes; si no estás seguro, márcalo para verificar.
