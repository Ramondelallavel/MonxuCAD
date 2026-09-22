#!/usr/bin/env bash
#
# Deja los archivos en la publicación de descargas del repositorio.
#
# Los artefactos de Actions no sirven para repartir: van dentro de un
# ZIP y exigen tener cuenta en GitHub, así que desde un teléfono no se
# puede instalar nada.  Los archivos de una publicación se bajan de un
# enlace directo, sin cuenta y sin descomprimir.
set -euo pipefail

ETIQUETA=ultima

if [ "$#" -eq 0 ]; then
  echo "No hay nada que publicar."
  exit 1
fi

notas=$(cat <<'TEXTO'
Compilación al día de MonxuCAD. Descargue de aquí abajo el archivo de
su sistema; son descargas directas, sin cuenta y sin descomprimir.

| Dónde | Archivo |
|---|---|
| Android | `MonxuCAD.apk` |
| Windows | `MonxuCAD-windows.exe` (instalador) o `MonxuCAD-windows-portable.exe` |
| macOS | `MonxuCAD-mac-arm64.dmg` (Apple Silicon) o `MonxuCAD-mac-x64.dmg` (Intel) |
| Linux | `MonxuCAD-linux.AppImage` o `MonxuCAD-linux.deb` |

**Android.** Abra el `.apk` descargado. La primera vez el teléfono pide
permiso para instalar desde el navegador: **Ajustes ▸ Permitir**. Si
después sale *Play Protect*, pulse **Más detalles ▸ Instalar de todas
formas**. Si dice que la aplicación no se ha instalado, desinstale
antes la versión anterior: son de firmas distintas y Android no deja
poner una encima de otra.

**Windows.** SmartScreen avisa porque el instalador no está firmado:
**Más información ▸ Ejecutar de todas formas**.

**macOS.** Ábralo con el botón derecho ▸ **Abrir**, no con doble clic,
y confirme. Con doble clic el sistema no ofrece la opción.

**Linux.** Al AppImage hay que darle permiso de ejecución:
`chmod +x MonxuCAD-linux.AppImage`

Instrucciones completas, y qué hacer si no deja instalar, en
[docs/NATIVO.md](https://github.com/Ramondelallavel/MonxuCAD/blob/main/docs/NATIVO.md).
TEXTO
)

# Los dos flujos —el del APK y el del escritorio— pueden llegar aquí a
# la vez, así que crear puede fallar porque el otro acaba de crearla.
# Eso no es un problema: lo que importa es que exista.
if ! gh release view "$ETIQUETA" > /dev/null 2>&1; then
  echo "== Creando la publicación =="
  if ! gh release create "$ETIQUETA" \
        --target "$GITHUB_SHA" \
        --title "MonxuCAD — última compilación" \
        --notes "$notas"; then
    if ! gh release view "$ETIQUETA" > /dev/null 2>&1; then
      echo "::error title=No se pudo crear la publicación::El flujo no tiene permiso de escritura. Actívelo en Settings ▸ Actions ▸ General ▸ Workflow permissions ▸ Read and write permissions."
      exit 1
    fi
    echo "Ya la había creado el otro flujo."
  fi
else
  # Las notas se rehacen en cada vuelta por si cambian las
  # instrucciones; los archivos se reemplazan uno a uno más abajo.
  gh release edit "$ETIQUETA" --notes "$notas" > /dev/null
fi

echo "== Subiendo =="
for archivo in "$@"; do
  if [ -f "$archivo" ]; then
    echo "  $archivo  ($(du -h "$archivo" | cut -f1))"
  else
    echo "  FALTA: $archivo"
    exit 1
  fi
done
gh release upload "$ETIQUETA" "$@" --clobber

echo
echo "Descargable en: $(gh release view "$ETIQUETA" --json url --jq .url)"
