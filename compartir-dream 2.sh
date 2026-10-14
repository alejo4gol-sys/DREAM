#!/bin/bash
# Crea un enlace público (https) para usar DREAM desde el celular o cualquier computador.
# El enlace funciona mientras este Mac esté encendido y DREAM corriendo. Cambia cada vez que se ejecuta.
cd "$(dirname "$0")"
export PATH="/usr/local/bin:/opt/homebrew/bin:/Applications/Docker.app/Contents/Resources/bin:$PATH"
OUT="enlace-dream.txt"

{
  echo "=== $(date) ==="
  if ! docker info >/dev/null 2>&1; then
    echo "Docker Desktop no está abierto. Ábrelo, espera a que la ballena deje de moverse y vuelve a intentar."
    exit 1
  fi
  if ! curl -fs http://localhost:3000 >/dev/null; then
    echo ">> DREAM no está encendido; encendiéndolo primero..."
    bash ./iniciar-dream.sh >/dev/null 2>&1
  fi

  echo ">> Creando el enlace público..."
  docker compose --profile publico rm -sf tunel >/dev/null 2>&1
  docker compose --profile publico up -d tunel
  URL=""
  for i in $(seq 1 30); do
    URL=$(docker compose --profile publico logs tunel 2>/dev/null | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' | tail -1)
    [ -n "$URL" ] && break
    sleep 2
  done
  if [ -z "$URL" ]; then
    echo "No se pudo crear el enlace público. Registro del túnel:"
    docker compose --profile publico logs --tail 30 tunel
    exit 1
  fi

  echo ">> Autorizando el enlace en el servidor..."
  WEB_ORIGIN="http://localhost:3000,$URL" docker compose up -d api >/dev/null 2>&1
  for i in $(seq 1 30); do curl -fs http://localhost:4000/api/health >/dev/null && break; sleep 2; done

  IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)
  echo ""
  echo "============================================================"
  echo "  ENLACE PÚBLICO (celular con datos o cualquier red):"
  echo "    $URL"
  if [ -n "$IP" ]; then
    echo ""
    echo "  En la misma red Wi-Fi de este Mac también funciona:"
    echo "    http://$IP:3000"
  fi
  echo ""
  echo "  Usuario demo: demo@dream.co  ·  Contraseña: Dream2026"
  echo "  El enlace funciona mientras este Mac esté encendido."
  echo "  Para apagarlo:  docker compose --profile publico stop tunel"
  echo "============================================================"
} 2>&1 | tee "$OUT"
