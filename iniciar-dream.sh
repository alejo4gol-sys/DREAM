#!/bin/bash
# Arranca DREAMS con Docker y deja un registro en dream-log.txt
cd "$(dirname "$0")"
export PATH="/usr/local/bin:/opt/homebrew/bin:/Applications/Docker.app/Contents/Resources/bin:$PATH"
LOG="dream-log.txt"

{
  echo "=== $(date) ==="
  if ! docker info >/dev/null 2>&1; then
    echo "Docker Desktop no está abierto. Ábrelo, espera a que la ballena deje de moverse y vuelve a intentar."
    exit 1
  fi
  echo ">> Deteniendo lo anterior..."
  docker compose down
  echo ">> Videos de la portada..."
  bash scripts/videos-portada.sh
  echo ">> Construyendo (puede tardar varios minutos)..."
  docker compose build || { echo "ERROR EN LA CONSTRUCCIÓN"; exit 1; }
  echo ">> Encendiendo..."
  docker compose up -d
  echo ">> Esperando a que el servidor responda..."
  for i in $(seq 1 60); do
    if curl -fs http://localhost:4000/api/health >/dev/null; then echo "Servidor listo."; break; fi
    sleep 3
  done
  echo ">> Cargando planes, roles y negocio de ejemplo..."
  docker compose exec -T api node dist/db/seed.js --demo
  echo ">> Estado:"
  docker compose ps -a
  echo ">> Últimos registros del servidor:"
  docker compose logs --tail 40 api
  echo ">> Últimos registros de la web:"
  docker compose logs --tail 15 web
} 2>&1 | tee "$LOG"

if curl -fs http://localhost:3000 >/dev/null; then
  echo ""
  echo "✅ DREAMS está funcionando: http://localhost:3000  (demo@dream.co / Dream2026)"
  open http://localhost:3000
else
  echo ""
  echo "⚠️ Algo no arrancó. El detalle quedó en Documentos/DREAM/dream-log.txt"
fi
