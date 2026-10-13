#!/bin/bash
# Descarga (una sola vez) los clips de la portada desde Pexels a apps/web/public/portada.
# Si no hay internet, la portada los carga directamente desde Pexels.
cd "$(dirname "$0")/.."
DEST="apps/web/public/portada"
mkdir -p "$DEST"
while IFS='|' read -r file url; do
  [ -z "$file" ] && continue
  if [ ! -s "$DEST/$file" ]; then
    echo "   descargando $file"
    curl -fsSL --max-time 120 -A "Mozilla/5.0 (DREAMS)" -o "$DEST/$file.tmp" "$url" && mv "$DEST/$file.tmp" "$DEST/$file" || { rm -f "$DEST/$file.tmp"; echo "   (no se pudo descargar $file; la portada lo cargará desde Pexels)"; }
  fi
done < <(grep -o "file: '[^']*', remote: '[^']*'" apps/web/src/lib/hero-clips.ts | sed -E "s/file: '([^']*)', remote: '([^']*)'/\1|\2/")
