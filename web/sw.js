/* ============================================================
   Service worker

   Guarda la aplicación entera para que arranque sin red.  La
   lista de archivos no está escrita aquí a mano: se saca de
   index.html al instalar, leyendo sus etiquetas <script> y la
   hoja de estilo.  Así no se queda corta cuando se añade un
   módulo, y encaja con que el flujo de GitHub Pages quite el
   puente DWG del índice antes de publicar.
   ============================================================ */
'use strict';

var VERSION = 'monxucad-v1';

var FIJOS = [
  './',
  './index.html',
  './app.css',
  './manifest.webmanifest',
  './iconos/icono.svg',
  './iconos/icono-192.png',
  './iconos/icono-512.png',
  './iconos/icono-mascara-512.png'
];

/* Los scripts de index.html, en el orden en que se cargan. */
async function listaDeArchivos() {
  var lista = FIJOS.slice();
  try {
    var res = await fetch('./index.html', { cache: 'reload' });
    if (!res.ok) return lista;
    var html = await res.text();
    var re = /<(?:script[^>]*\ssrc|link[^>]*\shref)=["']([^"':]+)["']/gi, m;
    while ((m = re.exec(html))) {
      var ruta = './' + m[1].replace(/^\.?\//, '');
      if (lista.indexOf(ruta) < 0) lista.push(ruta);
    }
  } catch (e) { /* sin red en la instalación: se cachea lo que se pueda */ }
  return lista;
}

self.addEventListener('install', function (ev) {
  ev.waitUntil((async function () {
    var cache = await caches.open(VERSION);
    var lista = await listaDeArchivos();
    /* Uno a uno: que falte un archivo suelto no puede tumbar la
       instalación entera, pero el índice y la hoja de estilo sí
       son imprescindibles. */
    var resultados = await Promise.all(lista.map(function (u) {
      return cache.add(new Request(u, { cache: 'reload' })).then(
        function () { return true; },
        function () { return u; }
      );
    }));
    var faltan = resultados.filter(function (r) { return r !== true; });
    if (faltan.length) console.warn('MonxuCAD: sin guardar', faltan);
    var roto = faltan.some(function (u) { return /index\.html$|app\.css$|\/$/.test(u); });
    if (roto) throw new Error('no se pudo guardar la aplicación para uso sin red');
  })());
});

self.addEventListener('activate', function (ev) {
  ev.waitUntil((async function () {
    var nombres = await caches.keys();
    await Promise.all(nombres.map(function (n) {
      return n === VERSION ? null : caches.delete(n);
    }));
    await self.clients.claim();
  })());
});

self.addEventListener('message', function (ev) {
  if (ev.data === 'saltar-espera') self.skipWaiting();
});

/* Primero lo guardado, que es lo que hace que arranque sin red y al
   instante; si no está, la red, y lo que venga se guarda para la
   próxima.  Una navegación sin red cae en el índice. */
self.addEventListener('fetch', function (ev) {
  var req = ev.request;
  if (req.method !== 'GET') return;

  var url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;

  ev.respondWith((async function () {
    var guardado = await caches.match(req, { ignoreSearch: true });
    if (guardado) return guardado;
    try {
      var res = await fetch(req);
      if (res && res.ok && res.type === 'basic') {
        var cache = await caches.open(VERSION);
        cache.put(req, res.clone());
      }
      return res;
    } catch (e) {
      if (req.mode === 'navigate') {
        var indice = await caches.match('./index.html');
        if (indice) return indice;
      }
      throw e;
    }
  })());
});
