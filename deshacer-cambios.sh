#!/bin/bash
# Deshace TODO lo que cambió desde la última versión guardada.
# No se pierde: queda apartado y se puede recuperar con:  git stash pop
cd "$(dirname "$0")"
if [ -z "$(git status --porcelain)" ]; then echo "No hay cambios desde la última versión guardada."; exit 0; fi
echo "Estos archivos cambiaron desde la última versión guardada:"; git status --short
read -p "¿Deshacer estos cambios? (s/n) " r
[ "$r" = "s" ] || { echo "No se hizo nada."; exit 0; }
git stash push -u -q -m "deshecho $(date '+%Y-%m-%d %H:%M')" && echo "✅ Listo: el proyecto volvió a la última versión guardada."
