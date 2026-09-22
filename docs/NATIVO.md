# Llevar MonxuCAD al ordenador y al teléfono

## Descarga directa

| Dónde | Archivo |
|---|---|
| **Android** | [MonxuCAD.apk](https://github.com/Ramondelallavel/MonxuCAD/releases/latest/download/MonxuCAD.apk) · [comprimido](https://github.com/Ramondelallavel/MonxuCAD/releases/latest/download/MonxuCAD-apk.zip) |
| **Windows** | [instalador](https://github.com/Ramondelallavel/MonxuCAD/releases/latest/download/MonxuCAD-windows.exe) · [portable](https://github.com/Ramondelallavel/MonxuCAD/releases/latest/download/MonxuCAD-windows-portable.exe) |
| **macOS** | [Apple Silicon](https://github.com/Ramondelallavel/MonxuCAD/releases/latest/download/MonxuCAD-mac-arm64.dmg) · [Intel](https://github.com/Ramondelallavel/MonxuCAD/releases/latest/download/MonxuCAD-mac-x64.dmg) |
| **Linux** | [AppImage](https://github.com/Ramondelallavel/MonxuCAD/releases/latest/download/MonxuCAD-linux.AppImage) · [.deb](https://github.com/Ramondelallavel/MonxuCAD/releases/latest/download/MonxuCAD-linux.deb) |

Todos salen de <https://github.com/Ramondelallavel/MonxuCAD/releases/latest>.
Son enlaces fijos: apuntan siempre a la última compilación, no hacen
falta cuenta ni descomprimir nada, y se abren igual desde el móvil.

> No use los artefactos de la pestaña **Actions** para instalar: van
> dentro de un `.zip` y exigen tener la sesión iniciada en GitHub, así
> que en un teléfono no se puede instalar lo que se baja de ahí. Están
> para mirar compilaciones concretas, no para repartir.

---

## Android

**Requisitos:** Android 7.0 o posterior.

Si el navegador se niega a bajar el `.apk` suelto —algunos lo
bloquean sin dar opción, y algunos gestores de correo tampoco lo
dejan pasar—, baje el **comprimido**, descomprímalo y abra el `.apk`
que hay dentro. Es el mismo archivo.

1. Abra el enlace del `.apk` **desde el propio teléfono**.
2. El navegador avisa de que ese tipo de archivo puede ser dañino:
   **Descargar de todas formas**. Es el aviso que sale con cualquier
   `.apk` que no venga de la tienda.
3. Ábralo desde las descargas.
4. La primera vez el sistema dice que no puede instalar aplicaciones
   desconocidas de ese origen: **Ajustes ▸ Permitir desde esta
   fuente**, y vuelva atrás.
5. Si sale **Play Protect** diciendo que no reconoce al desarrollador:
   **Más detalles ▸ Instalar de todas formas**.
6. **Instalar**.

Con el teléfono enchufado por cable también vale:

```bash
adb install -r MonxuCAD.apk
```

### Si dice que la aplicación no se ha instalado

Casi siempre es por la firma. Cada compilación va firmada con una
clave hecha en ese momento, y Android no deja poner una aplicación
encima de otra si las firmas no coinciden. **Desinstale primero el
MonxuCAD que tenga** y vuelva a instalar.

Para que eso deje de pasar, guarde una clave fija en el repositorio:

```bash
keytool -genkeypair -v -keystore monxucad.jks -alias monxucad \
        -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 monxucad.jks > monxucad.jks.base64
```

y en **Settings ▸ Secrets and variables ▸ Actions** añada:

| Secreto | Qué lleva |
|---|---|
| `ANDROID_ALMACEN_BASE64` | el contenido de `monxucad.jks.base64` |
| `ANDROID_ALMACEN_CLAVE` | la contraseña del almacén |
| `ANDROID_ALIAS` | `monxucad` |
| `ANDROID_ALIAS_CLAVE` | la contraseña de la clave |

Desde la compilación siguiente, las actualizaciones se instalan encima
sin desinstalar nada. Guarde el `.jks` en sitio seguro: si se pierde,
no hay manera de firmar una actualización de lo ya instalado.

### Cómo se usa en el teléfono

- **Un dedo** hace de ratón: dibuja, designa y arrastra.
- **Dos dedos** acercan, alejan y encuadran a la vez, y se pueden usar
  en mitad de una orden sin perderla: se pellizca para ver mejor y se
  sigue precisando puntos donde se estaba.
- **El teclado sale cuando usted quiere**, no solo. Para escribir una
  orden, toque la **línea de comandos** de abajo; al aceptarla, el
  teclado se retira para dejar ver el dibujo. Dibujar, pulsar
  herramientas de la cinta y designar no lo abren nunca. Sí aparece
  solo cuando la orden pide texto de verdad —*Escriba texto:*—,
  porque entonces hace falta.
- **El dibujo se guarda solo.** Cada pocos segundos y, sobre todo, en
  cuanto la aplicación sale de la pantalla: Android mata lo que está
  en segundo plano cuando necesita memoria y no avisa. Si eso pasa, al
  volver a abrirla le ofrece recuperar lo que quedó a medias. Aun así,
  guarde con **GUARDAR** lo que quiera conservar: la copia es una red,
  no un archivo suyo.
- El botón de **volver** cancela la orden que esté en marcha, igual que
  Escape. Pulsado dos veces seguidas, sale.
- Para abrir un dibujo, la orden **ABRE**: sale el selector de
  documentos del teléfono con sus archivos, y vale cualquier carpeta,
  también Drive. Para guardarlo, **GUARDAR**: sale el selector y se
  elige dónde dejarlo.

La aplicación **no pide ningún permiso** y no sale a la red.

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

---

## Windows

El instalador deja elegir carpeta y crea los accesos directos. El
portable no instala nada: se ejecuta y ya.

Ninguno de los dos está firmado —firmar cuesta un certificado de pago—,
así que **SmartScreen** avisa la primera vez con «Windows protegió su
PC». El botón para seguir está escondido: pulse **Más información** y
aparece **Ejecutar de todas formas**.

---

## macOS

Abra el `.dmg` y arrastre MonxuCAD a Aplicaciones.

Tampoco está firmado, así que la primera vez hay que abrirlo con el
**botón derecho ▸ Abrir**, no con doble clic, y confirmar en el cuadro
que sale. Con doble clic el sistema no ofrece esa opción y sólo deja
cancelar.

Si aun así se pone tozudo:

```bash
xattr -dr com.apple.quarantine /Applications/MonxuCAD.app
```

---

## Linux

```bash
chmod +x MonxuCAD-linux.AppImage
./MonxuCAD-linux.AppImage
```

El `.deb` se instala con `sudo apt install ./MonxuCAD-linux.deb` y queda
en el menú de aplicaciones.

---

## Sin instalar nada: desde el navegador

La aplicación también se instala desde el propio navegador, sin
descargar ningún archivo suelto.

- **Ordenador** (Chrome, Edge, Brave, Opera): pulse **Instalar**, arriba
  a la derecha, o el icono de instalar de la barra de direcciones.
- **Android** (Chrome): menú ⋮ ▸ **Instalar aplicación**.
- **iPhone y iPad** (Safari): compartir ▸ **Añadir a pantalla de
  inicio**. Safari no admite instalar con un botón.

Queda con icono propio, se abre en su propia ventana y **funciona sin
conexión**: la primera vez se guarda la aplicación entera en el equipo.
En el ordenador, además, los `.dxf` y `.dcad` quedan asociados y se
abren con doble clic.

---

## Qué añade el escritorio sobre el navegador

- **Guardar donde uno quiera**, con el diálogo del sistema, en vez de
  que todo caiga en la carpeta de descargas.
- **Abrir un `.dxf` con doble clic** desde el explorador de archivos.
- Menús de Archivo, Edición, Ver y Ayuda. Los atajos son los mismos de
  siempre, porque los sigue atendiendo la aplicación.

### Compilarlo uno mismo

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

## Lo que no hay en las versiones nativas

**DWG.** El puente que convierte DWG necesita un servicio Node aparte
y un motor externo, así que no va dentro ni del APK ni del instalador.
En el escritorio se puede levantar el servicio al lado, como está
contado en [INSTALL.md](INSTALL.md); en el teléfono no. DXF, que es lo
que MonxuCAD lee y escribe por su cuenta, funciona en todas partes.

**Girar en 3D con dos dedos.** El lienzo 2D entiende el pellizco; la
ventana de modelado 3D todavía no, y se navega con el ViewCube y la
barra de navegación.

**Firma.** Ni el instalador de Windows ni el paquete de macOS están
firmados, porque firmar cuesta un certificado de pago. De ahí los
avisos de la primera vez.
