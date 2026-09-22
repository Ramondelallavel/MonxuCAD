/* ============================================================
   Autoguardado, recuperación y red de seguridad

   Un programa de dibujo que pierde el trabajo no sirve para
   trabajar.  Hasta ahora, cerrar la pestaña se lo llevaba todo, y en
   el teléfono ni siquiera hace falta cerrarla: Android mata lo que
   está en segundo plano cuando necesita memoria, sin avisar.

   Aquí se guarda una copia del dibujo en la propia máquina —en
   IndexedDB, que aguanta megabytes; el almacén corriente se queda en
   cinco— cada pocos segundos y, sobre todo, en cuanto la aplicación
   pasa a segundo plano, que es el último momento seguro.  Al
   arrancar, si hay una copia con trabajo dentro, se ofrece
   recuperarla.

   La copia se borra al guardar de verdad y al empezar un dibujo
   nuevo: si sigue ahí es que algo se quedó a medias.
   ============================================================ */
(function () {
  'use strict';

  var BASE = 'monxucad';
  var ALMACEN = 'copias';
  var CLAVE = 'actual';
  var PAUSA_MINIMA = 20000;

  var bd = null;
  var guardando = false;
  var ultimoCoste = 0;
  var reloj = null;

  function abre() {
    return new Promise(function (listo, falla) {
      if (bd) { listo(bd); return; }
      if (!window.indexedDB) { falla(new Error('sin IndexedDB')); return; }
      var pet = indexedDB.open(BASE, 1);
      pet.onupgradeneeded = function () {
        var d = pet.result;
        if (!d.objectStoreNames.contains(ALMACEN)) d.createObjectStore(ALMACEN);
      };
      pet.onsuccess = function () { bd = pet.result; listo(bd); };
      pet.onerror = function () { falla(pet.error || new Error('no se pudo abrir')); };
      pet.onblocked = function () { falla(new Error('base bloqueada')); };
    });
  }

  function conAlmacen(modo, fn) {
    return abre().then(function (d) {
      return new Promise(function (listo, falla) {
        var tr = d.transaction(ALMACEN, modo);
        var pet = fn(tr.objectStore(ALMACEN));
        tr.oncomplete = function () { listo(pet ? pet.result : undefined); };
        tr.onerror = function () { falla(tr.error); };
        tr.onabort = function () { falla(tr.error || new Error('transacción abortada')); };
      });
    });
  }

  function escribe(copia) { return conAlmacen('readwrite', function (a) { return a.put(copia, CLAVE); }); }
  function lee() { return conAlmacen('readonly', function (a) { return a.get(CLAVE); }); }
  function borra() { return conAlmacen('readwrite', function (a) { return a.delete(CLAVE); }); }

  /* ------------------------------------------------------------
     Guardar
     ------------------------------------------------------------ */
  async function copia(app, motivo) {
    if (guardando) return false;
    var doc = app && app.doc;
    if (!doc || !doc.dirty) return false;
    /* Un dibujo en blanco no merece una copia ni un aviso. */
    if (!doc.entities.length) return false;

    guardando = true;
    try {
      var t0 = (window.performance && performance.now()) || Date.now();
      var json = app.docToJSON();
      await escribe({
        nombre: doc.name || 'Dibujo1.dxf',
        json: json,
        cuando: Date.now(),
        entidades: doc.entities.length,
        motivo: motivo || 'reloj'
      });
      ultimoCoste = ((window.performance && performance.now()) || Date.now()) - t0;
      return true;
    } catch (e) {
      console.warn('MonxuCAD: no se pudo guardar la copia', e);
      return false;
    } finally {
      guardando = false;
    }
  }

  /* Con un dibujo muy grande, serializar cuesta; se espacia sola para
     no comerse el tiempo que hace falta para dibujar. */
  function programa(app) {
    clearTimeout(reloj);
    var pausa = Math.max(PAUSA_MINIMA, Math.round(ultimoCoste * 40));
    reloj = setTimeout(function () {
      copia(app).then(function () { programa(app); });
    }, pausa);
  }

  /* ------------------------------------------------------------
     Recuperar
     ------------------------------------------------------------ */
  function cuandoFue(t) {
    var d = new Date(t);
    var hoy = new Date();
    var hora = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    if (d.toDateString() === hoy.toDateString()) return 'hoy a las ' + hora;
    return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + ' a las ' + hora;
  }

  async function ofrece(app) {
    var c;
    try { c = await lee(); } catch (e) { return; }
    if (!c || !c.json || !c.entidades) return;

    var quiere = await app.ui.dialog({
      title: 'Recuperar el dibujo',
      width: 480,
      body: '<p style="margin-top:0">La vez anterior quedó un dibujo sin guardar:</p>' +
        '<p><b>' + String(c.nombre).replace(/[<>&]/g, '') + '</b><br>' +
        '<span style="color:var(--ink-dim)">' + c.entidades.toLocaleString('es-ES') +
        ' objeto(s), de ' + cuandoFue(c.cuando) + '</span></p>' +
        '<p style="color:var(--ink-dim)">Si lo descarta, se pierde.</p>',
      buttons: [
        { label: 'Recuperarlo', value: true, primary: true },
        { label: 'Descartar', value: false }
      ]
    });

    if (!quiere) { borra().catch(function () { }); return; }

    try {
      var doc = app.docFromJSON(JSON.parse(c.json));
      app.adoptaDoc(doc, c.nombre);
      app.doc.dirty = true;
      app.refresh();
      app.out('Dibujo recuperado: ' + c.entidades.toLocaleString('es-ES') +
              ' objeto(s) de ' + cuandoFue(c.cuando) + '.', 'ok');
      app.out('Guárdelo con GUARDAR para no volver a depender de la copia.', 'warn');
    } catch (e) {
      app.out('La copia estaba dañada y no se ha podido recuperar.', 'err');
      borra().catch(function () { });
    }
  }

  /* ------------------------------------------------------------
     Enganches
     ------------------------------------------------------------ */
  function engancha(app) {
    /* Guardar de verdad deja la copia sin razón de ser. */
    var guardarOriginal = app.saveDrawing;
    app.saveDrawing = async function (as) {
      var r = await guardarOriginal.call(this, as);
      if (!this.doc.dirty) borra().catch(function () { });
      return r;
    };

    /* El último momento seguro en un teléfono: Android mata lo que
       está en segundo plano sin avisar, y esto llega antes. */
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') copia(app, 'segundo plano');
    });
    window.addEventListener('pagehide', function () { copia(app, 'cierre'); });

    /* Aviso del navegador al cerrar con cambios.  En las envolturas
       nativas no: allí el aviso lo da el propio programa con un
       diálogo del sistema, y éste se limitaría a bloquear el cierre
       sin decir por qué. */
    if (!window.MonxuNative) {
      window.addEventListener('beforeunload', function (e) {
        if (!app.doc || !app.doc.dirty || !app.doc.entities.length) return;
        e.preventDefault();
        e.returnValue = '';
        return '';
      });
    }

    programa(app);
  }

  /* ------------------------------------------------------------
     Red de seguridad

     Si un comando revienta, la aplicación se quedaba esperando una
     respuesta que no iba a llegar y no había manera de saberlo.
     ------------------------------------------------------------ */
  function red(app) {
    function cuenta(que, err) {
      var msg = (err && (err.message || err)) || 'error desconocido';
      try {
        app.out(que + ': ' + msg, 'err');
        if (app.pending) {
          app.out('*Cancelado* — el comando no pudo terminar.', 'warn');
          app.cancel();
        }
      } catch (e) { /* si ni esto se puede, queda la consola */ }
      console.error(que, err);
    }
    window.addEventListener('error', function (e) {
      if (e && e.message) cuenta('Error', e.error || e.message);
    });
    window.addEventListener('unhandledrejection', function (e) {
      cuenta('Error', e && e.reason);
    });
  }

  /* ------------------------------------------------------------
     Arranque
     ------------------------------------------------------------ */
  function espera(fn) {
    if (window.CADAPP) { fn(window.CADAPP); return; }
    var n = 0;
    var t = setInterval(function () {
      if (window.CADAPP) { clearInterval(t); fn(window.CADAPP); }
      else if (++n > 100) clearInterval(t);
    }, 100);
  }

  espera(function (app) {
    red(app);
    engancha(app);
    /* La oferta de recuperar espera a que la aplicación esté pintada:
       un diálogo encima de una pantalla a medio dibujar asusta. */
    setTimeout(function () { ofrece(app); }, 600);
  });

  /* Para las pruebas y para quien quiera limpiarla a mano. */
  window.CADCopia = { guarda: copia, lee: lee, borra: borra };
})();
