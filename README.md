# MonxuCAD

Estación de dibujo y diseño 2D y 3D que se ejecuta en el navegador, construida
para parecerse a AutoCAD en interfaz, comandos y formatos de archivo, con
modelado de sólidos y generación de código de control numérico.

![estado](https://img.shields.io/badge/comandos-267-blue) ![formatos](https://img.shields.io/badge/DXF-R12%20%7C%202000-green) ![3D](https://img.shields.io/badge/3D-STL%20OBJ%203MF%20glTF-orange) ![CN](https://img.shields.io/badge/CN-Fanuc%20Siemens%20Heidenhain%20Haas-red) ![licencia](https://img.shields.io/badge/licencia-MIT-lightgrey)

## Qué incluye

**Interfaz** — Botón de aplicación, barra de acceso rápido, cinta de opciones con
ocho fichas y sus paneles, paleta de propiedades editable, paleta de bloques,
ViewCube, barra de navegación, pestañas de Modelo y presentaciones, ventana de
comandos con histórico y autocompletado, y barra de estado con los conmutadores
REJILLA · FORZCURSOR · ORTO · POLAR · REFENT · RASTREO · DIN · GROSOR.
Tema oscuro y tema claro.

**267 comandos** con nombre en español e inglés y sus alias (`L`, `C`, `REC`,
`TR`, `F`, `O`, `X`…). Motor de peticiones idéntico al original:
`Precise punto siguiente o [Cerrar/desHacer]:`, entrada `x,y`, `@dx,dy`,
`@dist<ángulo` y distancia directa, Esc cancela, Intro repite, y las opciones
entre corchetes se pulsan con el ratón.

- **Dibujo** — LINEA, POL, CIRCULO, ARCO, RECTANG, POLIGONO, ELIPSE, SPLINE,
  ARANDELA, PUNTO, LINEAM, LINEAX, RAYO, NUBEREV, SOMBREA, DEGRADADO, CONTORNO,
  SOLIDO, BLOQUE, INSERT, DIVIDE, GRADUA.
- **Modificar** — BORRA, COPIA, DESPLAZA, GIRA, ESCALA, SIMETRIA, DESFASE,
  MATRIZ (rectangular, polar y de camino), RECORTA, ALARGA, EMPALME, CHAFLAN,
  ESTIRA, PARTE, UNIR, DESCOMP, ALINEA, EDITPOL, LONGITUD, ORDENAOBJETOS.
- **Acotación** — lineal, alineada, angular, radio, diámetro, longitud de arco,
  coordenada, continua, línea base, marca de centro, acotación rápida,
  directrices, estilos con tolerancias y unidades alternativas.
- **Organización** — capas completas, grupos, bloques con atributos, SCP móvil
  y girable, vistas guardadas, plantillas de dibujo.
- **Espacio papel** — presentaciones con ventanas gráficas a escala real,
  bloqueo de ventana, cajetín con atributos y configuración de página.
- **Regiones** — REGION, UNION, DIFERENCIA e INTERSEC con recorte booleano
  exacto sobre contornos cerrados.
- **Utilidades** — CUBRIR, TABLA, DEPURAR (duplicados), DESIGNASEMEJANTE,
  AISLAROBJETOS, CALCRAPIDA, CAMBIA, ESCALATEXTO, JUSTIFICATEXTO, MULTIPLE,
  FILTRO, SCRIPT, INVERTIR, VOLUMEN, LONGITUDTOTAL, CONTARBLOQ, ATREXT,
  CAPAFUS, CAPADEL, COPIAACAPA, CAMBIARACAPA, TOLERANCIA (marco ISO 1101).

## Modelado 3D

Núcleo de sólidos propio, sin dependencias externas.

- **Primitivas** — PRISMARECT, CILINDRO, CONO, ESFERA, TOROIDE, CUNA, PIRAMIDE.
- **Por barrido** — EXTRUSION (con inclinación y agujeros), REVOLUCION,
  BARRIDO (marcos paralelos: el perfil no se retuerce), SOLEVADO, PULSARTIRAR,
  HELICE, SUPERFICIEPLANA.
- **Booleanos** — UNION3D, DIFERENCIA3D, INTERSEC3D e INTERF por árboles BSP.
- **Edición** — CORTE, SECCION3D, SOLPERFIL, VACIAR, ENGROSAR, EMPALMEARISTA,
  CHAFLANARISTA, EXTRAERARISTAS, SEPARAR, SUAVIZARMALLA (Catmull-Clark),
  DESPLAZA3D, GIRA3D, SIMETRIA3D, MATRIZ3D, ALINEAR3D, CAJADELIM.
- **Consulta** — PROPFIS (volumen, masa, centro de gravedad, momentos y
  productos de inercia, radios de giro) y COMPROBARSOLIDO.
- **Vista** — ventana WebGL con ORBITA, ViewCube, diez estilos visuales
  (estructura alámbrica, oculto, sombreado, sombreado con aristas, tonos de
  gris, conceptual, realista, boceto, rayos X), vistas normalizadas e
  isométricas, proyección paralela o en perspectiva, y designación por rayo.

Las operaciones están contrastadas contra el valor analítico: los volúmenes de
todas las primitivas, extrusiones, revoluciones, barridos y solevados salen
dentro del error de teselación, y seis booleanos encadenados sobre la misma
pieza dan el volumen exacto con la malla cerrada.

## Fabricación (CAM)

Generación de trayectorias y de código de control numérico, al estilo de los
módulos de mecanizado de CATIA o Fusion.

- **Fresado 2.5D** — contorneado con compensación de radio (por ordenador o por
  control, G41/G42), vaciado concéntrico o en zigzag con islas, planeado,
  taladrado con ciclos fijos (G81, G82, G83, G73, G84, G85) y grabado con
  fresa en V.
- **Fresado 3D** — desbaste por planos Z sobre la sección real de la pieza y
  acabado por líneas paralelas con compensación de punta esférica.
- **Torneado** — cilindrado de desbaste (pasadas o ciclo G71), acabado del
  perfil (G70) con compensación de radio de plaquita, refrentado, ranurado con
  picoteo, roscado (G76 o pasadas de sección constante) y tronzado con
  velocidad de corte constante. El perfil de revolución se extrae del propio
  sólido.
- **Entradas** — vertical, en rampa y helicoidal.
- **Herramientas y materiales** — biblioteca con 14 herramientas y nueve
  materiales; el régimen y el avance se calculan a partir de vc y fz, con los
  factores de corrección del material.
- **Salida** — Fanuc 0i/ISO, Haas NGC, Siemens SINUMERIK 840D (ciclos CYCLE81,
  CYCLE83, CYCLE84, CYCLE95, CYCLE99), Heidenhain TNC 640 (conversacional,
  CYCL DEF 200/206), LinuxCNC, GRBL (desarrolla los ciclos que el control no
  tiene), Okuma OSP, Fagor 8055 y Mazak EIA. Hoja de preparación con
  herramientas, regímenes, recorridos y tiempo estimado.
- **Comprobaciones** — aviso de movimientos rápidos por debajo del plano de
  seguridad y estimación del material arrancado.

**Cómo se comporta al dibujar**

- **Rastreo de referencia a objetos** — se adquiere un punto notable dejando el
  cursor sobre él; salen trayectorias de alineación en los ángulos polares y
  sus cruces también capturan, con rótulo de distancia y ángulo.
- **Pinzamientos multifunción** — al activar un pinzamiento, Intro recorre
  ESTIRAR ▸ DESPLAZAR ▸ GIRAR ▸ ESCALA ▸ SIMETRÍA, con opción de copia múltiple.
- **Cotas asociativas** — las cotas tomadas sobre puntos notables siguen a la
  geometría: al alargar o mover el objeto, la medida se recalcula sola.
- **Selección** — ventana, captura, lazo a mano alzada, ciclo entre objetos
  superpuestos e información al pasar el cursor.
- **Mayús + botón derecho** abre el menú de sustitución de referencia, con
  punto medio entre dos puntos incluido.

**Recursos**

- 60 patrones de sombreado (ANSI, AR-, ISO…) y carga de archivos `.pat` propios.
- 65 bloques de biblioteca: arquitectura, sanitarios, mobiliario, eléctrico,
  mecánica y anotación.
- 7 plantillas: arquitectura, mecánica, estructura, electricidad, topografía,
  imperial y en blanco.

## Rendimiento

El visor está pensado para que el dibujo se maneje igual con diez objetos que
con sesenta mil: índice espacial en rejilla, caché de geometría por entidad,
escena en lienzo fuera de pantalla que el encuadre reutiliza, trazados
agrupados por estilo y deshacer por diario de cambios en vez de copias del
documento.

Medido en Chromium a 1600 × 950, milisegundos por operación:

| Objetos 2D | Redibujar | Encuadrar | Designar | Referencias | Deshacer |
|---|---|---|---|---|---|
|  2 000 | 2,5 | 0,06 | 0,4 | 1,5 | 0,7 |
| 20 000 | 9,8 | 0,04 | 0,6 | 1,5 | 0,4 |
| 60 000 | 20,5 | 0,00 | 1,0 | 5,2 | 0,6 |

| Sólidos 3D | Triángulos | Construir búferes | Orbitar | Designar |
|---|---|---|---|---|
|  50 |  20 648 |  4,6 | 0,13 | 0,3 |
| 200 |  85 600 | 14,7 | 0,08 | 0,7 |
| 800 | 342 400 | 45,4 | 0,09 | 2,1 |

Los 60 fps corresponden a 16,7 ms por fotograma. La medida de 3D se ha tomado
con SwiftShader, es decir con OpenGL por software; sobre una tarjeta gráfica
real el margen es mucho mayor.

## Formatos

| Operación | Formatos |
|---|---|
| Lectura 2D | DXF ASCII (R12 … 2018), `.dcad` nativo, **DWG** con el puente |
| Escritura 2D | DXF R12 (AC1009), DXF 2000 (AC1015), `.dcad`, **DWG** con el puente |
| Lectura 3D | STL (texto y binario), OBJ, PLY, OFF, y mallas dentro del DXF |
| Escritura 3D | STL (texto y binario con color), OBJ + MTL, PLY (texto y binario), 3MF, glTF 2.0, GLB, OFF, AMF, VRML 2.0, X3D |
| Salida 2D | PDF vectorial, SVG, PNG |
| Control numérico | Fanuc/ISO, Haas, Siemens 840D, Heidenhain TNC, LinuxCNC, GRBL, Okuma, Fagor, Mazak |

Los sólidos se escriben en el DXF como POLYFACE MESH (y como 3DFACE cuando la
malla supera el límite del formato), que es lo que AutoCAD lee sin ningún
complemento. La ida y vuelta conserva el volumen exacto y la malla cerrada,
tanto en R12 como en R2000.

### Sobre DWG

DWG es un formato binario propietario de Autodesk sin especificación pública:
ninguna página web puede leerlo o escribirlo por sí sola. Este proyecto resuelve
el caso con un servicio aparte (`server/`) que delega la conversión en
**ODA File Converter** o en **LibreDWG**. Con él en marcha, `ABRE` acepta `.dwg`
y `GUARDARDWG` lo escribe.

Sin el puente, el DXF que genera MonxuCAD lo abre AutoCAD de forma nativa y
`GUARDARCOMO` produce el `.dwg` equivalente.

## No se pierde el trabajo

El dibujo se guarda solo en el propio equipo cada pocos segundos y, en
cuanto la aplicación pasa a segundo plano, al instante —que en un
teléfono es el último momento seguro, porque Android mata sin avisar lo
que no está en pantalla—. Si algo se corta, al volver a abrirla ofrece
recuperar lo que quedó a medias, diciendo cuántos objetos eran y de
cuándo. La copia se borra al guardar de verdad.

Cerrar con cambios sin guardar pregunta antes: en el escritorio, con un
diálogo del sistema que ofrece **Guardar y cerrar**, **Cerrar sin
guardar** o **Cancelar**.

## Instalarla en el ordenador o en el teléfono

Descarga directa, sin cuenta y sin descomprimir, desde
[la última compilación](https://github.com/Ramondelallavel/MonxuCAD/releases/latest):

| Dónde | |
|---|---|
| **Android** | [MonxuCAD.apk](https://github.com/Ramondelallavel/MonxuCAD/releases/latest/download/MonxuCAD.apk) — Android 7 o posterior, sin permisos |
| **Windows** | [instalador](https://github.com/Ramondelallavel/MonxuCAD/releases/latest/download/MonxuCAD-windows.exe) · [portable](https://github.com/Ramondelallavel/MonxuCAD/releases/latest/download/MonxuCAD-windows-portable.exe) |
| **macOS** | [Apple Silicon](https://github.com/Ramondelallavel/MonxuCAD/releases/latest/download/MonxuCAD-mac-arm64.dmg) · [Intel](https://github.com/Ramondelallavel/MonxuCAD/releases/latest/download/MonxuCAD-mac-x64.dmg) |
| **Linux** | [AppImage](https://github.com/Ramondelallavel/MonxuCAD/releases/latest/download/MonxuCAD-linux.AppImage) · [.deb](https://github.com/Ramondelallavel/MonxuCAD/releases/latest/download/MonxuCAD-linux.deb) |

También se instala desde el propio navegador con el botón **Instalar**,
sin descargar nada: queda con icono y ventana propios y funciona sin
conexión.

Cada sistema avisa la primera vez de que el programa no viene de su
tienda. Qué botón hay que pulsar en cada caso, y qué hacer si dice que
no se ha podido instalar, está en [`docs/NATIVO.md`](docs/NATIVO.md).

## Puesta en marcha

Sólo la aplicación web (sin DWG): cualquier servidor estático sobre `web/`.

```bash
npx serve web
```

Con el puente DWG:

```bash
cd server
npm install
npm start          # http://localhost:8787 sirve la app y la conversión
```

Con Docker (LibreDWG ya incluido):

```bash
docker build -f server/Dockerfile -t monxucad .
docker run --rm -p 8787:8787 monxucad
```

La instalación del motor de conversión está detallada en
[`docs/INSTALL.md`](docs/INSTALL.md).

## Estructura

```
web/                aplicación (sin dependencias, JavaScript puro)
  index.html
  app.css
  js/
    geom.js         vectores, matrices, intersecciones, colores ACI
    g3.js           álgebra 3D: matrices 4x4, cuaternios, rayos, triangulación
    doc.js          base de datos: entidades, capas, bloques, deshacer
    spatial.js      índice espacial y caché de geometría
    mesh.js         núcleo de mallas: primitivas, barridos, secciones
    csg.js          booleanos de sólidos por árboles BSP
    solid.js        entidades SOLID3D y MALLA en el documento
    dim.js          generación de geometría de cotas
    hatchlib.js     analizador .pat y catálogo de patrones
    blocks.js       biblioteca de bloques
    templates.js    plantillas de dibujo
    render.js       visor 2D: modelo, papel, ventanas gráficas, SCP
    view3d.js       ventana 3D WebGL: órbita, estilos visuales, ViewCube
    snap.js         referencias a objetos, polar, ortogonal
    dxf.js          lectura y escritura de DXF
    boundary.js     detección de contorno por punto interior
    export.js       DXF, SVG, PDF vectorial, PNG, ZIP
    export3d.js     STL, OBJ, PLY, 3MF, glTF, OFF, AMF, VRML, X3D
    cam.js          trayectorias de fresado y de torneado
    post.js         postprocesadores de control numérico
    cmd.js          motor de comandos y peticiones asíncronas
    commands-*.js   biblioteca de comandos
    ui.js           cinta, paletas, diálogos, barra de estado
    main.js         interacción, archivos, arranque
    app3d.js        conmutador 2D/3D, navegación y trayectorias en pantalla
    dwgbridge.js    cliente del puente DWG
    instalar.js     instalación en el equipo y archivos de arranque
    autoguardado.js copia de seguridad, recuperación y red de errores
  sw.js             copia local para trabajar sin conexión
  manifest.webmanifest
desktop/            envoltura de escritorio (Electron)
android/            envoltura de Android (WebView)
pruebas/            pruebas de regresión del dibujo 2D
server/             servicio de conversión DWG ⇄ DXF
docs/               instalación nativa y motor de conversión
```

## Atajos

```
Esc            Cancelar             Intro / Espacio  Repetir o aceptar
F1 Ayuda       F3 Refent            F7 Rejilla       F8 Orto
F9 Forzcursor  F10 Polar            F12 Din          Ctrl+0 Pantalla limpia
Ctrl+Z/Y       Ctrl+C/X/V           Ctrl+S/O/P       Ctrl+A Designar todo
Rueda: zoom    Rueda pulsada: encuadre              Supr: borrar selección
```

## Licencia

MIT.
