# Cómo abrir MonxuCAD desde un enlace de internet

La aplicación es HTML y JavaScript sin compilar ni dependencias: cualquier
servidor de archivos estáticos la sirve tal cual. Aquí van tres formas, de la
más sencilla a la más completa.

## 1. GitHub Pages (gratis, un solo ajuste)

El repositorio ya trae el flujo de trabajo `.github/workflows/pages.yml`.

1. Entra en **Settings ▸ Pages** del repositorio.
2. En **Build and deployment ▸ Source**, elige **GitHub Actions**.
3. Ve a **Actions ▸ Publicar en GitHub Pages** y pulsa **Run workflow**
   sobre la rama `claude/serene-dijkstra-7fyzv7` (o fusiónala en `main`,
   que también dispara la publicación).

Ese primer ajuste hay que hacerlo a mano una sola vez: el testigo con el que
corre el flujo no tiene permiso para crear el sitio de Pages, y mientras no
esté activado el trabajo falla con *«Resource not accessible by integration»*.
Una vez activado, cada envío publica solo.

A los dos o tres minutos la aplicación queda en:

```
https://ramondelallavel.github.io/MonxuCAD/
```

Ese enlace es público: se abre desde cualquier ordenador, tableta o móvil, sin
instalar nada. Cada vez que se empuje a `main`, Pages se actualiza solo.

Lo único que no funciona ahí es el puente DWG, porque necesita un proceso Node
en el servidor. El flujo de trabajo lo quita del sitio publicado; todo lo demás
—DXF, 3D, STL, código de control numérico— funciona igual.

## 2. Netlify o Vercel (gratis, con dominio propio)

Ambos detectan el repositorio y despliegan sin configuración:

- **Netlify** — «Add new site ▸ Import an existing project», elige el
  repositorio, deja vacío el comando de compilación y pon `web` como
  *publish directory*.
- **Vercel** — «Add New ▸ Project», elige el repositorio, *Framework Preset*
  «Other», *Output Directory* `web`.

Sale un enlace del tipo `https://monxucad.netlify.app`, y desde los ajustes se
le puede poner un dominio propio.

## 3. Con el puente DWG incluido

Para que `ABRE` acepte `.dwg` y `GUARDARDWG` lo escriba hace falta el servicio
de `server/`, así que necesitas un alojamiento que ejecute Node (Render,
Railway, Fly.io, un VPS o un servidor de la empresa).

Con Docker, que ya trae LibreDWG compilado:

```bash
docker build -f server/Dockerfile -t monxucad .
docker run -d -p 8787:8787 --name monxucad monxucad
```

El servicio sirve la aplicación y la conversión en el mismo puerto:
`http://TU-SERVIDOR:8787`.

En Render o Railway basta con apuntar al repositorio y al `server/Dockerfile`;
ambos dan un enlace `https://` con certificado.

## 4. En local, sin internet

```bash
npx serve web           # http://localhost:3000
```

o, si no quieres instalar nada:

```bash
python3 -m http.server 8000 --directory web
```

## Nota sobre abrir el archivo directamente

Abrir `web/index.html` con doble clic (`file://`) funciona para dibujar, pero el
navegador bloquea algunas operaciones con archivos por seguridad. Con cualquiera
de los métodos de arriba se evita ese problema.
