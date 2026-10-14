#!/bin/bash
# Guarda una "foto" del proyecto para poder volver atrás si una IA daña algo.
cd "$(dirname "$0")"
git add -A
if git diff --cached --quiet; then echo "No hay cambios nuevos que guardar."; else
  git commit -q -m "Versión guardada $(date '+%Y-%m-%d %H:%M') ${1:-}" && echo "✅ Versión guardada: $(git log -1 --format='%s')"; fi
