# Instalación del motor de conversión DWG

MonxuCAD escribe y lee DXF por su cuenta. Para DWG hace falta un motor externo,
porque el formato es binario, propietario y no tiene especificación pública.
Elija uno de los dos.

---

## Opción A — ODA File Converter (recomendado)

Gratuito con registro, cerrado. Convierte entre todas las versiones de DWG y DXF
con la mejor fidelidad del mercado. Es el mismo motor que usan la mayoría de los
programas CAD que no son de Autodesk.

1. Descargue el paquete de su sistema en
   <https://www.opendesign.com/guestfiles/oda_file_converter>.
2. Instálelo:

   ```bash
   # Debian / Ubuntu
   sudo apt install ./ODAFileConverter_QT6_lnxX64_8.3dll_25.7.deb
   sudo apt install libxcb-xinerama0 libgl1 libfontconfig1
   ```

3. En un servidor sin entorno gráfico, exporte:

   ```bash
   export QT_QPA_PLATFORM=offscreen
   ```

4. Compruebe que responde:

   ```bash
   ODAFileConverter
   ```

Si el binario no está en el `PATH`, indique su ruta al servicio:

```bash
ODA_PATH=/opt/ODAFileConverter/ODAFileConverter npm start
```

---

## Opción B — LibreDWG (software libre)

GPL, mantenido por el proyecto GNU. `dwgread` lee hasta R2018. `dwgwrite`
escribe R13–R2000 y sigue marcado como experimental: sirve para intercambiar
geometría, no para entregar un plano final.

```bash
sudo apt install build-essential git autoconf automake libtool \
                 pkg-config texinfo swig python3-dev
git clone --depth 1 https://github.com/LibreDWG/libredwg.git
cd libredwg
sh autogen.sh
./configure --disable-bindings --enable-write
make -j"$(nproc)"
sudo make install
sudo ldconfig
```

En algunas distribuciones basta con `sudo apt install libredwg-tools`.

---

## Opción C — Docker (LibreDWG ya incluido)

```bash
docker build -f server/Dockerfile -t monxucad .
docker run --rm -p 8787:8787 monxucad
```

Para añadir ODA al contenedor, ponga el `.deb` en `server/oda.deb` y descomente
el bloque correspondiente del `Dockerfile`.

---

## Comprobación

```bash
curl -s http://localhost:8787/api/health | python3 -m json.tool
```

Debe aparecer `"canRead": true` y, si quiere escribir DWG, `"canWrite": true`.

---

## Uso desde la aplicación

1. Abra `http://localhost:8787` (la aplicación se sirve desde el propio puente,
   así que detecta la dirección sola).
2. `ABRE` acepta ya archivos `.dwg`.
3. `GUARDARDWG` escribe `.dwg` en la versión que elija.
4. `PUENTEDWG` permite apuntar a otra dirección si el servicio está en otra máquina.

## Nota sobre la versión publicada en claude.ai

La copia alojada en claude.ai funciona dentro de un entorno aislado que bloquea
las peticiones a servidores externos, así que allí el puente no puede usarse.
Descargue el repositorio y ejecútelo en local para tener DWG.
