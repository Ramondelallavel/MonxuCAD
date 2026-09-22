/* ============================================================
   main.js — Aplicación: interacción, archivos y arranque
   ============================================================ */
(function () {
  'use strict';
  var CAD = window.CAD, G = CAD.G, E = CAD.E, Cmd = CAD.Cmd;

  function App() {
    this.doc = new CAD.Doc();
    /* Con el dedo, dar el foco a la línea de comandos abre el teclado
       en pantalla.  Se arranca por lo que dice el navegador del
       aparato y se corrige con cada toque, porque hay portátiles con
       pantalla táctil donde se usan las dos cosas. */
    this.tactil = false;
    try {
      this.tactil = window.matchMedia('(pointer: coarse)').matches;
    } catch (e) { /* navegador sin matchMedia */ }
    this.selSet = [];
    this.prevSelSet = [];
    this.preview = [];
    this.rubber = null;
    this.trackLines = null;
    this.pending = null;
    this.hoverEnt = null;
    this.hoverGrip = null;
    this.hotGrip = null;
    this.gripDrag = null;
    this.gripMode = 0;
    this.gripCopy = false;
    this.osnapOn = true;
    this.osnapOverride = null;
    this.showCross = true;
    this.showPickbox = true;
    this.aperture = false;
    this.cursorScreen = null;
    this.cursorWorld = { x: 0, y: 0 };
    this.lastPoint = { x: 0, y: 0 };
    this.lastCommand = '';
    this.paperMode = false;
    this.layout = null;
    this.activeVp = null;
    this.layoutIndex = -1;
    this.views = {};
    this.startedAt = Date.now();
    this.cleanScreen = false;
    this.lightTheme = false;
    this.scaleRef = 1;      /* arrastrar en ESCALA: el factor es la distancia al punto base, como en AutoCAD */
    this._raf = 0;
  }
  Object.assign(App.prototype, CAD.Engine);
  CAD.App = App;

  /* ============================================================
     Arranque
     ============================================================ */
  App.prototype.boot = function () {
    var self = this;
    this.cv = document.getElementById('cv');
    this.r = new CAD.Renderer(this.cv, this);
    this.ui = new CAD.UI(this);
    this.ui.init();
    /* Antes que nada: lo que decida esto cambia si los demás
       manejadores pueden robar el foco. */
    document.addEventListener('pointerdown', function (e) {
      self.tactil = e.pointerType === 'touch';
    }, true);

    this.wireCanvas();
    this.wireKeys();
    this.wireFile();
    this.initInput();

    window.addEventListener('resize', function () { self.resize(); });
    if (window.ResizeObserver) {
      new ResizeObserver(function () { self.resize(); }).observe(document.getElementById('canvasWrap'));
    }
    this.resize();

    /* Se arranca con el dibujo en blanco, como AutoCAD.  El ejemplo
       sigue disponible con el comando EJEMPLO. */
    this.r.view = { cx: 0, cy: 0, zoom: 1 };
    this.r.zoomBox({ x1: -100, y1: -75, x2: 500, y2: 375 });
    this.banner();
    this.setPrompt('Comando: ');
    this.refresh();
    this.focusCmd();
  };

  App.prototype.banner = function () {
    this.out('MonxuCAD  —  dibujo 2D, modelado 3D y fabricación', 'ok');
    this.out('Dibujo nuevo. Escriba un comando o púlselo en la cinta.  EJEMPLO carga una planta de muestra.');
    this.out('Dibujo: LINEA POL CIRCULO ARCO RECTANG LINEAM SOMBREA CONTORNO   Modificar: RECORTA EMPALME DESFASE MATRIZ');
    this.out('Acotar: ACOTALINEAL ACOTARAPIDA   Papel: VENTANAS ESPACIOM ESCALAVP CAJETIN   Bloques: PALETABLOQUES');
    this.out('3D: escriba 3D o pulse el conmutador de la barra de estado.  PRISMARECT CILINDRO EXTRUSION REVOLUCION TALADRO');
    this.out('AYUDA lista los ' + Object.keys(CAD.Cmd.reg).length + ' comandos.  ABRE importa DXF.  EXPORTAR escribe DXF/PDF/SVG y EXPORTA3D, STL y demás.');
  };

  /* Bloqueo de campo de la entrada dinámica (tecla Tab).
     En AutoCAD, al bloquear la distancia o el ángulo el cursor queda
     restringido a ese valor; aquí se proyecta el punto resuelto. */
  App.prototype.applyDynLock = function (base, wp) {
    var L = this.dynLock;
    if (!L || !wp) return wp;
    var a = L.dynA !== undefined && L.dynA !== '' ? parseFloat(L.dynA) : null;
    var b = L.dynB !== undefined && L.dynB !== '' ? parseFloat(L.dynB) : null;
    if (a !== null && !isFinite(a)) a = null;
    if (b !== null && !isFinite(b)) b = null;
    if (a === null && b === null) return wp;
    if (L.sep === '<') {
      if (!base) return wp;
      var d = a !== null ? a : G.dist(base, wp);
      var ang = b !== null ? G.rad(b) : G.ang(base, wp);
      return G.polar(base, ang, d);
    }
    var x = wp.x, y = wp.y;
    if (a !== null) x = base ? base.x + a : a;
    if (b !== null) y = base ? base.y + b : b;
    return { x: x, y: y };
  };

  /* Envía lo escrito en los campos de la entrada dinámica.
     En AutoCAD, a partir del segundo punto lo que se teclea ahí es
     RELATIVO al punto anterior (DYNPICOORDS = 0); anteponiendo # se
     fuerza absoluto.  En la línea de comandos, en cambio, se sigue
     interpretando como absoluto salvo que se escriba @. */
  App.prototype.commitDyn = function () {
    var A = document.getElementById('dynA'), B = document.getElementById('dynB');
    var a = String(A.value || '').trim(), b = String(B.value || '').trim();
    var sep = document.getElementById('dynSep').textContent;
    this.dynLock = null;
    if (!a && !b) { this.focusCmd(); return; }
    var abs = false;
    if (a[0] === '#') { abs = true; a = a.slice(1); }
    if (b[0] === '#') { abs = true; b = b.slice(1); }
    var rel = sep === '<';
    if (!rel && !abs) {
      var p = this.pending;
      var dyn = this.doc.vars.DYNMODE && (this.doc.vars.DYNPICOORDS === undefined ? 0 : this.doc.vars.DYNPICOORDS) === 0;
      if (dyn && p && p.kind === 'point' && p.opts.base) rel = true;
    }
    this.feedInput((rel ? '@' : '') + a + sep + b);
    this.focusCmd();
  };

  /* Devolver el foco a la línea de comandos es lo que hace que Intro
     y la barra espaciadora sigan funcionando después de pinchar en el
     lienzo.  Con un teclado físico no se nota; en un teléfono abre el
     teclado en pantalla y tapa media aplicación, y volvía a abrirse
     con cada toque.  Así que en táctil sólo se hace cuando el comando
     está pidiendo texto de verdad —entonces el teclado hace falta— o
     cuando se pide a propósito, que es lo que ocurre al tocar la
     propia línea de comandos. */
  App.prototype.focusCmd = function (aposta) {
    var i = document.getElementById('cmdinput');
    if (!i) return;
    if (this.tactil && !aposta && !this.expectingText()) return;
    if (document.activeElement !== i) i.focus();
  };

  /* Suelta la línea de comandos para que el teclado se cierre solo en
     cuanto se ha escrito la orden y toca dibujar. */
  App.prototype.sueltaCmd = function () {
    if (!this.tactil) return;
    var i = document.getElementById('cmdinput');
    if (!i || document.activeElement !== i) return;
    var self = this;
    setTimeout(function () {
      if (self.expectingText()) return;
      if (document.activeElement === i) i.blur();
    }, 0);
  };
  App.prototype.expectingText = function () {
    return !!(this.pending && this.pending.kind === 'string');
  };

  App.prototype.resize = function () {
    this.r.resize();
    this.refresh();
  };

  /* Durante el encuadre o el zoom se baja el detalle si la escena es
     cara de construir, y se repinta completa al detenerse. */
  App.prototype.navigating = function () {
    var self = this;
    if ((this.r.lastSceneMs || 0) > 28) this.r.fastMode = true;
    clearTimeout(this._navT);
    this._navT = setTimeout(function () {
      if (!self.r.fastMode) return;
      self.r.fastMode = false;
      self.r.invalidateScene();
      self.refresh();
    }, 170);
  };

  App.prototype.refresh = function (hard) {
    var self = this;
    if (hard) {
      if (CAD.Cache) CAD.Cache.clear();
      if (CAD.dropIndex) CAD.dropIndex();
      this.r.invalidateScene();
    }
    if (this._raf) return;
    this._raf = requestAnimationFrame(function () {
      self._raf = 0;
      self.r.render();
      /* la interfaz sólo se rehace cuando cambia algo que muestra */
      var sig = self.doc.rev + '|' + self.selSet.length + '|' + (self.selSet[0] ? self.selSet[0].id : 0) +
        '|' + self.doc.vars.CLAYER + '|' + self.doc.vars.CECOLOR + '|' + self.doc.vars.CELTYPE + '|' + self.doc.vars.CELWEIGHT;
      if (sig !== self._uiSig) {
        self._uiSig = sig;
        self.ui.syncPropBar();
        self.ui.renderProps();
      }
    });
  };

  App.prototype.feedInput = function (t) {
    if (this.pending) this.feedText(t);
    else this.exec(t);
    this.sueltaCmd();
  };

  App.prototype.setCurrentColor = function (c) {
    this.doc.vars.CECOLOR = c;
    if (this.selSet.length) {
      this.doc.mark('COLOR');
      this.selSet.forEach(function (e) { e.color = c; });
    }
    this.ui.syncPropBar();
    this.refresh();
  };

  /* La primera vez que se abre una presentación se le pone una ventana
     gráfica que encuadra el modelo, como hace AutoCAD ("crear ventana en
     presentaciones nuevas").  Sin ella la hoja salía en blanco y no había
     manera de ver el dibujo desde la presentación.  Se marca la hoja para
     no rehacerla si luego se borra la ventana a propósito. */
  App.prototype.primeraVentana = function (lay) {
    if (!lay || lay.vpInit) return;
    lay.vpInit = true;
    if (lay.viewports && lay.viewports.length) return;
    var m = lay.margin || 10;
    var rect = { x: m, y: m, w: lay.w - 2 * m, h: lay.h - 2 * m };
    if (rect.w < 5 || rect.h < 5) return;
    var b = E.extentsAll(this.doc.entities, this.doc);
    if (!G.bboxValid(b)) b = { x1: 0, y1: 0, x2: 100, y2: 100 };
    var sc = Math.min(rect.w / Math.max(1e-6, b.x2 - b.x1),
                      rect.h / Math.max(1e-6, b.y2 - b.y1)) * 0.92;
    if (!isFinite(sc) || sc <= 0) sc = 1;
    lay.viewports.push({
      x: rect.x, y: rect.y, w: rect.w, h: rect.h,
      cx: (b.x1 + b.x2) / 2, cy: (b.y1 + b.y2) / 2,
      scale: sc, locked: false, on: true, frozen: []
    });
    this.doc.rev++;
  };

  App.prototype.setLayout = function (i) {
    if (i >= 0 && !(this.doc.layouts && this.doc.layouts[i])) return;
    /* Volver a pulsar la pestaña en la que ya se está normaliza el
       estado: es el gesto con el que uno se recupera de algo atascado,
       y antes no hacía absolutamente nada. */
    if (i === this.layoutIndex && !this.activeVp) {
      this.leaveContext();
      this.ui.buildLayoutTabs();
      this.refresh(true);
      return;
    }
    if (this.activeVp) this.exitVp(true);
    /* El espacio papel es plano: la vista 3D no tiene sentido ahí. */
    if (i >= 0 && this.is3D) {
      this.set3D(false);
      this.out('Se sale de la vista 3D: el espacio papel es plano.');
    }
    this.leaveContext();
    this.layoutIndex = i;
    this.paperMode = i >= 0;
    this.layout = i >= 0 ? this.doc.layouts[i] : null;
    this.doc.setSpace(this.paperMode ? this.layout.entities : null);
    if (this.paperMode) {
      this.primeraVentana(this.layout);
      this.r.zoomBox({ x1: -18, y1: -18, x2: this.layout.w + 18, y2: this.layout.h + 18 });
      /* copia, nunca el mismo objeto: si se comparte, encuadrar en el
         modelo movía también la vista guardada de la presentación */
      this.r.paperView = { cx: this.r.view.cx, cy: this.r.view.cy, zoom: this.r.view.zoom };
    } else {
      var b = E.extentsAll(this.doc.entities, this.doc);
      if (G.bboxValid(b)) this.r.zoomBox(b);
      if (this.r.view === this.r.paperView)
        this.r.view = { cx: this.r.view.cx, cy: this.r.view.cy, zoom: this.r.view.zoom };
    }
    this.out(this.paperMode ? 'Regenerando presentación.' : 'Regenerando modelo.');
    this.ui.buildLayoutTabs();
    this.ui.syncStatus && this.ui.syncStatus();
    this.refresh(true);
  };

  /* Entrar y salir del espacio modelo dentro de una ventana gráfica */
  App.prototype.enterVp = function (vp) {
    if (!this.paperMode || !vp) return;
    if (this.activeVp === vp) return;
    if (this.activeVp) this.exitVp(true);
    this.leaveContext();
    this.activeVp = vp;
    this.doc.setSpace(null);
    this.r.paperView = { cx: this.r.view.cx, cy: this.r.view.cy, zoom: this.r.view.zoom };
    this.r.view = this.r.vpView(vp, this.r.paperView);
    this.ui.syncStatus();
    this.refresh(true);
  };
  App.prototype.exitVp = function (quiet) {
    if (!this.activeVp) { this.leaveContext(); this.refresh(); return; }
    this.leaveContext();
    this.activeVp = null;
    this.doc.setSpace(this.layout ? this.layout.entities : null);
    /* copia: compartir el objeto hacía que encuadrar luego corrompiera
       la vista guardada del papel */
    this.r.view = { cx: this.r.paperView.cx, cy: this.r.paperView.cy, zoom: this.r.paperView.zoom };
    if (!quiet) this.out('Espacio papel.');
    this.ui.syncStatus();
    this.refresh(true);
  };

  /* Inserción de un bloque por nombre (paleta de bloques) */
  App.prototype.insertBlockByName = function (name) {
    if (!this.doc.blocks[name]) { this.out('Bloque "' + name + '" no encontrado.', 'err'); return; }
    this.startCommand('INSERTARBLOQUE', [name]);
  };

  /* ============================================================
     Ratón
     ============================================================ */
  App.prototype.wireCanvas = function () {
    var self = this, cv = this.cv;
    var drag = null;

    function local(e) {
      var r = cv.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    /* ---------- Dos dedos: acercar, alejar y encuadrar ----------

       Un dedo hace de ratón, de modo que el primer toque tendría que
       designar en el acto.  Pero entonces empezar un pellizco con un
       comando a la espera dejaría un punto puesto donde nadie lo
       quería, porque el primer dedo llega siempre antes que el
       segundo.  Por eso el primer toque se retiene unas centésimas:
       si llega otro dedo se descarta, y si no llega se suelta tal
       cual.  La espera se acaba también en cuanto el dedo se mueve o
       se levanta, así que dibujar y designar siguen yendo al momento.

       Esto es sólo para el lienzo 2D; la ventana 3D lleva su propia
       navegación. */
    var dedos = new Map();
    var gesto = null;
    var espera = null;

    function medida() {
      var p = [];
      dedos.forEach(function (q) { p.push(q); });
      return {
        dist: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y),
        mid: { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 }
      };
    }

    function sueltaEspera() {
      if (!espera) return;
      var ev = espera.ev;
      clearTimeout(espera.t);
      espera = null;
      abajo(ev);
    }

    function olvidaEspera() {
      if (!espera) return;
      clearTimeout(espera.t);
      espera = null;
    }

    /* El primer dedo puede haber empezado ya una ventana de
       designación antes de que llegara el segundo. */
    function cortaArrastre() {
      if (!drag) return;
      drag = null;
      self.pickBox = null;
      self.lassoPath = null;
      self.refresh();
    }

    function abajo(e) {
      try { cv.setPointerCapture(e.pointerId); } catch (err) { }
      var sp = local(e);
      self.cursorScreen = sp;
      if (e.button === 1 || (e.button === 0 && self.realtimePan)) {
        drag = { mode: 'pan', last: sp };
        e.preventDefault();
        return;
      }
      if (e.button === 0 && self.realtimeZoom) {
        drag = { mode: 'rtzoom', last: sp };
        return;
      }
      if (e.button === 2) return;
      if (e.button !== 0) return;

      self.updateCursor(sp, e);

      /* Ventana abierta con un primer clic: este clic la cierra, caiga
         donde caiga.  Antes, si el segundo clic tocaba un objeto o un
         pinzamiento, la ventana se quedaba viva con un origen viejo y
         emboscaba a la siguiente designación. */
      if (self.pendBox) { self.closePendBox(sp, e.shiftKey); return; }

      /* pinzamiento bajo el cursor: entra en modo de edición */
      if (self.hoverGrip && !self.pending) {
        self.enterGripEdit(self.hoverGrip);
        return;
      }

      var ent = self.pickAt(sp);
      /* ciclo de selección cuando hay varios objetos superpuestos */
      if (!self.pending && !e.shiftKey && self.doc.vars.SELECTIONCYCLING >= 2) {
        var all = self.pickAllAt(sp);
        if (all.length > 1) {
          self.ui.cycleMenu(all, sp, function (chosen) {
            self.addToSelection([chosen]);
            self.hoverEnt = null;
            self.refresh();
          });
          return;
        }
      }
      if (self.pending && (self.pending.kind === 'point' || self.pending.kind === 'dist' || self.pending.kind === 'angle' || self.pending.kind === 'real')) {
        self.feedPick(sp, self.cursorWorld, ent, e.shiftKey);
        return;
      }
      if (self.pending && self.pending.kind === 'entity') {
        self.feedPick(sp, self.cursorWorld, ent, e.shiftKey);
        return;
      }
      if (ent && (!self.pending || self.pending.kind === 'select')) {
        if (self.pending && self.pending.kind === 'select' && self.pending.removeMode) self.removeFromSelection([ent]);
        else if (e.shiftKey) { self.removeFromSelection([ent]); }
        else self.addToSelection([ent]);
        self.refresh();
        return;
      }
      /* Ventana de designación.  AutoCAD admite las dos formas
         (PICKDRAG = 2): pulsar y arrastrar, o dar un clic, mover y dar
         otro clic.  La segunda es la de fábrica y es la que se echaba
         en falta aquí. */
      /* Pulsar en el vacío sin ningún comando en curso deshace la
         designación actual: es como se quitan los pinzamientos en
         AutoCAD.  Con Mayús se conserva, porque Mayús resta. */
      if (!self.pending && !e.shiftKey && self.selSet.length) {
        self.selSet = [];
        self.hoverGrip = null; self.hotGrip = null;
        self.gripMode = 0; self.gripCopy = false;
        self.refresh();
      }
      drag = { mode: 'box', start: self.cursorWorld, startScreen: sp, shift: e.shiftKey, path: [sp], plen: 0 };
    }

    cv.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'touch') { abajo(e); return; }

      /* Cuando el navegador dice que éste es el dedo primario no hay
         ningún otro puesto, así que lo que quede apuntado es de un
         gesto anterior cuyo «levantar» se perdió por el camino.  Sin
         esto, un dedo fantasma haría que todos los toques siguientes
         pasaran por pellizcos y dejaría de poderse dibujar. */
      if (e.isPrimary) { dedos.clear(); gesto = null; }

      dedos.set(e.pointerId, local(e));
      if (dedos.size === 2) {
        olvidaEspera();
        cortaArrastre();
        gesto = medida();
        return;
      }
      if (dedos.size > 2) return;

      try { cv.setPointerCapture(e.pointerId); } catch (err) { }
      /* El suceso no sobrevive al turno, así que se guarda lo que hace
         falta para atenderlo luego. */
      espera = {
        id: e.pointerId,
        sp: local(e),
        ev: {
          pointerId: e.pointerId, pointerType: 'touch',
          button: e.button, buttons: e.buttons,
          shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, altKey: e.altKey,
          clientX: e.clientX, clientY: e.clientY,
          preventDefault: function () { }
        },
        t: setTimeout(sueltaEspera, 70)
      };
    });

    cv.addEventListener('pointercancel', function (e) {
      if (e.pointerType !== 'touch') return;
      dedos.delete(e.pointerId);
      if (dedos.size < 2) gesto = null;
      if (espera && espera.id === e.pointerId) olvidaEspera();
      cortaArrastre();
    });

    cv.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch' && dedos.has(e.pointerId)) {
        dedos.set(e.pointerId, local(e));
        if (gesto && dedos.size > 1) {
          var m = medida();
          self.navigating();
          if (gesto.dist > 4 && m.dist > 4) self.r.zoomBy(m.dist / gesto.dist, m.mid);
          self.r.panBy(m.mid.x - gesto.mid.x, m.mid.y - gesto.mid.y);
          gesto = m;
          self.refresh();
          return;
        }
        if (espera && espera.id === e.pointerId) {
          var d = local(e);
          if (Math.hypot(d.x - espera.sp.x, d.y - espera.sp.y) <= 4) return;
          sueltaEspera();
        }
      }
      var sp = local(e);
      if (drag && drag.mode === 'pan') {
        self.navigating();
        self.r.panBy(sp.x - drag.last.x, sp.y - drag.last.y);
        drag.last = sp;
        self.cursorScreen = sp;
        self.refresh();
        return;
      }
      if (drag && drag.mode === 'rtzoom') {
        self.navigating();
        var dy = drag.last.y - sp.y;
        self.r.zoomBy(Math.exp(dy * 0.006), { x: self.r.W / 2, y: self.r.H / 2 });
        drag.last = sp;
        self.refresh();
        return;
      }
      self.updateCursor(sp, e);
      if (!drag && self.pendBox) {
        var pb = self.pendBox;
        var lastP = pb.path[pb.path.length - 1];
        var st = Math.hypot(sp.x - lastP.x, sp.y - lastP.y);
        if (st > 3) { pb.plen += st; pb.path.push({ x: sp.x, y: sp.y }); }
        var ch = Math.hypot(sp.x - pb.startScreen.x, sp.y - pb.startScreen.y);
        pb.lasso = pb.plen > Math.max(60, ch * 1.7);
        var cr = self.cursorWorld.x < pb.start.x;
        if (self.pending && self.pending.forceMode) cr = self.pending.forceMode === 'crossing';
        if (pb.lasso) {
          self.pickBox = null;
          self.lassoPath = { pts: pb.path.map(function (q) { return self.r.s2w(q); }), crossing: cr };
        } else {
          self.lassoPath = null;
          self.pickBox = { p1: pb.start, p2: self.cursorWorld, crossing: cr };
        }
        self.refresh();
        return;
      }
      if (drag && drag.mode === 'box') {
        var last = drag.path[drag.path.length - 1];
        var step = Math.hypot(sp.x - last.x, sp.y - last.y);
        if (step > 3) { drag.plen += step; drag.path.push({ x: sp.x, y: sp.y }); }
        var chord = Math.hypot(sp.x - drag.startScreen.x, sp.y - drag.startScreen.y);
        drag.lasso = drag.plen > Math.max(60, chord * 1.7);
        var crossing = self.cursorWorld.x < drag.start.x;
        if (self.pending && self.pending.forceMode) crossing = self.pending.forceMode === 'crossing';
        if (drag.lasso) {
          self.pickBox = null;
          self.lassoPath = { pts: drag.path.map(function (q) { return self.r.s2w(q); }), crossing: crossing };
        } else {
          self.lassoPath = null;
          self.pickBox = { p1: drag.start, p2: self.cursorWorld, crossing: crossing };
        }
      }
      self.refresh();
    });

    cv.addEventListener('pointerup', function (e) {
      if (e.pointerType === 'touch') {
        dedos.delete(e.pointerId);
        if (gesto) {
          /* El dedo que se levanta de un pellizco no designa nada. */
          gesto = dedos.size > 1 ? medida() : null;
          try { cv.releasePointerCapture(e.pointerId); } catch (err) { }
          return;
        }
        if (espera && espera.id === e.pointerId) sueltaEspera();
      }
      try { cv.releasePointerCapture(e.pointerId); } catch (err) { }
      if (drag && drag.mode === 'box') {
        var sp = local(e);
        var moved = Math.abs(sp.x - drag.startScreen.x) > 3 || Math.abs(sp.y - drag.startScreen.y) > 3;
        if (moved && drag.lasso) {
          var cl = self.cursorWorld.x < drag.start.x;
          if (self.pending && self.pending.forceMode) { cl = self.pending.forceMode === 'crossing'; self.pending.forceMode = null; }
          var poly = drag.path.map(function (q) { return self.r.s2w(q); });
          var hitL = self.selectLasso(poly, cl);
          if (drag.shift) self.removeFromSelection(hitL); else self.addToSelection(hitL);
          self.lassoPath = null;
          self.pickBox = null;
          drag = null;
          self.refresh();
          return;
        }
        if (moved) {
          var crossing = self.cursorWorld.x < drag.start.x;
          if (self.pending && self.pending.forceMode) { crossing = self.pending.forceMode === 'crossing'; self.pending.forceMode = null; }
          var box = {
            x1: Math.min(drag.start.x, self.cursorWorld.x), y1: Math.min(drag.start.y, self.cursorWorld.y),
            x2: Math.max(drag.start.x, self.cursorWorld.x), y2: Math.max(drag.start.y, self.cursorWorld.y)
          };
          self.lastSelBox = box;
          if (drag.shift) {
            var hit = self.doc.selectable().filter(function (en) { return E.hitBox(en, box, crossing, self.doc); });
            self.removeFromSelection(hit);
          } else self.selectBox(drag.start, self.cursorWorld, crossing);
        } else {
          /* clic sin arrastre sobre el vacío: queda a la espera del
             segundo clic para cerrar la ventana */
          self.pendBox = { start: drag.start, startScreen: drag.startScreen,
                           shift: drag.shift, path: [drag.startScreen], plen: 0, t: Date.now(),
                           prompt: self.promptText };
          /* AutoCAD avisa de que está esperando la esquina opuesta; sin
             ese aviso el usuario no entiende por qué el clic siguiente
             no designa lo que hay debajo. */
          self.setPrompt('Precise esquina opuesta: ');
          drag = null;
          self.refresh();
          return;
        }
        self.pickBox = null;
      }
      if (drag && (drag.mode === 'pan' || drag.mode === 'rtzoom')) {
        if (self.realtimePan || self.realtimeZoom) { /* continúa hasta Esc/Intro */ }
      }
      drag = null;
      self.refresh();
    });

    cv.addEventListener('pointerleave', function () {
      self.cursorScreen = null;
      self.snapHit = null;
      self.ui.showSnapTip(null);
      self.ui.el.dynin.hidden = true;
      self.refresh();
    });

    cv.addEventListener('wheel', function (e) {
      e.preventDefault();
      self.navigating();
      var sp = local(e);
      self.r.zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15, sp);
      self.updateCursor(sp, e);
      self.refresh();
    }, { passive: false });

    /* El menú contextual lo gobierna input.js (pulsación corta = Intro,
       larga = menú), igual que AutoCAD.  Aquí sólo quedan los casos
       que se adelantan a esa lógica. */
    cv.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      if (self.realtimePan || self.realtimeZoom) { self.endRealtime(); return; }
      if (e.shiftKey) { self.ui.osnapMenu(e.clientX, e.clientY); return; }
    });

    cv.addEventListener('dblclick', function (e) {
      var sp = local(e);
      if (self.paperMode) {
        var wp = self.activeVp ? null : self.r.s2w(sp);
        if (!self.activeVp && wp) {
          var vps = (self.layout.viewports || []).filter(function (v) {
            return v.on !== false && wp.x >= v.x && wp.x <= v.x + v.w && wp.y >= v.y && wp.y <= v.y + v.h;
          });
          if (vps.length) { self.enterVp(vps[vps.length - 1]); return; }
        } else if (self.activeVp) {
          var pv = self.r.paperView;
          var pp = { x: (sp.x - self.r.W / 2) / pv.zoom + pv.cx, y: (self.r.H / 2 - sp.y) / pv.zoom + pv.cy };
          var v2 = self.activeVp;
          if (!(pp.x >= v2.x && pp.x <= v2.x + v2.w && pp.y >= v2.y && pp.y <= v2.y + v2.h)) { self.exitVp(); return; }
        }
      }
      var ent = self.pickAt(sp);
      if (!ent) return;
      if (self.doc.vars.DBLCLKEDIT === 0) { self.selSet = [ent]; self.ui.togglePalette('props', true); self.refresh(); return; }
      self.selSet = [ent];
      /* el objeto pulsado viaja con el comando: no se vuelve a preguntar */
      self.pickedEntity = { ent: ent, p: self.r.s2w(sp) };
      if (ent.type === 'TEXT' || ent.type === 'MTEXT' || ent.type === 'DIMENSION') self.startCommand('EDITTEXTO');
      else if (ent.type === 'HATCH' && !ent.wipeout) self.startCommand('EDITSOMB');
      else if (ent.type === 'LWPOLYLINE') self.startCommand('EDITPOL');
      else if (ent.type === 'INSERT' && ent.attribs && ent.attribs.length) self.startCommand('EDITATR');
      else { self.pickedEntity = null; self.ui.togglePalette('props', true); }
      self.refresh();
    });
  };

  /* Cierra la ventana de designación abierta con el primer clic */
  App.prototype.closePendBox = function (sp, shift) {
    var pb = this.pendBox;
    this.pendBox = null;
    if (!pb) return;
    if (pb.prompt != null) this.setPrompt(pb.prompt);
    var moved = Math.abs(sp.x - pb.startScreen.x) > 3 || Math.abs(sp.y - pb.startScreen.y) > 3;
    if (!moved) {
      /* dos clics en el mismo sitio: se entiende como "no designar nada" */
      this.pickBox = null;
      this.lassoPath = null;
      if (!this.pending) this.selSet = [];
      else if (this.pending.kind === 'select') this.out('No se encontró ningún objeto.', 'warn');
      this.refresh();
      return;
    }
    var crossing = this.cursorWorld.x < pb.start.x;
    if (this.pending && this.pending.forceMode) {
      crossing = this.pending.forceMode === 'crossing';
      this.pending.forceMode = null;
    }
    if (pb.lasso) {
      var poly = pb.path.map(function (q) { return this.r.s2w(q); }, this);
      var hitL = this.selectLasso(poly, crossing);
      if (shift) this.removeFromSelection(hitL); else this.addToSelection(hitL);
    } else {
      var box = {
        x1: Math.min(pb.start.x, this.cursorWorld.x), y1: Math.min(pb.start.y, this.cursorWorld.y),
        x2: Math.max(pb.start.x, this.cursorWorld.x), y2: Math.max(pb.start.y, this.cursorWorld.y)
      };
      this.lastSelBox = box;
      if (shift) {
        var self = this;
        var hit = this.doc.selectable().filter(function (en) { return E.hitBox(en, box, crossing, self.doc); });
        this.removeFromSelection(hit);
      } else this.selectBox(pb.start, this.cursorWorld, crossing);
    }
    this.pickBox = null;
    this.lassoPath = null;
    this.refresh();
  };

  App.prototype.clearPendBox = function () {
    if (!this.pendBox) return;
    if (this.pendBox.prompt != null && this.promptText === 'Precise esquina opuesta: ')
      this.setPrompt(this.pendBox.prompt);
    this.pendBox = null;
    this.pickBox = null;
    this.lassoPath = null;
  };

  App.prototype.pushLayerState = function () {
    var st = {}, doc = this.doc;
    doc.layerOrder.forEach(function (n) {
      var l = doc.layers[n];
      st[n] = { on: l.on, frozen: l.frozen, locked: l.locked, color: l.color, ltype: l.ltype, lw: l.lw, plot: l.plot };
    });
    this.layerStates = this.layerStates || [];
    this.layerStates.push(st);
    if (this.layerStates.length > 20) this.layerStates.shift();
  };

  App.prototype.selectLasso = function (poly, crossing) {
    var doc = this.doc;
    if (poly.length < 3) return [];
    var box = G.bboxFromPts(poly);
    return doc.selectable().filter(function (e) {
      var b = E.extents(e, doc);
      if (G.bboxValid(b) && !G.bboxHit(box, b)) return false;
      var segs = E.segs(e, doc, 1);
      var allIn = true, anyIn = false;
      for (var i = 0; i < segs.length; i++) {
        var pts = segs[i].pts, n = pts.length;
        for (var j = 0; j < n; j++) {
          if (G.ptInPoly(pts[j], poly)) anyIn = true; else allIn = false;
          if (crossing && anyIn) return true;
        }
        if (crossing) {
          var lim = segs[i].closed ? n : n - 1;
          for (var k = 0; k < lim; k++) {
            for (var m2 = 0; m2 < poly.length; m2++) {
              if (G.segCross(pts[k], pts[(k + 1) % n], poly[m2], poly[(m2 + 1) % poly.length])) return true;
            }
          }
        }
      }
      return crossing ? anyIn : allIn;
    });
  };

  App.prototype.endRealtime = function () {
    if (this.realtimeDone) { var d = this.realtimeDone; this.realtimeDone = null; d(); }
    this.realtimePan = false;
    this.realtimeZoom = false;
  };

  /* Resuelve el punto del cursor con refent, orto y polar */
  App.prototype.updateCursor = function (sp, ev) {
    /* Mover el cursor deshace el recorrido del tabulador entre capturas */
    if (this.snapTab && this.snapTabAt &&
        (Math.abs(sp.x - this.snapTabAt.x) > 2 || Math.abs(sp.y - this.snapTabAt.y) > 2)) {
      this.snapTab = 0; this.snapTabAt = null;
    }
    this.cursorScreen = sp;
    var base = null;
    var p = this.pending;
    if (p && p.opts && p.opts.base) base = p.opts.base;
    if (this.gripDrag) base = this.hotGrip ? this.hotGrip.p : null;

    var res = CAD.Snap.resolve(this, sp, base, { noOsnap: !this.osnapOn && !this.osnapOverride });
    this.cursorWorld = res.p;
    if (this.dynLock && p && p.kind === 'point') this.cursorWorld = this.applyDynLock(base, this.cursorWorld);
    this.snapHit = res.snap;
    this.trackLines = res.tracks && res.tracks.length ? res.tracks : null;
    this.trackLabel = res.label || null;
    this.ui.showSnapTip(res.snap, res.label);
    this.ui.setCoords((this.paperMode && !this.activeVp) ? res.p : CAD.UCS.w2u(this.doc, res.p));
    if (this.doc.vars.DYNMODE) this.ui.updateDyn();

    /* pinzamiento bajo el cursor */
    this.hoverGrip = null;
    if (!this.pending && this.selSet.length && !this.gripDrag) {
      var gs = (this.doc.vars.GRIPSIZE || 5) + 2;
      var self = this;
      outer:
      for (var i = 0; i < this.selSet.length; i++) {
        var gg = E.grips(this.selSet[i], this.doc);
        for (var j = 0; j < gg.length; j++) {
          var s = this.r.w2s(gg[j].p);
          if (Math.abs(s.x - sp.x) <= gs && Math.abs(s.y - sp.y) <= gs) {
            this.hoverGrip = { e: this.selSet[i], k: gg[j].k, p: gg[j].p };
            break outer;
          }
        }
      }
    }
    this.cv.style.cursor = this.hoverGrip ? 'pointer' : 'none';

    /* resaltado bajo el cursor */
    if (!this.gripDrag) {
      var h = (this.pending && this.pending.kind !== 'select' && this.pending.kind !== 'entity') ? null : this.pickAt(sp);
      this.hoverEnt = h;
    }

    /* previsualización del comando */
    if (p && p.opts) {
      if (p.opts.preview) {
        try { this.preview = p.opts.preview(this.cursorWorld) || []; } catch (e) { this.preview = []; }
      }
      if (p.opts.rubber === 'line' && p.opts.base) this.rubber = { type: 'line', p1: p.opts.base, p2: this.cursorWorld };
      else if (p.opts.rubber === 'rect' && p.opts.base) this.rubber = { type: 'rect', p1: p.opts.base, p2: this.cursorWorld };
      else if (!p.opts.preview) this.rubber = null;
    } else if (!this.gripDrag) {
      this.preview = [];
      this.rubber = null;
    }

    /* información al pasar el cursor sobre un objeto */
    this.scheduleRollover();
  };

  /* ============================================================
     Edición mediante pinzamientos
     ============================================================ */
  var GRIP_MODES = [
    { k: 'ESTIRAR', p: 'Precise punto de estiramiento' },
    { k: 'DESPLAZAR', p: 'Precise punto de desplazamiento' },
    { k: 'GIRAR', p: 'Precise ángulo de rotación' },
    { k: 'ESCALA', p: 'Precise factor de escala' },
    { k: 'SIMETRÍA', p: 'Precise segundo punto' }
  ];
  CAD.GRIP_MODES = GRIP_MODES;

  App.prototype.enterGripEdit = function (g) {
    if (this.selSet.indexOf(g.e) < 0) this.selSet.push(g.e);
    this.hotGrip = g;
    this.gripMode = 0;
    this.gripCopy = false;
    this.gripDrag = {
      ent: g.e, key: g.k,
      base: { x: g.p.x, y: g.p.y },
      orig: E.deep(g.e),
      origSel: this.selSet.map(function (e) { return E.deep(e); }),
      a0: 0, d0: 1
    };
    this.gripPrompt();
  };

  App.prototype.gripPrompt = function () {
    var self = this, gd = this.gripDrag;
    if (!gd) return;
    var cur = this.cursorWorld || { x: gd.base.x + 1, y: gd.base.y };
    gd.a0 = G.ang(gd.base, cur);
    gd.d0 = Math.max(1e-6, G.dist(gd.base, cur));
    var m = GRIP_MODES[this.gripMode];
    var kws = ['Punto base', 'Copiar', 'desHacer', 'Salir'];
    this.pending = {
      kind: 'point',
      msg: m.p,
      opts: {
        base: gd.base, rubber: this.gripMode === 0 ? null : 'line', keywords: kws,
        preview: function (c) { return self.gripPreview(c); }
      },
      resolve: function (v) { self.gripResolve(v); },
      reject: function () { self.cancelGrip(); },
      text: '** ' + m.k + (this.gripCopy ? ' (múltiple)' : '') + ' **  ' + m.p +
        ' [' + kws.join('/') + ']: '
    };
    this.setPrompt(this.pending.text);
    this.refresh();
  };

  App.prototype.gripMatrix = function (c) {
    var gd = this.gripDrag, b = gd.base;
    switch (this.gripMode) {
      case 1: return G.mTrans(c.x - b.x, c.y - b.y);
      case 2: return G.mRot(G.ang(b, c) - gd.a0, b);
      case 3: {
        var f = G.dist(b, c) / gd.d0;
        if (!isFinite(f) || Math.abs(f) < 1e-9) f = 1e-9;
        return G.mScale(f, f, b);
      }
      case 4: return G.dist(b, c) < 1e-9 ? G.mIdent() : G.mMirror(b, c);
      default: return null;
    }
  };

  App.prototype.gripPreview = function (c) {
    var gd = this.gripDrag;
    if (!gd) return [];
    if (this.gripMode === 0) {
      var tmp = E.deep(gd.orig);
      E.moveGrip(tmp, gd.key, c, this.doc);
      return [tmp];
    }
    var m = this.gripMatrix(c), self = this;
    return gd.origSel.map(function (e) {
      var n = E.deep(e);
      E.transform(n, m, self.doc);
      return n;
    });
  };

  App.prototype.gripResolve = function (v) {
    var self = this, gd = this.gripDrag;
    if (!gd) return;
    if (v === null) {                      /* Intro: siguiente modo */
      this.gripMode = (this.gripMode + 1) % GRIP_MODES.length;
      this.gripPrompt();
      return;
    }
    if (v && v.kw) {
      if (v.kw === 'S') { this.cancelGrip(); return; }
      if (v.kw === 'C') { this.gripCopy = !this.gripCopy; this.gripPrompt(); return; }
      if (v.kw === 'PB' || v.kw === 'P') {
        this.pending = null;
        this.setPrompt('Precise punto base: ');
        this.pendingBase = true;
        var ctxLike = this;
        this.pending = {
          kind: 'point', msg: 'Precise punto base', opts: {},
          resolve: function (p2) {
            if (p2 && p2.x !== undefined) gd.base = { x: p2.x, y: p2.y };
            self.gripPrompt();
          },
          reject: function () { self.cancelGrip(); },
          text: 'Precise punto base: '
        };
        this.setPrompt(this.pending.text);
        return;
      }
      if (v.kw === 'H') { this.cancelGrip(); this.startCommand('H'); return; }
      this.gripPrompt();
      return;
    }
    /* punto: se aplica */
    this.doc.mark(GRIP_MODES[this.gripMode].k);
    if (this.gripMode === 0) {
      E.moveGrip(gd.ent, gd.key, v, this.doc);
    } else {
      var m = this.gripMatrix(v);
      if (this.gripCopy) {
        this.gripPreview(v).forEach(function (e) { e.id = 0; self.doc.add(e); });
      } else {
        this.selSet.forEach(function (e) { E.transform(e, m, self.doc); });
      }
    }
    if (this.gripCopy) {
      gd.origSel = this.selSet.map(function (e) { return E.deep(e); });
      this.gripPrompt();
      return;
    }
    this.cancelGrip(true);
  };

  App.prototype.cancelGrip = function (keepSel) {
    this.gripDrag = null;
    this.hotGrip = null;
    this.gripMode = 0;
    this.gripCopy = false;
    this.pending = null;
    this.preview = [];
    this.rubber = null;
    if (!keepSel) this.selSet = this.selSet.slice();
    this.setPrompt('Comando: ');
    this.refresh();
  };

  /* ============================================================
     Información al pasar el cursor
     ============================================================ */
  App.prototype.scheduleRollover = function () {
    var self = this;
    clearTimeout(this._rollT);
    this.ui.hideRollover();
    if (this.pending || this.gripDrag || !this.hoverEnt) return;
    var ent = this.hoverEnt;
    this._rollT = setTimeout(function () {
      if (self.hoverEnt === ent && !self.pending && !self.gripDrag) {
        self.ui.showRollover(ent, self.cursorScreen);
      }
    }, 520);
  };

  /* Punto medio entre dos puntos (menú Mayús + botón derecho) */
  App.prototype.startMidBetween = function () {
    this.mtpCollect = [];
    this.out('Punto medio entre 2 puntos');
    this.setPrompt('Primer punto del medio: ');
  };

  /* DESDE: se captura un punto de partida y el siguiente se mide como
     desplazamiento desde él.  Es la referencia "from" de AutoCAD. */
  App.prototype.startFrom = function () {
    this.fromCollect = true;
    this.out('Desde: punto base');
    this.setPrompt('Punto base: ');
    this.refresh();
  };

  /* Punto de rastreo temporal: se adquiere un punto para que salgan
     de él las trayectorias de alineación, sin usarlo como dato. */
  App.prototype.startTrackPoint = function () {
    this.ttCollect = true;
    this.out('Punto de rastreo temporal');
    this.setPrompt('Precise el punto de rastreo temporal: ');
    this.refresh();
  };

  /* ------------------------------------------------------------
     Estado transitorio de la interacción.

     Todo lo que depende de lo que se estaba haciendo y del espacio
     activo: resaltados, pinzamientos, bandas elásticas, ventanas de
     designación, capturas, rastreos y modos en tiempo real.  Cambiar de
     espacio o de modo sin vaciarlo dejaba referencias a objetos que ya
     no están en el espacio activo, y de ahí venían los saltos raros al
     pasar del modelo a una presentación o al 3D.
     ------------------------------------------------------------ */
  App.prototype.resetInteraction = function (opts) {
    opts = opts || {};
    this.hoverEnt = null;
    this.hoverGrip = null;
    this.hotGrip = null;
    this.gripDrag = null;
    this.gripMode = 0;
    this.gripCopy = false;
    this.pendingBase = false;
    this.rubber = null;
    this.preview = [];
    this.pickBox = null;
    this.pendBox = null;
    this.lassoPath = null;
    this.snapHit = null;
    this.snap3d = null;
    this.snap3dCands = null;
    this.snapTab = 0;
    this.snapTabAt = null;
    this.trackLines = null;
    this.trackLabel = null;
    this.box3d = null;
    this.dynLock = null;
    this.dynTyping = false;
    this.realtimePan = false;
    this.realtimeZoom = false;
    this.realtimeDone = null;
    this.orbitMode = false;
    this.osnapOverride = null;
    this.pickedEntity = null;
    this.mtpCollect = null;
    this.fromCollect = null;
    this.fromBase = null;
    this.ttCollect = null;
    this.lastSnapRef = null;
    if (CAD.Track && CAD.Track.clear) CAD.Track.clear();
    if (!opts.keepSel) this.selSet = [];
    if (this.ui && this.ui.showSnapTip) this.ui.showSnapTip(null, null);
  };

  /* Deja el contexto actual en un estado limpio antes de cambiar de
     espacio o de modo: cancela lo que hubiera en marcha y vacía el
     estado transitorio.  Devuelve true si había algo que cancelar. */
  App.prototype.leaveContext = function () {
    var habia = !!(this.pending || this.gripDrag || this.realtimePan || this.realtimeZoom);
    if (this.pending) this.cancel(true);
    this.resetInteraction();
    this.setPrompt('Comando: ');
    return habia;
  };

  App.prototype.applyGrip = function (p) {
    var gd = this.gripDrag;
    if (!gd) return;
    this.doc.mark('ESTIRAR');
    E.moveGrip(gd.ent, gd.key, p, this.doc);
    this.gripDrag = null;
    this.gripMode = 0;
    this.gripCopy = false;
    this.hotGrip = null;
    this.preview = [];
    this.setPrompt('Comando: ');
    this.refresh();
  };

  /* ============================================================
     Teclado
     ============================================================ */
  App.prototype.wireKeys = function () {
    var self = this;
    document.addEventListener('keydown', function (e) {
      var inDialog = !!e.target.closest && e.target.closest('.modal-back');
      var fn = {
        F1: function () { self.ui.helpDialog(); },
        F3: function () { self.ui.toggle('OSNAP'); },
        F7: function () { self.ui.toggle('GRIDMODE'); },
        F8: function () { self.ui.toggle('ORTHOMODE'); },
        F9: function () { self.ui.toggle('SNAPMODE'); },
        F10: function () { self.ui.toggle('POLARMODE'); },
        F11: function () { self.ui.toggle('OTRACK'); },
        F12: function () { self.ui.toggle('DYNMODE'); }
      };
      if (fn[e.key]) { e.preventDefault(); fn[e.key](); return; }
      if (inDialog) return;

      /* Tabulador: recorre las capturas solapadas bajo la mira */
      if (e.key === 'Tab' && !e.ctrlKey && !e.altKey && !inDialog &&
          self.pending && self.pending.kind === 'point' && self.cursorScreen &&
          self.snapCands && self.snapCands.length > 1) {
        e.preventDefault();
        self.snapTab = (self.snapTab || 0) + 1;
        self.snapTabAt = { x: self.cursorScreen.x, y: self.cursorScreen.y };
        self.updateCursor(self.cursorScreen);
        self.refresh();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        self.snapTab = 0; self.snapTabAt = null;
        if (self.realtimePan || self.realtimeZoom) { self.endRealtime(); return; }
        if (self.gripDrag) { self.cancelGrip(); return; }
        self.ui.closeMenus();
        self.cancel();
        document.getElementById('cmdinput').value = '';
        self.refresh();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        var k = e.key.toLowerCase();
        var map = {
          z: 'H', y: 'REHACER', s: 'GUARDAR', o: 'ABRE', n: 'NUEVO', p: 'TRAZAR',
          c: 'COPIAPP', v: 'PEGARPP', x: 'CORTARPP', '1': 'PROPIEDADES', '0': 'LIMPIAPANTALLA'
        };
        if (k === 'a') {
          e.preventDefault();
          self.selSet = self.doc.selectable().slice();
          self.out(self.selSet.length + ' encontrado(s)');
          self.refresh();
          return;
        }
        if (map[k]) {
          var inp = document.getElementById('cmdinput');
          if ((k === 'c' || k === 'x' || k === 'v') && inp.selectionStart !== inp.selectionEnd) return;
          e.preventDefault();
          self.startCommand(map[k]);
          return;
        }
        return;
      }
      if (e.key === 'Delete' || e.key === 'Supr') {
        var inp2 = document.getElementById('cmdinput');
        if (!inp2.value && self.selSet.length) {
          e.preventDefault();
          self.startCommand('BORRA');
        }
        return;
      }
      if (e.key === 'Enter' && self.realtimeDone) { e.preventDefault(); self.endRealtime(); return; }
      /* el reenvío de teclas a la línea de comandos lo hace input.js */
    });

    /* entrada dinámica: escribir en los campos flotantes */
    ['dynA', 'dynB'].forEach(function (id) {
      var el = document.getElementById(id);
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          self.commitDyn();
        } else if (e.key === 'Escape') { self.focusCmd(); self.cancel(); }
        else if (e.key === 'Tab') {
          /* Tab bloquea el campo y pasa al otro, como en AutoCAD */
          e.preventDefault();
          var other = id === 'dynA' ? 'dynB' : 'dynA';
          self.dynLock = self.dynLock || {};
          self.dynLock.sep = document.getElementById('dynSep').textContent;
          self.dynLock[id] = document.getElementById(id).value;
          var o = document.getElementById(other);
          o.focus(); o.select();
          self.refresh();
        }
      });
      el.addEventListener('focus', function () { self.dynTyping = true; });
      el.addEventListener('blur', function () { self.dynTyping = false; });
    });
  };

  /* ============================================================
     Archivos
     ============================================================ */
  App.prototype.wireFile = function () {
    var self = this;
    var inp = document.getElementById('fileInput');
    inp.addEventListener('change', function () {
      var f = inp.files && inp.files[0];
      if (!f) return;
      self.loadFile(f);
      inp.value = '';
    });
    /* arrastrar y soltar */
    var wrap = document.getElementById('canvasWrap');
    wrap.addEventListener('dragover', function (e) { e.preventDefault(); });
    wrap.addEventListener('drop', function (e) {
      e.preventDefault();
      var f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) self.loadFile(f);
    });
  };

  App.prototype.openDrawing = function () {
    document.getElementById('fileInput').click();
    this.out('Seleccione un archivo DXF o .dcad …');
    return Promise.resolve();
  };

  App.prototype.loadFile = function (file) {
    var self = this;
    var name = file.name || 'dibujo';
    var lower = name.toLowerCase();
    if (/\.dwg$/.test(lower)) {
      this.ui.dialog({
        title: 'Formato DWG', width: 480,
        body: '<p style="margin-top:0"><b>' + name + '</b> está en formato DWG.</p>' +
          '<p>DWG es un formato binario propietario de Autodesk sin especificación pública, ' +
          'por lo que este programa no puede leerlo directamente.</p>' +
          '<p style="color:var(--ink-dim)">Conviértalo antes a DXF con cualquiera de estas opciones:</p>' +
          '<ul style="color:var(--ink-dim);margin:0 0 6px 18px;padding:0">' +
          '<li>AutoCAD ▸ <b>GUARDARCOMO</b> ▸ DXF</li>' +
          '<li><b>ODA File Converter</b> (gratuito, Open Design Alliance)</li>' +
          '<li>Cualquier visor DWG con exportación a DXF</li></ul>' +
          '<p>Después abra el .dxf aquí: se leerán capas, bloques, cotas y sombreados.</p>',
        buttons: [{ label: 'Entendido', value: true, primary: true }]
      });
      return;
    }
    var rd = new FileReader();
    this.ui.flashResult('Abriendo ' + name + ' …');
    this.out('Abriendo ' + name + ' (' + (file.size / 1048576).toFixed(1) + ' MB) …');
    rd.onload = function () {
      /* un fotograma para que el aviso llegue a pintarse */
      requestAnimationFrame(function () { setTimeout(function () { parse(); }, 0); });
      function parse() {
      var t0 = performance.now();
      try {
        var txt = String(rd.result);
        var doc;
        if (/\.(dcad|json)$/.test(lower)) doc = self.docFromJSON(JSON.parse(txt));
        else doc = CAD.DXF.read(txt);
        doc.name = name;
        self.doc = doc;
        self.selSet = [];
        self.preview = [];
        self.pending = null;
        self.activeVp = null;
        self.paperMode = false;
        self.layout = null;
        self.layoutIndex = -1;
        self.ui.buildLayoutTabs();
        document.getElementById('docTitle').textContent = 'MonxuCAD   ' + name;
        var b = E.extentsAll(doc.entities, doc);
        if (G.bboxValid(b)) self.r.zoomBox(b);
        self.ui.syncStatus();
        self.ui.buildRibbon();
        self.out(doc.entities.length.toLocaleString('es-ES') + ' objeto(s), ' + doc.layerOrder.length +
          ' capa(s), ' + Object.keys(doc.blocks).length + ' bloque(s) en ' +
          ((performance.now() - t0) / 1000).toFixed(2) + ' s.', 'ok');
        self.ui.flashResult(doc.entities.length.toLocaleString('es-ES') + ' objetos cargados');
        if (doc.warnings && doc.warnings.length) {
          self.out('Entidades no admitidas omitidas: ' + doc.warnings.join(', '), 'warn');
        }
        self.refresh();
      } catch (err) {
        self.out('Error al leer el archivo: ' + err.message, 'err');
        console.error(err);
      }
      }
    };
    rd.readAsText(file);
  };

  App.prototype.newDrawing = function (templateId) {
    this.doc = templateId ? CAD.Templates.create(templateId) : CAD.Templates.create('blank');
    this.selSet = [];
    this.preview = [];
    this.activeVp = null;
    this.paperMode = false;
    this.layout = null;
    this.layoutIndex = -1;
    document.getElementById('docTitle').textContent = 'MonxuCAD   Dibujo1.dxf';
    var v = this.doc.vars.LIMMAX;
    this.r.zoomBox({ x1: -v.x * 0.05, y1: -v.y * 0.05, x2: v.x * 1.05, y2: v.y * 1.05 });
    this.ui.syncStatus();
    this.ui.buildLayoutTabs();
    var t = CAD.Templates.byId(templateId || 'blank');
    this.out('Nuevo dibujo creado con la plantilla "' + t.name + '".', 'ok');
    this.refresh();
  };

  App.prototype.docToJSON = function () {
    var d = this.doc;
    return JSON.stringify({
      format: 'delineante-cad', version: 1, name: d.name,
      vars: d.vars, layers: d.layers, layerOrder: d.layerOrder,
      ltypes: d.ltypes, textStyles: d.textStyles, dimStyles: d.dimStyles,
      blocks: d.blocks, entities: d.entities, layouts: d.layouts, groups: d.groups
    });
  };
  App.prototype.docFromJSON = function (o) {
    var d = new CAD.Doc();
    if (o.layers) { d.layers = o.layers; d.layerOrder = o.layerOrder || Object.keys(o.layers); }
    if (o.ltypes) d.ltypes = o.ltypes;
    if (o.textStyles) d.textStyles = o.textStyles;
    if (o.dimStyles) d.dimStyles = o.dimStyles;
    if (o.blocks) d.blocks = o.blocks;
    if (o.layouts) d.layouts = o.layouts;
    if (o.groups) d.groups = o.groups;
    if (o.vars) Object.assign(d.vars, o.vars);
    (o.entities || []).forEach(function (e) { d.entities.push(e); });
    d.nextId = d.entities.reduce(function (m, e) { return Math.max(m, e.id || 0); }, 0) + 1;
    return d;
  };

  App.prototype.saveDrawing = async function (as) {
    var base = (this.doc.name || 'Dibujo1').replace(/\.[^.]+$/, '');
    if (as) {
      var n = await this.ui.promptDialog('Guardar dibujo como', 'Nombre de archivo:', base);
      if (!n) return;
      base = n.replace(/\.[^.]+$/, '');
      this.doc.name = base + '.dxf';
      document.getElementById('docTitle').textContent = 'MonxuCAD   ' + this.doc.name;
    }
    var txt = CAD.DXF.write(this.doc, { version: 'AC1015' });
    await CAD.Exporter.saveFile(this, base + '.dxf', txt, 'dxf');
    this.doc.dirty = false;
  };

  App.prototype.exportDrawing = function () {
    var self = this, doc = this.doc;
    var base = (doc.name || 'Dibujo1').replace(/\.[^.]+$/, '');
    var body =
      '<div class="fields">' +
      '<label>Nombre de archivo:</label><input type="text" id="exName" value="' + base + '">' +
      '<label>Formato:</label><select id="exFmt">' +
      '<option value="dxf2000">DXF 2000 / LT2000 (*.dxf)</option>' +
      '<option value="dxfr12">DXF R12 / LT2 (*.dxf)</option>' +
      '<option value="dcad">Dibujo nativo (*.dcad)</option>' +
      '<option value="pdf">PDF vectorial (*.pdf)</option>' +
      '<option value="svg">Gráfico vectorial SVG (*.svg)</option>' +
      '<option value="png">Imagen PNG (*.png)</option>' +
      '</select></div>' +
      '<p style="color:var(--ink-dim);margin:10px 0 0">AutoCAD, BricsCAD, LibreCAD, QCAD, Inkscape y Revit abren el DXF ' +
      'de forma nativa. Para obtener un <b>.dwg</b>, abra el DXF en AutoCAD y use GUARDARCOMO.</p>';
    return this.ui.dialog({
      title: 'Exportar datos', width: 460, body: body,
      buttons: [{ label: 'Guardar', value: true, primary: true }, { label: 'Cancelar', value: null }],
      onOk: async function (b) {
        var name = b.querySelector('#exName').value.trim() || 'Dibujo1';
        var fmt = b.querySelector('#exFmt').value;
        name = name.replace(/\.[^.]+$/, '');
        if (fmt === 'dxf2000') await CAD.Exporter.saveFile(self, name + '.dxf', CAD.DXF.write(doc, { version: 'AC1015' }), 'dxf');
        else if (fmt === 'dxfr12') await CAD.Exporter.saveFile(self, name + '.dxf', CAD.DXF.write(doc, { version: 'AC1009' }), 'dxf');
        else if (fmt === 'dcad') await CAD.Exporter.saveFile(self, name + '.dcad', self.docToJSON(), 'json');
        else if (fmt === 'png') await CAD.Exporter.saveFile(self, name + '.png', await CAD.Exporter.pngBlob(self), 'png');
        else if (fmt === 'svg') {
          /* desde una presentación se exporta la hoja, no el espacio vacío */
          await CAD.Exporter.saveFile(self, name + '.svg',
            CAD.Exporter.toSVG(doc, CAD.Exporter.paraExportar(self, {})), 'svg');
        } else {
          var o = CAD.Exporter.paraExportar(self, { mono: true });
          if (!o.box) o.box = E.extentsAll(doc.entities, doc);
          o.paper = self.paperMode && self.layout
            ? { w: self.layout.w, h: self.layout.h } : { w: 420, h: 297 };
          if (self.paperMode) { o.scale = 1; o.margin = 0; }
          await CAD.Exporter.saveFile(self, name + '.pdf', CAD.Exporter.toPDF(doc, o), 'pdf');
        }
        return true;
      }
    });
  };

  /* ============================================================
     Dibujo de ejemplo: planta de vivienda acotada
     ============================================================ */
  App.prototype.sampleDrawing = function () {
    var d = this.doc;
    /* el ejemplo se reconstruye desde cero para poder recargarlo */
    d.entities.length = 0;
    d.layouts.forEach(function (l) { l.entities.length = 0; l.viewports.length = 0; });
    d.name = 'Vivienda-ejemplo.dxf';
    d.vars.INSUNITS = 4;          /* milímetros */
    d.vars.LUPREC = 0;
    d.vars.GRIDUNIT = 500;
    d.vars.SNAPUNIT = 50;
    d.vars.LTSCALE = 25;
    d.vars.TEXTSIZE = 180;
    d.vars.DIMSCALE = 50;
    d.vars.LIMMAX = { x: 10000, y: 8000 };

    d.addLayer({ name: 'MUROS', color: 7, lw: 50 });
    d.addLayer({ name: 'TABIQUES', color: 8, lw: 25 });
    d.addLayer({ name: 'EJES', color: 1, ltype: 'CENTER', lw: 9 });
    d.addLayer({ name: 'CARPINTERIA', color: 4, lw: 18 });
    d.addLayer({ name: 'MOBILIARIO', color: 6, lw: 13 });
    d.addLayer({ name: 'COTAS', color: 3, lw: 13 });
    d.addLayer({ name: 'TEXTOS', color: 2, lw: 18 });
    d.addLayer({ name: 'SOMBREADO', color: 9, lw: 9 });
    d.vars.CLAYER = 'MUROS';

    var W = 8400, H = 6200, t = 250;   /* dimensiones exteriores y espesor */

    function rectPl(x1, y1, x2, y2, layer) {
      return E.pline([{ x: x1, y: y1 }, { x: x2, y: y1 }, { x: x2, y: y2 }, { x: x1, y: y2 }], true, { layer: layer });
    }

    /* --- muros exteriores --- */
    d.add(rectPl(0, 0, W, H, 'MUROS'));
    d.add(rectPl(t, t, W - t, H - t, 'MUROS'));
    function box(x1, y1, x2, y2) {
      return [{ x: x1, y: y1 }, { x: x2, y: y1 }, { x: x2, y: y2 }, { x: x1, y: y2 }];
    }
    /* el sombreado del muro deja fuera los huecos de ventana (islas) */
    var hatch = E.hatch([
      box(0, 0, W, H),
      box(t, t, W - t, H - t),
      box(1200, -1, 3000, t + 1),
      box(5400, H - t - 1, 7000, H + 1),
      box(-1, 2400, t + 1, 4200)
    ], { layer: 'SOMBREADO' });
    hatch.pattern = 'ANSI31';
    hatch.scale = 26;
    d.add(hatch);

    /* --- tabiques interiores --- */
    var tt = 100;
    var px = 4600;                              /* tabique vertical    */
    d.add(rectPl(px, t, px + tt, H - t, 'TABIQUES'));
    var py = 3500;                              /* tabique horizontal  */
    d.add(rectPl(px + tt, py, W - t, py + tt, 'TABIQUES'));
    var py2 = 1900;
    d.add(rectPl(px + tt, py2, W - t, py2 + tt, 'TABIQUES'));

    /* --- huecos de paso (se "borran" los tabiques con muros cortos) --- */
    function gap(x1, y1, x2, y2) { d.add(rectPl(x1, y1, x2, y2, 'TABIQUES')); }

    /* --- puertas: hoja + barrido --- */
    function door(x, y, ang, w, layer) {
      var p0 = { x: x, y: y };
      var p1 = G.polar(p0, ang, w);
      d.add(E.line(p0, p1, { layer: layer || 'CARPINTERIA' }));
      d.add(E.arc(p0, w, ang, ang + Math.PI / 2, { layer: layer || 'CARPINTERIA' }));
    }
    door(px + tt, 800, 0, 800);
    door(px + tt, py + tt + 250, 0, 750);
    door(px + tt, py2 + tt + 250, 0, 700);
    door(t + 200, H - t, -Math.PI / 2, 850);

    /* --- ventanas: triple línea en el muro --- */
    function windowH(x1, x2, y) {
      d.add(E.line({ x: x1, y: y }, { x: x2, y: y }, { layer: 'CARPINTERIA' }));
      d.add(E.line({ x: x1, y: y + t / 2 }, { x: x2, y: y + t / 2 }, { layer: 'CARPINTERIA' }));
      d.add(E.line({ x: x1, y: y + t }, { x: x2, y: y + t }, { layer: 'CARPINTERIA' }));
      d.add(E.line({ x: x1, y: y }, { x: x1, y: y + t }, { layer: 'CARPINTERIA' }));
      d.add(E.line({ x: x2, y: y }, { x: x2, y: y + t }, { layer: 'CARPINTERIA' }));
    }
    function windowV(y1, y2, x) {
      d.add(E.line({ x: x, y: y1 }, { x: x, y: y2 }, { layer: 'CARPINTERIA' }));
      d.add(E.line({ x: x + t / 2, y: y1 }, { x: x + t / 2, y: y2 }, { layer: 'CARPINTERIA' }));
      d.add(E.line({ x: x + t, y: y1 }, { x: x + t, y: y2 }, { layer: 'CARPINTERIA' }));
      d.add(E.line({ x: x, y: y1 }, { x: x + t, y: y1 }, { layer: 'CARPINTERIA' }));
      d.add(E.line({ x: x, y: y2 }, { x: x + t, y: y2 }, { layer: 'CARPINTERIA' }));
    }
    windowH(1200, 3000, 0);   /* ventana salón */
    windowH(5400, 7000, H - t);
    windowV(2400, 4200, 0);

    /* --- ejes estructurales --- */
    d.add(E.line({ x: -700, y: H / 2 }, { x: W + 700, y: H / 2 }, { layer: 'EJES' }));
    d.add(E.line({ x: px + tt / 2, y: -700 }, { x: px + tt / 2, y: H + 700 }, { layer: 'EJES' }));

    /* --- mobiliario y sanitarios: bloques de la biblioteca --- */
    d.addLayer({ name: 'ELECTRICIDAD', color: 5, ltype: 'CONTINUOUS', lw: 13 });
    function put(name, x, y, rot, layer, sc) {
      CAD.Blocks.ensure(d, name);
      var ins = E.insert(name, { x: x, y: y }, { layer: layer || 'MOBILIARIO' });
      ins.rot = G.rad(rot || 0);
      if (sc) { ins.sx = sc; ins.sy = sc; }
      d.add(ins);
      return ins;
    }
    put('SOFA-3', 700, 600, 0);
    put('MESA-REDONDA-120', 2500, 2600, 0);
    put('SILLA', 2500, 1800, 0);
    put('SILLA', 2500, 3400, 180);
    put('SILLA', 1700, 2600, 90);
    put('SILLA', 3300, 2600, -90);
    put('TV', 2400, 500, 0);
    put('CAMA-150', 5000, 3800, 0);
    put('ARMARIO-200', 7400, 3700, 90);
    put('INODORO', 5300, 2150, 0);
    put('LAVABO', 6400, 2100, 0);
    put('DUCHA-80', 7200, 2400, 0);
    put('COCINA-4F', 5000, 1050, 0);
    put('HORNO', 5000, 380, 0);
    put('FREGADERO-2', 5750, 1050, 0);
    put('NEVERA', 7350, 1000, 0);
    put('NORTE', 10400, 5000, 0, 'TEXTOS', 1.3);

    /* --- simbología eléctrica --- */
    put('PUNTO-LUZ', 2300, 3000, 0, 'ELECTRICIDAD');
    put('PUNTO-LUZ', 6400, 4700, 0, 'ELECTRICIDAD');
    put('PUNTO-LUZ', 6400, 2700, 0, 'ELECTRICIDAD');
    put('PUNTO-LUZ', 6400, 1000, 0, 'ELECTRICIDAD');
    put('ENCHUFE-TT', 600, 400, 0, 'ELECTRICIDAD');
    put('ENCHUFE-TT', 4300, 400, 0, 'ELECTRICIDAD');
    put('INTERRUPTOR', 4350, 1100, 180, 'ELECTRICIDAD');
    put('CUADRO-ELECTRICO', 3600, 5600, 0, 'ELECTRICIDAD');

    /* --- textos --- */
    function txt(x, y, s, h, layer, align) {
      var te = E.text({ x: x, y: y }, h || 200, s, 0, { layer: layer || 'TEXTOS' });
      if (align) { te.halign = 1; te.p2 = { x: x, y: y }; }
      d.add(te);
    }
    txt(1600, 2900, 'SALÓN - COMEDOR', 220, 'TEXTOS', true);
    txt(1600, 2600, '18.40 m²', 170, 'TEXTOS', true);
    txt(6400, 4900, 'DORMITORIO', 220, 'TEXTOS', true);
    txt(6400, 4600, '11.20 m²', 170, 'TEXTOS', true);
    txt(6400, 2700, 'BAÑO', 200, 'TEXTOS', true);
    txt(6400, 1100, 'COCINA', 200, 'TEXTOS', true);

    /* --- cotas --- */
    function dimLin(p1, p2, p3, rot) {
      var dm = E.dim('linear', { p1: p1, p2: p2, p3: p3, rot: rot || 0, layer: 'COTAS' });
      dm.style = 'ISO-25';
      d.add(dm);
      CAD.Dim.build(dm, d);
      return dm;
    }
    dimLin({ x: 0, y: 0 }, { x: W, y: 0 }, { x: 0, y: -900 }, 0);
    dimLin({ x: 0, y: 0 }, { x: px, y: 0 }, { x: 0, y: -450 }, 0);
    dimLin({ x: px + tt, y: 0 }, { x: W, y: 0 }, { x: 0, y: -450 }, 0);
    dimLin({ x: W, y: 0 }, { x: W, y: H }, { x: W + 900, y: 0 }, Math.PI / 2);
    dimLin({ x: W, y: py + tt }, { x: W, y: H }, { x: W + 450, y: 0 }, Math.PI / 2);
    dimLin({ x: W, y: 0 }, { x: W, y: py2 }, { x: W + 450, y: 0 }, Math.PI / 2);

    /* --- directriz --- */
    var ld = E.leader([{ x: 300, y: 3500 }, { x: -600, y: 4300 }], 'Muro de carga\ne = 250 mm', { layer: 'TEXTOS' });
    ld.h = 170;
    d.add(ld);

    /* --- rótulo --- */
    var title = E.mtext({ x: 0, y: -1500 }, 300, 'PLANTA BAJA  ·  E 1:50', 6000, { layer: 'TEXTOS' });
    d.add(title);
    d.add(E.line({ x: 0, y: -1650 }, { x: 4200, y: -1650 }, { layer: 'TEXTOS', lw: 50 }));

    /* ============ Presentación 1: hoja A3 a escala 1:50 ============ */
    var lay = d.layouts[0];
    lay.name = 'Planta 1:50';
    lay.w = 420; lay.h = 297; lay.margin = 10;
    lay.viewports = [{
      x: 14, y: 78, w: 392, h: 205,
      cx: 4200, cy: 3000, scale: 1 / 50,
      locked: false, on: true, frozen: []
    }];
    CAD.Blocks.ensure(d, 'CAJETIN-A3');
    var cajBlk = d.blocks['CAJETIN-A3'];
    var caj = E.insert('CAJETIN-A3', { x: 226, y: 12 }, { layer: '0' });
    caj.attribs = cajBlk.entities.filter(function (e) { return e.type === 'ATTDEF'; }).map(function (a) {
      var at = E.attrib({ x: a.p.x, y: a.p.y }, a.h, a.tag, a.def, { layer: '0' });
      at.rot = a.rot; at.halign = a.halign; at.valign = a.valign;
      at.p2 = a.p2 ? { x: a.p2.x, y: a.p2.y } : null;
      return at;
    });
    var hoy = new Date();
    var vmap = {
      PROYECTO: 'VIVIENDA UNIFAMILIAR',
      PLANO: 'PLANTA BAJA DISTRIBUCIÓN',
      AUTOR: 'MonxuCAD',
      FECHA: hoy.toLocaleDateString('es-ES'),
      ESCALA: '1:50',
      NUMERO: '01'
    };
    caj.attribs.forEach(function (a) { if (vmap[a.tag] !== undefined) a.text = vmap[a.tag]; });
    lay.entities.push(caj);
    lay.entities.push(E.text({ x: 14, y: 288 }, 5, 'PLANTA BAJA', 0, { layer: '0' }));
    lay.entities.push(E.line({ x: 14, y: 285 }, { x: 120, y: 285 }, { layer: '0', lw: 50 }));
    lay.entities.push(E.text({ x: 14, y: 68 }, 2.5, 'Ventana gráfica a escala 1:50 · doble clic dentro para editar el modelo', 0, { layer: '0' }));

    var lay2 = d.layouts[1];
    lay2.name = 'Detalle 1:20';
    lay2.viewports = [{
      x: 12, y: 60, w: 273, h: 138,
      cx: 6300, cy: 2600, scale: 1 / 20, locked: false, on: true, frozen: []
    }];
    lay2.entities.push(E.text({ x: 12, y: 205 }, 4, 'DETALLE DE BAÑO  E 1:20', 0, { layer: '0' }));

    d.vars.CLAYER = 'MUROS';
    d.undoStack.length = 0;
    d.redoStack.length = 0;
    document.getElementById('docTitle').textContent = 'MonxuCAD   ' + d.name;
  };

  /* ============================================================
     Arranque
     ============================================================ */
  function start() {
    var app = new CAD.App();
    window.CADAPP = app;
    CAD.APP = app;
    app.boot();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
