/* ============================================================
   MonxuCAD de escritorio

   Envuelve la misma aplicación que corre en el navegador.  Lo que
   añade es lo que un programa de escritorio tiene y una página no:
   guardar donde uno quiera con el diálogo del sistema, abrir un
   dibujo con doble clic desde el explorador de archivos y menús.

   La página no se sirve por file://, sino por un esquema propio,
   app://, declarado como origen seguro.  Así el almacenamiento y
   las llamadas a fetch se comportan igual que en el navegador, en
   vez de quedar en un origen opaco donde fallan.
   ============================================================ */
'use strict';

const { app, BrowserWindow, Menu, dialog, ipcMain, protocol, shell } = require('electron');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

const RAIZ = app.isPackaged
  ? path.join(process.resourcesPath, 'web')
  : path.join(__dirname, '..', 'web');

const INICIO = 'app://monxucad/index.html';

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8'
};

protocol.registerSchemesAsPrivileged([{
  scheme: 'app',
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true }
}]);

let ventana = null;
/* Los archivos con los que arranca el sistema llegan antes de que la
   página esté en pie; esperan aquí hasta que avisa de que ya puede. */
let pendientes = [];
let rendidoListo = false;
let ultimaCarpeta = app.getPath('documents');

/* ------------------------------------------------------------
   Servir la aplicación
   ------------------------------------------------------------ */
function sirve() {
  protocol.handle('app', async function (peticion) {
    let rel;
    try { rel = decodeURIComponent(new URL(peticion.url).pathname); }
    catch (e) { return new Response('', { status: 400 }); }
    if (rel === '/' || rel === '') rel = '/index.html';

    const destino = path.join(RAIZ, path.normalize(rel));
    /* Que una ruta con .. no se salga de la carpeta de la aplicación. */
    if (destino !== RAIZ && !destino.startsWith(RAIZ + path.sep))
      return new Response('', { status: 403 });

    try {
      const datos = await fsp.readFile(destino);
      return new Response(datos, {
        status: 200,
        headers: { 'content-type': TIPOS[path.extname(destino).toLowerCase()] || 'application/octet-stream' }
      });
    } catch (e) {
      return new Response('', { status: 404 });
    }
  });
}

/* ------------------------------------------------------------
   Guardar archivos

   Es lo que llama la aplicación por window.MonxuNative.guardar.
   Devuelve «ok:<ruta>», «cancelado» o «error:<motivo>».
   ------------------------------------------------------------ */
ipcMain.handle('monxucad:guardar', async function (ev, datos) {
  const nombre = String(datos && datos.nombre || 'dibujo.dxf');
  const ext = path.extname(nombre).replace('.', '').toLowerCase();
  const win = BrowserWindow.fromWebContents(ev.sender);

  const res = await dialog.showSaveDialog(win, {
    title: 'Guardar ' + nombre,
    defaultPath: path.join(ultimaCarpeta, path.basename(nombre)),
    filters: ext
      ? [{ name: ext.toUpperCase(), extensions: [ext] }, { name: 'Todos', extensions: ['*'] }]
      : [{ name: 'Todos', extensions: ['*'] }]
  });
  if (res.canceled || !res.filePath) return 'cancelado';

  try {
    await fsp.writeFile(res.filePath, Buffer.from(String(datos.base64 || ''), 'base64'));
    ultimaCarpeta = path.dirname(res.filePath);
    return 'ok:' + res.filePath;
  } catch (e) {
    return 'error:' + e.message;
  }
});

/* ------------------------------------------------------------
   Abrir archivos que manda el sistema
   ------------------------------------------------------------ */
function esDibujo(ruta) {
  return /\.(dxf|dcad|json|dwg)$/i.test(ruta);
}

async function entrega(ruta) {
  try {
    const datos = await fsp.readFile(ruta);
    const paquete = { nombre: path.basename(ruta), base64: datos.toString('base64') };
    if (rendidoListo && ventana && !ventana.isDestroyed()) ventana.webContents.send('monxucad:abrir', paquete);
    else pendientes.push(paquete);
    ultimaCarpeta = path.dirname(ruta);
  } catch (e) {
    dialog.showErrorBox('MonxuCAD', 'No se pudo leer ' + ruta + '\n\n' + e.message);
  }
}

function deLaLinea(argv) {
  return argv.slice(1).filter(function (a) { return !a.startsWith('-') && esDibujo(a) && fs.existsSync(a); });
}

ipcMain.on('monxucad:listo', function (ev) {
  rendidoListo = true;
  const cola = pendientes;
  pendientes = [];
  cola.forEach(function (p) { ev.sender.send('monxucad:abrir', p); });
});

/* ------------------------------------------------------------
   Menús
   ------------------------------------------------------------ */
function manda(js) {
  return function () {
    if (ventana && !ventana.isDestroyed()) ventana.webContents.executeJavaScript(js, true).catch(function () {});
  };
}

/* La aplicación ya se ocupa ella misma de Ctrl+S, Ctrl+O, Ctrl+Z y
   compañía.  Los atajos se enseñan en el menú pero no se registran,
   para que no se ejecute la orden dos veces. */
function conAtajo(label, atajo, js) {
  return { label: label, accelerator: atajo, registerAccelerator: false, click: manda(js) };
}

