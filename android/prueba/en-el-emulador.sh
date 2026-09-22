#!/usr/bin/env bash
#
# Instala el APK en el teléfono virtual, lo abre y mira la pantalla.
#
# Que el APK se compile no quiere decir que la aplicación se vea: una
# ruta mal puesta la deja cargando una página que no existe y por
# fuera todo parece correcto.  Esto sólo da por bueno lo que se ve.
set -u

APK=${1:-salida/MonxuCAD.apk}
PAQUETE=es.monxucad.app
CAPTURA=salida/pantalla.png
REGISTRO=salida/registro.txt

mkdir -p salida

adb wait-for-device
adb logcat -c || true

echo "== Instalando $APK =="
adb install -r "$APK"

echo "== Abriendo la aplicación =="
adb shell am start -W -n "$PAQUETE/.MainActivity"

# Arrancar el WebView y leer cuarenta y tres archivos lleva su tiempo
# en una máquina virtual, así que se mira varias veces antes de darlo
# por perdido.
ok=0
for intento in 1 2 3 4 5 6 7 8 9 10; do
  sleep 8
  adb shell screencap -p /sdcard/pantalla.png
  adb pull -a /sdcard/pantalla.png "$CAPTURA" > /dev/null
  echo "-- intento $intento --"
  if python3 android/prueba/mira-la-captura.py "$CAPTURA"; then ok=1; break; fi
  if ! adb shell pidof "$PAQUETE" > /dev/null 2>&1; then
    echo "La aplicación se ha cerrado sola."
    break
  fi
done

adb logcat -d > "$REGISTRO" || true

echo "== Lo que dijo la aplicación =="
grep -F "MonxuCAD" "$REGISTRO" | tail -40 || echo "(nada)"

if grep -qF "No se pudo cargar" "$REGISTRO"; then
  echo "FALLO: la aplicación no pudo cargar su propia página."
  exit 1
fi

if [ "$ok" != "1" ]; then
  echo "FALLO: la aplicación no llegó a pintar su interfaz."
  echo "== Últimas líneas del registro =="
  tail -60 "$REGISTRO"
  exit 1
fi

if ! adb shell pidof "$PAQUETE" > /dev/null 2>&1; then
  echo "FALLO: la aplicación no sigue viva."
  exit 1
fi

echo "La aplicación se instala, abre y pinta su interfaz."
