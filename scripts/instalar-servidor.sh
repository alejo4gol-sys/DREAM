#!/bin/bash
# Instala o actualiza DREAMS en un servidor Ubuntu (22.04 o 24.04) con dominio propio y HTTPS.
# Uso (en el servidor, dentro de la carpeta DREAM):   sudo bash scripts/instalar-servidor.sh midominio.com.co micorreo@ejemplo.com
set -e
cd "$(dirname "$0")/.."
DOMINIO="$1"; CORREO="$2"
ENV="deploy/.env.produccion"

if ! command -v docker >/dev/null 2>&1; then
  echo ">> Instalando Docker..."
  curl -fsSL https://get.docker.com | sh
fi

if [ ! -f "$ENV" ]; then
  [ -z "$DOMINIO" ] || [ -z "$CORREO" ] && { echo "Uso: sudo bash scripts/instalar-servidor.sh midominio.com.co micorreo@ejemplo.com"; exit 1; }
  echo ">> Creando $ENV con claves aleatorias..."
  cp deploy/env.produccion.ejemplo "$ENV"
  sed -i "s|^DOMINIO=.*|DOMINIO=$DOMINIO|; s|^CORREO_SSL=.*|CORREO_SSL=$CORREO|; s|^PLATFORM_ADMIN_EMAILS=.*|PLATFORM_ADMIN_EMAILS=$CORREO|" "$ENV"
  sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(openssl rand -hex 24)|; s|^JWT_SECRET=.*|JWT_SECRET=$(openssl rand -hex 48)|; s|^ENCRYPTION_KEY=.*|ENCRYPTION_KEY=$(openssl rand -base64 32)|" "$ENV"
  chmod 600 "$ENV"
  echo "   Guarda una copia segura de $ENV: sin ENCRYPTION_KEY no se pueden leer los datos cifrados."
fi

echo ">> Firewall: solo SSH, HTTP y HTTPS..."
if command -v ufw >/dev/null 2>&1; then ufw allow OpenSSH >/dev/null; ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null; ufw --force enable >/dev/null; fi

echo ">> Descargando videos de la portada..."
bash scripts/videos-portada.sh || true

echo ">> Construyendo y encendiendo (tarda varios minutos la primera vez)..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file "$ENV" up -d --build

echo ">> Esperando a la API..."
for i in $(seq 1 60); do docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file "$ENV" exec -T api node -e "fetch('http://localhost:4000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" && break; sleep 3; done

echo ">> Cargando planes y roles (sin datos de ejemplo)..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file "$ENV" exec -T api node dist/db/seed.js

echo ">> Copia de seguridad diaria de la base de datos (3 a. m.)..."
( crontab -l 2>/dev/null | grep -v respaldo-bd.sh ; echo "0 3 * * * bash $(pwd)/scripts/respaldo-bd.sh >> $(pwd)/respaldos/respaldo.log 2>&1" ) | crontab -

. "$ENV"
echo ""
echo "✅ Listo. Abre https://$DOMINIO  (el certificado HTTPS puede tardar 1-2 minutos la primera vez)."