function montaMenu() {
  const enMac = process.platform === 'darwin';
  const plantilla = [];

  if (enMac) plantilla.push({ role: 'appMenu' });

  plantilla.push({
    label: '&Archivo',
    submenu: [
      conAtajo('Nuevo', 'CmdOrCtrl+N', "window.CADAPP && CADAPP.startCommand('NUEVO')"),
      conAtajo('Abrir…', 'CmdOrCtrl+O', "window.CADAPP && CADAPP.openDrawing()"),
      { type: 'separator' },
      conAtajo('Guardar', 'CmdOrCtrl+S', "window.CADAPP && CADAPP.saveDrawing(false)"),
      { label: 'Guardar como…', click: manda("window.CADAPP && CADAPP.saveDrawing(true)") },
      { type: 'separator' },
      { label: 'Exportar…', click: manda("window.CADAPP && CADAPP.startCommand('EXPORTAR')") },
      { label: 'Exportar 3D…', click: manda("window.CADAPP && CADAPP.startCommand('EXPORTA3D')") },
      conAtajo('Trazar…', 'CmdOrCtrl+P', "window.CADAPP && CADAPP.startCommand('TRAZAR')"),
      { type: 'separator' },
      enMac ? { role: 'close', label: 'Cerrar' } : { role: 'quit', label: 'Salir' }
    ]
  });

  plantilla.push({
    label: '&Edición',
    submenu: [
      conAtajo('Deshacer', 'CmdOrCtrl+Z', "window.CADAPP && CADAPP.startCommand('H')"),
      conAtajo('Rehacer', 'CmdOrCtrl+Y', "window.CADAPP && CADAPP.startCommand('REHACER')"),
      { type: 'separator' },
      conAtajo('Copiar', 'CmdOrCtrl+C', "window.CADAPP && CADAPP.startCommand('COPIAPP')"),
      conAtajo('Pegar', 'CmdOrCtrl+V', "window.CADAPP && CADAPP.startCommand('PEGARPP')"),
      { type: 'separator' },
      { label: 'Opciones…', click: manda("window.CADAPP && CADAPP.startCommand('OPCIONES')") }
    ]
  });

  plantilla.push({
    label: '&Ver',
    submenu: [
      { label: 'Zoom a los objetos', click: manda("window.CADAPP && CADAPP.startCommand('ZOOM', ['E'])") },
      { type: 'separator' },
      { role: 'zoomIn', label: 'Agrandar la interfaz', accelerator: 'CmdOrCtrl+Alt+Plus' },
      { role: 'zoomOut', label: 'Achicar la interfaz', accelerator: 'CmdOrCtrl+Alt+-' },
      { role: 'resetZoom', label: 'Interfaz a tamaño normal', accelerator: 'CmdOrCtrl+Alt+0' },
      { type: 'separator' },
      { role: 'togglefullscreen', label: 'Pantalla completa' },
      { role: 'reload', label: 'Recargar' },
      { role: 'toggleDevTools', label: 'Herramientas de desarrollo' }
    ]
  });

  plantilla.push({
    label: 'A&yuda',
    submenu: [
      { label: 'Lista de comandos', click: manda("window.CADAPP && CADAPP.startCommand('AYUDA')") },
      { label: 'Acerca de MonxuCAD', click: manda("window.CADAPP && CADAPP.ui && CADAPP.ui.about && CADAPP.ui.about()") },
      { type: 'separator' },
      {
        label: 'Código fuente',
        click: function () { shell.openExternal('https://github.com/Ramondelallavel/monxucad'); }
      }
    ]
  });

  Menu.setApplicationMenu(Menu.buildFromTemplate(plantilla));
}

/* ------------------------------------------------------------
   Ventana
   ------------------------------------------------------------ */
function creaVentana() {
  ventana = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#2b2e31',
    show: false,
    title: 'MonxuCAD',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false
    }
  });

  ventana.once('ready-to-show', function () { ventana.show(); });
  ventana.on('closed', function () { ventana = null; rendidoListo = false; });

  /* La recarga vuelve a levantar la página: la cola de archivos
     tiene que esperar otra vez al aviso de que está lista. */
  ventana.webContents.on('did-start-navigation', function (ev) {
    if (ev.isMainFrame) rendidoListo = false;
  });

  /* Nada de abrir ventanas ni de salir de la aplicación: los enlaces
     de fuera van al navegador del sistema. */
  ventana.webContents.setWindowOpenHandler(function (datos) {
    if (/^https?:/.test(datos.url)) shell.openExternal(datos.url);
    return { action: 'deny' };
  });
  ventana.webContents.on('will-navigate', function (ev, url) {
    if (!url.startsWith('app://')) {
      ev.preventDefault();
      if (/^https?:/.test(url)) shell.openExternal(url);
    }
  });

  ventana.loadURL(INICIO);
}

/* ------------------------------------------------------------
   Arranque

   Una sola copia abierta: si se abre otro dibujo con doble clic, va
   a la ventana que ya está en pie en vez de arrancar otra.
   ------------------------------------------------------------ */
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', function (ev, argv) {
    if (ventana) {
      if (ventana.isMinimized()) ventana.restore();
      ventana.focus();
    }
    deLaLinea(argv).forEach(entrega);
  });

  /* macOS entrega los archivos por aquí, no por la línea de órdenes. */
  app.on('open-file', function (ev, ruta) {
    ev.preventDefault();
    if (app.isReady()) entrega(ruta);
    else app.once('ready', function () { entrega(ruta); });
  });

  app.whenReady().then(function () {
    sirve();
    montaMenu();
    creaVentana();
    deLaLinea(process.argv).forEach(entrega);

    app.on('activate', function () {
      if (BrowserWindow.getAllWindows().length === 0) creaVentana();
    });
  });

  app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
  });
}
