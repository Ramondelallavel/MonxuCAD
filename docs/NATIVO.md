# Llevar MonxuCAD al ordenador y al teléfono

Hay tres maneras de usar MonxuCAD sin abrir una pestaña del navegador
cada vez, de menos a más trabajo:

| | Qué hay que hacer | Qué se consigue |
|---|---|---|
| **Instalar desde el navegador** | Un botón | Icono propio, ventana propia y funciona sin red |
| **Aplicación de escritorio** | Descargar un instalador | Windows, macOS y Linux, con menús y diálogos del sistema |
| **APK de Android** | Descargar un archivo | Teléfono y tableta, sin pasar por la tienda |

Las tres llevan dentro exactamente la misma aplicación: lo que cambia
es la envoltura.

---

## 1. Instalar desde el navegador

Es lo más rápido y no hace falta descargar nada suelto. Sirve tanto en
el ordenador como en el teléfono.

**En el ordenador** (Chrome, Edge, Brave, Opera): abra la aplicación y
pulse **Instalar**, arriba a la derecha. También vale el icono de
instalar que sale en la barra de direcciones.

**En Android** (Chrome): menú ⋮ ▸ **Instalar aplicación** o **Añadir a
la pantalla de inicio**.

**En iPhone y iPad** (Safari): compartir ▸ **Añadir a pantalla de
inicio**. Safari no admite instalar con un botón.

Queda un icono como el de cualquier otro programa, se abre en su propia
ventana sin barra de direcciones y **funciona sin conexión**: la primera
vez se guarda la aplicación entera en el equipo.

En el ordenador, además, los archivos `.dxf` y `.dcad` quedan asociados:
al abrir uno con doble clic se abre en MonxuCAD.

---

## 2. Aplicación de escritorio

### Descargarla ya compilada

1. Entre en la pestaña **Actions** del repositorio.
2. Elija **Compilar la aplicación de escritorio** y abra la última
   ejecución terminada.
3. Al final de la página, en **Artifacts**, descargue el de su sistema:

   | Sistema | Archivo |
   |---|---|
   | Windows | `MonxuCAD-1.0.0-windows-x64.exe` (instalador) o `…-portable.exe` |
   | macOS | `MonxuCAD-1.0.0-mac-arm64.dmg` (Apple Silicon) o `…-x64.dmg` (Intel) |
   | Linux | `MonxuCAD-1.0.0-linux-x86_64.AppImage` o `…-linux-amd64.deb` |

Si no aparece ninguna ejecución, láncela a mano con **Run workflow**.

### Instalarla

**Windows.** El instalador deja elegir carpeta y crea los accesos
directos. El portable no instala nada: se ejecuta y ya. Como no está
firmado, SmartScreen avisa la primera vez: *Más información* ▸ *Ejecutar
de todas formas*.

**macOS.** Abra el `.dmg` y arrastre MonxuCAD a Aplicaciones. Tampoco
está firmado, así que la primera vez hay que abrirlo con el botón
derecho ▸ **Abrir** en lugar de con doble clic, y confirmar. Si el
sistema se pone tozudo:

```bash
xattr -dr com.apple.quarantine /Applications/MonxuCAD.app
```

**Linux.** El AppImage se ejecuta tal cual:

```bash
chmod +x MonxuCAD-1.0.0-linux-x86_64.AppImage
./MonxuCAD-1.0.0-linux-x86_64.AppImage
```

El `.deb` se instala con `sudo apt install ./MonxuCAD-1.0.0-linux-amd64.deb`
y queda en el menú de aplicaciones.

### Qué añade sobre el navegador

- **Guardar donde uno quiera**, con el diálogo del sistema, en vez de
  que todo caiga en la carpeta de descargas.
- **Abrir un `.dxf` con doble clic** desde el explorador de archivos.
- Menús de Archivo, Edición, Ver y Ayuda. Los atajos son los mismos de
  siempre, porque los sigue atendiendo la aplicación.

### Compilarla uno mismo

Hace falta Node 20 o posterior.

```bash
cd desktop
npm install
npm start                        # para probarla sin empaquetar
npx electron-builder --linux     # o --win, o --mac
```

Los archivos salen en `desktop/dist`. Cada sistema hay que compilarlo
en su propia máquina: el instalador de Windows y el paquete de macOS no
se pueden armar desde Linux.

---

## 3. APK de Android

### Descargarlo ya compilado

1. Pestaña **Actions** del repositorio.
2. **Compilar el APK de Android** ▸ última ejecución terminada.
3. En **Artifacts**, `MonxuCAD-android-apk`. Se descarga en `.zip`;
   dentro está `MonxuCAD.apk`.

### Instalarlo

Pase el `.apk` al teléfono (cable, correo, Drive, lo que sea) y ábralo
desde el gestor de archivos. Android pedirá permiso para instalar
aplicaciones de ese origen, porque no viene de la tienda: hay que
dárselo una vez.

Con el teléfono enchufado por cable también vale:

```bash
adb install -r MonxuCAD.apk
```

**No pide ningún permiso.** Abre y guarda con el selector de archivos
del sistema y no sale a la red.

Viene firmado con la clave de depuración, y esa clave la genera cada
compilación. Al instalar una versión nueva encima de otra anterior,
Android puede quejarse de que las firmas no coinciden; entonces hay que
desinstalar la vieja primero. Para que eso no pase, y para subirlo a
Google Play, hace falta una clave propia:

```bash
keytool -genkey -v -keystore monxucad.jks -keyalg RSA \
        -keysize 2048 -validity 10000 -alias monxucad
```

y declararla en `android/app/build.gradle` dentro de `signingConfigs`,
apuntándola desde `buildTypes.release`.

### Cómo se usa en el teléfono

- El botón de **volver** cancela la orden que esté en marcha, igual que
  Escape. Pulsado dos veces seguidas, sale.
- Para abrir un dibujo, la orden **ABRE** dentro de la aplicación.
- Para guardarlo, **GUARDAR**: sale el selector del sistema y se elige
  la carpeta.

### Compilarlo uno mismo

Hacen falta el SDK de Android, Java 17 y Gradle 8.11.

```bash
cd android
gradle assembleDebug
```

El APK queda en `android/app/build/outputs/apk/debug/`.

La aplicación web no está duplicada dentro del proyecto Android: se
copia sola desde `web/` antes de cada compilación, así que el APK nunca
se queda con una copia vieja.

Si prefiere `./gradlew`, créelo una vez con `gradle wrapper` dentro de
`android/`.

---

## Lo que no hay en las versiones nativas

**DWG.** El puente que convierte DWG necesita un servicio Node aparte
y un motor externo, así que no va dentro ni del APK ni del instalador.
En el escritorio se puede levantar el servicio al lado, como está
contado en [INSTALL.md](INSTALL.md); en el teléfono no. DXF, que es lo
que MonxuCAD lee y escribe por su cuenta, funciona en todas partes.

**Acercar con dos dedos.** El lienzo entiende el dedo como si fuera el
ratón —se dibuja, se selecciona y se arrastra— pero el gesto de pellizco
todavía no. Para acercar y alejar están los botones de la barra de
navegación, a la derecha del lienzo.

**Firma.** Ni el instalador de Windows ni el paquete de macOS están
firmados, porque firmar cuesta un certificado de pago. De ahí los avisos
de la primera vez.
