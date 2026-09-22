/* ============================================================
   Instalación en el equipo

   Registra el service worker, ofrece el botón «Instalar» cuando el
   navegador lo permite y recoge los archivos con los que el sistema
   arranca la aplicación cuando ya está instalada (abrir un .dxf con
   doble clic).

   Todo esto sólo tiene sentido servido por http o https.  Abierta
   como archivo suelto, o dentro del visor de claude.ai, el módulo no
   hace nada.
   ============================================================ */
(function () {
  'use strict';

  var enServidor = location.protocol === 'http:' || location.protocol === 'https:';
  var instalada = false;
  try {
    instalada = window.matchMedia('(display-mode: standalone)').matches ||
                window.matchMedia('(display-mode: window-controls-overlay)').matches ||
                navigator.standalone === true;
  } catch (e) { /* navegador sin matchMedia para display-mode */ }

  function aviso(msg) {
    var app = window.CADAPP;
    if (app && app.ui && app.ui.flashResult) app.ui.flashResult(msg);
    else if (app && app.out) app.out(msg);
  }

  /* ------------------------------------------------------------
     Service worker
     ------------------------------------------------------------ */
  function registra() {
    if (!enServidor || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('sw.js', { scope: './' }).then(function (reg) {
      /* Hay entornos que anulan el registro y contestan sin nada. */
      if (!reg || !reg.addEventListener) return;
      reg.addEventListener('updatefound', function () {
        var nuevo = reg.installing;
        if (!nuevo) return;
        nuevo.addEventListener('statechange', function () {
          /* Sólo es una actualización si ya había una versión sirviendo;
             la primera instalación no tiene nada que avisar. */
          if (nuevo.state === 'installed' && navigator.serviceWorker.controller)
            aviso('Hay una versión nueva. Cierre y vuelva a abrir para usarla.');
        });
      });
    }, function (err) {
      console.warn('MonxuCAD: no se pudo registrar el service worker', err);
    });
  }

  /* ------------------------------------------------------------
     Botón de instalación
     ------------------------------------------------------------ */
  var peticion = null;

  function pintaBoton() {
    if (document.getElementById('btnInstalar')) return;
    var zona = document.querySelector('.title-right');
    if (!zona) return;
    var b = document.createElement('button');
    b.id = 'btnInstalar';
    b.className = 'tbtn';
    b.type = 'button';
    b.textContent = 'Instalar';
    b.title = 'Instalar MonxuCAD en este equipo';
    b.addEventListener('click', async function () {
      if (!peticion) return;
      b.disabled = true;
      try {
        peticion.prompt();
        var res = await peticion.userChoice;
        if (res && res.outcome === 'accepted') quitaBoton();
        else b.disabled = false;
      } catch (e) { b.disabled = false; }
      peticion = null;
    });
    zona.insertBefore(b, zona.firstChild);
  }

  function quitaBoton() {
    var b = document.getElementById('btnInstalar');
    if (b && b.parentNode) b.parentNode.removeChild(b);
  }

  window.addEventListener('beforeinstallprompt', function (ev) {
    ev.preventDefault();
    peticion = ev;
    if (!instalada) pintaBoton();
  });

  window.addEventListener('appinstalled', function () {
    instalada = true;
    peticion = null;
    quitaBoton();
    aviso('MonxuCAD queda instalado en este equipo.');
  });

  /* ------------------------------------------------------------
     Archivos con los que arranca el sistema

     Instalada, la aplicación queda declarada como programa que abre
     .dxf y .dcad.  Al abrir uno, el sistema la arranca y entrega el
     archivo por aquí.
     ------------------------------------------------------------ */
  function recogeArchivos() {
    if (!('launchQueue' in window) || !window.launchQueue.setConsumer) return;
    window.launchQueue.setConsumer(function (lanzamiento) {
      if (!lanzamiento || !lanzamiento.files || !lanzamiento.files.length) return;
      esperaApp(async function (app) {
        try {
          var f = await lanzamiento.files[0].getFile();
          app.loadFile(f);
        } catch (e) {
          app.out('No se pudo abrir el archivo con el que se ha arrancado.', 'err');
        }
      });
    });
  }

  /* Las versiones de escritorio y de Android entregan por aquí el
     dibujo con el que las ha arrancado el sistema. */
  function recogeDelNativo() {
    var n = window.MonxuNative;
    if (!n || typeof n.alAbrir !== 'function') return;
    n.alAbrir(function (datos) {
      if (!datos || !datos.base64) return;
      esperaApp(function (app) {
        try {
          var bruto = atob(datos.base64), bytes = new Uint8Array(bruto.length);
          for (var i = 0; i < bruto.length; i++) bytes[i] = bruto.charCodeAt(i);
          app.loadFile(new File([bytes], datos.nombre || 'dibujo.dxf'));
        } catch (e) {
          app.out('No se pudo abrir ' + (datos.nombre || 'el archivo') + '.', 'err');
        }
      });
    });
  }

  /* main.js crea la aplicación al cargar la página; el lanzamiento
     puede llegar antes. */
  function esperaApp(fn) {
    if (window.CADAPP) { fn(window.CADAPP); return; }
    var intentos = 0;
    var t = setInterval(function () {
      if (window.CADAPP) { clearInterval(t); fn(window.CADAPP); }
      else if (++intentos > 100) clearInterval(t);
    }, 100);
  }

  registra();
  recogeArchivos();
  recogeDelNativo();
})();
