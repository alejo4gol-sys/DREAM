#!/bin/bash
# Copia de seguridad de la base de datos de DREAMS (guarda los últimos 14 días en ./respaldos).
cd "$(dirname "$0")/.."
mkdir -p respaldos
F="respaldos/dream-$(date +%Y%m%d-%H%M).sql.gz"
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file deploy/.env.produccion exec -T db pg_dump -U dream dream | gzip > "$F" && echo "$(date) respaldo $F"
find respaldos -name 'dream-*.sql.gz' -mtime +14 -delete
