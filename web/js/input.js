/* ============================================================
   input.js — Capa de entrada al estilo de AutoCAD

   En AutoCAD la línea de comandos siempre "escucha": se dibuje con
   el ratón o se teclee, Intro y Espacio terminan o repiten, el botón
   derecho hace de Intro o abre el menú contextual, y cualquier tecla
   imprimible empieza a escribir un comando.  Este módulo impone ese
   comportamiento por encima del reparto de eventos del navegador,
   que por sí solo pierde el foco en cuanto se pincha en el lienzo.
   ============================================================ */
(function () {
  'use strict';
  var CAD = window.CAD, App = CAD.App;

  /* Variables de sistema que gobiernan la entrada, con los mismos
     nombres y valores que en AutoCAD. */
  var DEFAULTS = {
    SHORTCUTMENU: 11,   /* suma: 1 predeterminado, 2 edición, 8 comando */
    MBUTTONPAN: 1,      /* botón central = encuadre */
    PICKFIRST: 1,       /* designar antes del comando */
    PICKADD: 2,         /* designar añade sin Mayús */
    PICKDRAG: 0,        /* la ventana se traza con dos clics, no arrastrando */
    SHORTCUTMENUDURATION: 250,  /* ms de pulsación larga para el menú */
    SNAPANG: 0,
    DBLCLKEDIT: 1,
    HIGHLIGHT: 1,
    SELECTIONPREVIEW: 3,
    TEMPOVERRIDE: 1,
    UNDOCTL: 5
  };

  /* ¿El destino del evento es un campo de texto de verdad? */
  function inField(t) {
    if (!t || !t.tagName) return false;
    var tag = t.tagName.toUpperCase();
    if (tag === 'TEXTAREA') return true;
    if (tag === 'SELECT') return true;
    if (t.isContentEditable) return true;
    if (tag !== 'INPUT') return false;
    var ty = (t.type || 'text').toLowerCase();
    return ty !== 'checkbox' && ty !== 'radio' && ty !== 'button' && ty !== 'submit';
  }
  function inDialog(t) { return !!(t && t.closest && t.closest('.modal-back')); }
  function isCmdInput(t) { return t && t.id === 'cmdinput'; }
  function isDynInput(t) { return t && (t.id === 'dynA' || t.id === 'dynB'); }

  App.prototype.initInput = function () {
    var self = this;
    var doc = this.doc;
    Object.keys(DEFAULTS).forEach(function (k) {
      if (doc.vars[k] === undefined) doc.vars[k] = DEFAULTS[k];
    });

    /* ------------------------------------------------------------
       Enrutado global del teclado.
       Se ejecuta en fase de captura para adelantarse a cualquier
       otro manejador, pero nunca interfiere con un diálogo ni con
       un campo de texto que no sea la propia línea de comandos.
       ------------------------------------------------------------ */
    document.addEventListener('keydown', function (e) {
    /* El tabulador entre capturas lo gobierna main.js */
    if (e.key === 'Tab') return;
      var t = e.target;
      if (inDialog(t)) return;
      if (isDynInput(t)) return;                 /* la entrada dinámica se gestiona sola */
      if (inField(t) && !isCmdInput(t)) return;  /* otro campo de la interfaz */

      /* Intro y Espacio: aceptar, terminar o repetir.  Si el foco no
         está en la línea de comandos (por ejemplo tras pinchar en el
         lienzo) el navegador se los tragaría. */
      if (e.key === 'Enter' || e.key === 'NumpadEnter') {
        if (isCmdInput(t)) return;               /* su propio manejador */
        e.preventDefault();
        self.focusCmd();
        self.feedEnter();
        return;
      }
      if (e.key === ' ' || e.key === 'Spacebar') {
        if (isCmdInput(t)) return;
        if (self.expectingText()) { self.focusCmd(); return; }
        e.preventDefault();
        self.focusCmd();
        self.feedEnter();
        return;
      }
      /* Retroceso fuera de la línea: lleva el foco allí para corregir */
      if (e.key === 'Backspace' && !isCmdInput(t)) {
        self.focusCmd();
        return;
      }
      /* Cualquier carácter imprimible empieza a escribir un comando */
      if (!isCmdInput(t) && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        self.focusCmd();
        return;                                  /* la tecla llega ya al campo */
      }
    }, true);

    /* Mayús mantenido = orto temporal (TEMPOVERRIDE de AutoCAD) */
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Shift' || !doc.vars.TEMPOVERRIDE) return;
      if (self._shiftOrtho) return;
      self._shiftOrtho = { prev: doc.vars.ORTHOMODE };
      doc.vars.ORTHOMODE = doc.vars.ORTHOMODE ? 0 : 1;
      if (self.ui.syncToggles) self.ui.syncToggles();
      self.refresh();
    });
    document.addEventListener('keyup', function (e) {
      if (e.key !== 'Shift' || !self._shiftOrtho) return;
      doc.vars.ORTHOMODE = self._shiftOrtho.prev;
      self._shiftOrtho = null;
      if (self.ui.syncToggles) self.ui.syncToggles();
      self.refresh();
    });
    window.addEventListener('blur', function () {
      if (!self._shiftOrtho) return;
      doc.vars.ORTHOMODE = self._shiftOrtho.prev;
      self._shiftOrtho = null;
    });

    /* Tras cualquier acción en el lienzo, el foco vuelve a la línea
       de comandos: es lo que hace que Intro siga funcionando. */
    ['pointerup', 'pointerdown'].forEach(function (ev) {
      var cv = self.cv;
      cv.addEventListener(ev, function (e) {
        if (e.button === 2) return;
        setTimeout(function () {
          var a = document.activeElement;
          if (inDialog(a) || isDynInput(a) || (inField(a) && !isCmdInput(a))) return;
          self.focusCmd();
        }, 0);
      });
    });

    this.wireRightClick();
    this.wireMiddle();
  };

  /* ============================================================
     Botón derecho sensible al tiempo (igual que AutoCAD)
       pulsación corta  -> Intro
       pulsación larga  -> menú contextual
     Con SHORTCUTMENU a 0 siempre hace de Intro.
     ============================================================ */
  App.prototype.wireRightClick = function () {
    var self = this, cv = this.cv;
    var down = 0, moved = false, startX = 0, startY = 0, timer = 0, opened = false;

    cv.addEventListener('pointerdown', function (e) {
      if (e.button !== 2) return;
      down = Date.now(); moved = false; opened = false;
      startX = e.clientX; startY = e.clientY;
      var dur = self.doc.vars.SHORTCUTMENUDURATION;
      if (self.doc.vars.SHORTCUTMENU && dur > 0) {
        clearTimeout(timer);
        timer = setTimeout(function () {
          if (!down || moved) return;
          opened = true;
          self.ui.contextMenu(startX, startY);
        }, dur);
      }
    });

    cv.addEventListener('pointermove', function (e) {
      if (!down) return;
      if (Math.abs(e.clientX - startX) > 4 || Math.abs(e.clientY - startY) > 4) moved = true;
    });

    cv.addEventListener('pointerup', function (e) {
      if (e.button !== 2) return;
      clearTimeout(timer);
      var held = Date.now() - down;
      down = 0;
      if (opened || moved) return;
      var dur = self.doc.vars.SHORTCUTMENUDURATION;
      if (!self.doc.vars.SHORTCUTMENU) { self.rightAsEnter(); return; }
      if (dur > 0 && held < dur) { self.rightAsEnter(); return; }
      self.ui.contextMenu(e.clientX, e.clientY);
    });

    cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  };

  /* Lo que hace el botón derecho corto: aceptar, terminar o repetir */
  App.prototype.rightAsEnter = function () {
    this.ui.closeMenus();
    this.focusCmd();
    var inp = document.getElementById('cmdinput');
    if (inp && inp.value.trim()) { this.feedInput(inp.value); inp.value = ''; return; }
    this.feedEnter();
  };

  /* ============================================================
     Botón central: encuadre; doble pulsación: zoom a extensión
     ============================================================ */
  App.prototype.wireMiddle = function () {
    var self = this, cv = this.cv, lastMid = 0;
    cv.addEventListener('pointerdown', function (e) {
      if (e.button !== 1) return;
      e.preventDefault();
      var now = Date.now();
      if (now - lastMid < 350) { lastMid = 0; self.startCommand('ZOOM', ['E']); return; }
      lastMid = now;
    });
  };
})();
