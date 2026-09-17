# Puente DWG de MonxuCAD

Servicio HTTP mínimo que convierte entre DWG y DXF usando un motor externo.
MonxuCAD, al ser una aplicación de navegador, no puede leer ni escribir DWG:
es un formato binario propietario de Autodesk sin especificación pública.
Este servicio pone ese trozo del trabajo en un proceso que sí puede hacerlo.

## Arranque rápido

```bash
cd server
npm install
npm start
# http://localhost:8787
```

Sin motor instalado el servicio arranca igual, sirve la aplicación web y
responde con un error claro en `/api/health`.

## Con Docker (incluye LibreDWG)

```bash
docker build -f server/Dockerfile -t monxucad .
docker run --rm -p 8787:8787 monxucad
```

## API

| Método | Ruta | Entrada | Salida |
|---|---|---|---|
| `GET`  | `/api/health` | — | motores detectados y formatos disponibles |
| `POST` | `/api/dwg2dxf?version=2000` | `multipart/form-data`, campo `file` | texto DXF |
| `POST` | `/api/dxf2dwg?version=2018&name=plano` | `text/plain` con el DXF | binario DWG |

`version` admite `R12, 2000, 2004, 2007, 2010, 2013, 2018`.

## Motores

1. **ODA File Converter** — gratuito (registro), cerrado. Lee y escribe todas
   las versiones con la mejor fidelidad. Es el recomendado.
2. **LibreDWG** — libre (GPL). `dwgread` lee hasta R2018; `dwgwrite` escribe
   R13–R2000, y sigue siendo experimental.

El detalle de instalación está en [`docs/INSTALL.md`](../docs/INSTALL.md).
