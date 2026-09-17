# MonxuCAD

Estación de dibujo y diseño 2D que se ejecuta en el navegador, construida para
parecerse a AutoCAD en interfaz, comandos y formatos de archivo.

![estado](https://img.shields.io/badge/comandos-146-blue) ![formatos](https://img.shields.io/badge/DXF-R12%20%7C%202000-green) ![licencia](https://img.shields.io/badge/licencia-MIT-lightgrey)

## Qué incluye

**Interfaz** — Botón de aplicación, barra de acceso rápido, cinta de opciones con
seis fichas y sus paneles, paleta de propiedades editable, paleta de bloques,
ViewCube, barra de navegación, pestañas de Modelo y presentaciones, ventana de
comandos con histórico y autocompletado, y barra de estado con los conmutadores
REJILLA · FORZCURSOR · ORTO · POLAR · REFENT · RASTREO · DIN · GROSOR.
Tema oscuro y tema claro.

**146 comandos** con nombre en español e inglés y sus alias (`L`, `C`, `REC`,
`TR`, `F`, `O`, `X`…). Motor de peticiones idéntico al original:
`Precise punto siguiente o [Cerrar/desHacer]:`, entrada `x,y`, `@dx,dy`,
`@dist<ángulo` y distancia directa, Esc cancela, Intro repite.

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

**Recursos**

- 60 patrones de sombreado (ANSI, AR-, ISO…) y carga de archivos `.pat` propios.
- 65 bloques de biblioteca: arquitectura, sanitarios, mobiliario, eléctrico,
  mecánica y anotación.
- 7 plantillas: arquitectura, mecánica, estructura, electricidad, topografía,
  imperial y en blanco.

## Formatos

| Operación | Formatos |
|---|---|
| Lectura   | DXF ASCII (R12 … 2018), `.dcad` nativo, **DWG** con el puente |
| Escritura | DXF R12 (AC1009), DXF 2000 (AC1015), `.dcad`, **DWG** con el puente |
| Salida    | PDF vectorial, SVG, PNG |

### Sobre DWG

DWG es un formato binario propietario de Autodesk sin especificación pública:
ninguna página web puede leerlo o escribirlo por sí sola. Este proyecto resuelve
el caso con un servicio aparte (`server/`) que delega la conversión en
**ODA File Converter** o en **LibreDWG**. Con él en marcha, `ABRE` acepta `.dwg`
y `GUARDARDWG` lo escribe.

Sin el puente, el DXF que genera MonxuCAD lo abre AutoCAD de forma nativa y
`GUARDARCOMO` produce el `.dwg` equivalente.

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
    doc.js          base de datos: entidades, capas, bloques, deshacer
    dim.js          generación de geometría de cotas
    hatchlib.js     analizador .pat y catálogo de patrones
    blocks.js       biblioteca de bloques
    templates.js    plantillas de dibujo
    render.js       visor: modelo, papel, ventanas gráficas, SCP
    snap.js         referencias a objetos, polar, ortogonal
    dxf.js          lectura y escritura de DXF
    boundary.js     detección de contorno por punto interior
    export.js       DXF, SVG, PDF vectorial, PNG, ZIP
    cmd.js          motor de comandos y peticiones asíncronas
    commands-*.js   biblioteca de comandos
    ui.js           cinta, paletas, diálogos, barra de estado
    main.js         interacción, archivos, arranque
    dwgbridge.js    cliente del puente DWG
server/             servicio de conversión DWG ⇄ DXF
docs/               instalación del motor de conversión
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
