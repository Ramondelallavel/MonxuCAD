/* ============================================================
   app3d.js — Integración de la vista 3D y del CAM en la aplicación
   Añade a App el conmutador 2D/3D, la navegación con el ratón
   (órbita, encuadre, zoom), el ViewCube, la superposición de
   trayectorias de mecanizado y el zoom a extensión en 3D.
   ============================================================ */
(function () {
  'use strict';
  var CAD = window.CAD, G3 = CAD.G3, V3 = CAD.View3D, S = CAD.Solid, M = CAD.Mesh;
  var App = CAD.App;
  var v3 = G3.v;

  /* ---------- Creación perezosa del lienzo WebGL ---------- */
  App.prototype.ensure3D = function () {
    if (this.view3d) return this.view3d;
    var wrap = document.getElementById('canvasWrap');
    var cv = document.createElement('canvas');
    cv.id = 'cv3d';
    cv.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;display:none;touch-action:none';
    wrap.insertBefore(cv, wrap.firstChild);
    this.cv3d = cv;
    this.view3d = new V3.View(cv);
    if (!this.view3d.ok) {
      this.out('Este navegador no admite WebGL: la vista 3D no está disponible.', 'err');
      return this.view3d;
    }
    /* Lienzo de superposición: el principal se crea con alpha:false (más
       rápido en 2D) y borrarlo deja negro opaco, que taparía la escena.
       La superposición va aparte, con canal alfa, justo encima. */
    var ov = document.createElement('canvas');
    ov.id = 'cvov';
    ov.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;display:none;pointer-events:none';
    cv.parentNode.insertBefore(ov, cv.nextSibling);
    this.cvov = ov;
    this.ovCtx = ov.getContext('2d');
    this.wire3D();
    return this.view3d;
  };

  App.prototype.resizeOverlay = function () {
    if (!this.cvov) return;
    var wrap = document.getElementById('canvasWrap');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.cvov.width = Math.max(1, Math.round(wrap.clientWidth * dpr));
    this.cvov.height = Math.max(1, Math.round(wrap.clientHeight * dpr));
    this.cvov.style.width = wrap.clientWidth + 'px';
    this.cvov.style.height = wrap.clientHeight + 'px';
    this.ovDpr = dpr;
    this.ovW = wrap.clientWidth;
    this.ovH = wrap.clientHeight;
  };

  App.prototype.set3D = function (on) {
    /* Pedir el modo en el que ya se está normaliza el estado transitorio
       sin tocar la designación: es la forma natural de salir de algo
       colgado (una órbita, un encuadre en tiempo real, una banda). */
    if (!!on === !!this.is3D) {
      /* No se cancela el comando en curso: ESTILOVISUAL y demás son
         transparentes y llaman aquí desde dentro de otro comando. */
      if (this.resetInteraction) this.resetInteraction({ keepSel: true });
      this.refresh();
      return this.is3D;
    }
    if (on) {
      /* El espacio 3D es el del modelo: en una presentación no hay nada
         que modelar.  Se vuelve al modelo antes de entrar. */
      if (this.paperMode) {
        this.setLayout(-1);
        this.out('Se vuelve al espacio modelo para trabajar en 3D.');
      }
      this.ensure3D();
      if (!this.view3d || !this.view3d.ok) {
        this.out('Este navegador no puede abrir la vista 3D (WebGL no disponible).', 'err');
        return false;
      }
      if (!this.is3D) {
        if (this.leaveContext) this.leaveContext();
        this.is3D = true;
        this.cv3d.style.display = 'block';
        this.cvov.style.display = 'block';
        this.cv.style.display = 'none';      /* opaco: taparía la escena */
        var dc = document.getElementById('viewcube');
        if (dc) dc.style.display = 'none';   /* el 3D pinta el suyo */
        this.resize();
        if (!this._v3dInit) {
          this._v3dInit = true;
          this.view3d.cam.setView('SWISO');
          this.zoom3dExtents();
        }
        this.ui.setStatus3D && this.ui.setStatus3D(true);
      }
    } else if (this.is3D) {
      if (this.leaveContext) this.leaveContext();
      this.orbitMode = false;
      this.is3D = false;
      if (this.cv3d) this.cv3d.style.display = 'none';
      if (this.cvov) this.cvov.style.display = 'none';
      this.cv.style.display = '';
      var dc2 = document.getElementById('viewcube');
      if (dc2) dc2.style.display = '';
      this.r.invalidateScene();
      this.resize();
      this.ui.setStatus3D && this.ui.setStatus3D(false);
    }
    return this.is3D;
  };

  App.prototype.v3dDirty = function () {
    if (this.view3d) this.view3d.dirty = true;
  };

  App.prototype.model3DBox = function () {
    var doc = this.doc, box = null;
    var list = doc.visible ? doc.visible() : doc.entities;
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (S.is3D(e)) box = G3.boxMerge(box, S.box3(e));
      else {
        var b = CAD.E.extents(e, doc);
        if (b && isFinite(b.x1)) {
          var z = e.elev || 0;
          box = G3.boxMerge(box, { x1: b.x1, y1: b.y1, z1: z, x2: b.x2, y2: b.y2, z2: z + (e.thickness || 0) });
        }
      }
    }
    return box;
  };

  App.prototype.zoom3dExtents = function () {
    if (!this.view3d) return;
    var box = this.model3DBox();
    if (!G3.boxValid(box)) {
      this.view3d.cam.target = v3(0, 0, 0);
      this.view3d.cam.dist = 500;
      return;
    }
    this.view3d.cam.fit(box, this.view3d.W || 1000, this.view3d.H || 700);
  };

  /* ---------- Redimensionado ---------- */
  var origResize = App.prototype.resize;
  App.prototype.resize = function () {
    origResize.call(this);
    if (this.view3d && this.is3D) {
      var wrap = document.getElementById('canvasWrap');
      this.view3d.resize(wrap.clientWidth, wrap.clientHeight);
      this.resizeOverlay();
      this.view3d.dirty = true;
    }
  };

  /* ---------- Repintado ---------- */
  var origRefresh = App.prototype.refresh;
  App.prototype.refresh = function (hard) {
    if (hard && CAD.Solid) CAD.Solid.clearCache();
    if (hard && this.view3d) { this.view3d.rev = -1; this.view3d.dirty = true; }
    return origRefresh.call(this, hard);
  };

  /* Se engancha al renderizador 2D: cuando la vista 3D está activa,
     el lienzo 2D sólo pinta la superposición (ViewCube, SCP, avisos). */
  var Renderer = CAD.Renderer;
  var origRender = Renderer.prototype.render;
  Renderer.prototype.render = function () {
    var app = this.app;
    if (!app || !app.is3D || !app.view3d || !app.view3d.ok) {
      if (app && app.camShow) { origRender.call(this); this.drawCamPaths(); return; }
      return origRender.call(this);
    }
    /* 1) escena 3D en WebGL */
    var t0 = performance.now();
    app.view3d.render(app);
    this.last3dMs = performance.now() - t0;
    /* 2) superposición 2D sobre un lienzo con canal alfa */
    var ctx = app.ovCtx;
    if (!ctx) return;
    var dpr = app.ovDpr || 1, W = app.ovW || this.W, H = app.ovH || this.H;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    this.drawCamPaths3D(ctx, W, H);
    if (app.view3d.showCube)
      app.cubeHits = V3.drawCube(ctx, app.view3d.cam, W - 132, 16, 108);
    if (app.view3d.showUcs) V3.drawUcsIcon(ctx, app.view3d.cam, W, H);
    if (CAD.WPlane) CAD.WPlane.draw(ctx, app);
    if (CAD.Pick3D) {
      CAD.Pick3D.drawHover(ctx, app);
      CAD.Pick3D.drawSnap(ctx, app);
      CAD.Pick3D.drawBox(ctx, app);
    }
    this.draw3dPreview(ctx);
    this.draw3dInfo(ctx);
    this.drawCross3D(ctx);
  };

  /* Previsualización del comando en curso, proyectada sobre la escena */
  Renderer.prototype.draw3dPreview = function (ctx) {
    var app = this.app;
    var pv = app.preview, rb = app.rubber;
    if ((!pv || !pv.length) && !rb) return;
    var prj = CAD.Pick3D ? CAD.Pick3D.projector(app.view3d) : null;
    if (!prj) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(160,210,255,0.95)';
    ctx.lineWidth = 1.4;
    ctx.setLineDash([6, 4]);
    if (rb && rb.p1 && rb.p2) {
      var a = prj({ x: rb.p1.x, y: rb.p1.y, z: rb.p1.z || 0 });
      var b = prj({ x: rb.p2.x, y: rb.p2.y, z: rb.p2.z || 0 });
      if (a && b) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
    }
    if (pv && pv.length) {
      ctx.setLineDash([]);
      ctx.beginPath();
      for (var i = 0; i < pv.length && i < 400; i++) {
        var e = pv[i];
        var segs = CAD.E.segs ? CAD.E.segs(e, app.doc) : null;
        if (!segs) continue;
        var z = e.elev || 0;
        for (var j = 0; j < segs.length; j++) {
          var pts = segs[j] && segs[j].pts ? segs[j].pts : segs[j];
          if (!pts || pts.length < 2) continue;
          var q0 = prj({ x: pts[0].x, y: pts[0].y, z: pts[0].z === undefined ? z : pts[0].z });
          if (!q0) continue;
          ctx.moveTo(q0.x, q0.y);
          for (var k = 1; k < pts.length; k++) {
            var q = prj({ x: pts[k].x, y: pts[k].y, z: pts[k].z === undefined ? z : pts[k].z });
            if (q) ctx.lineTo(q.x, q.y);
          }
        }
      }
      ctx.stroke();
    }
    ctx.restore();
  };

  Renderer.prototype.draw3dInfo = function (ctx) {
    var app = this.app, st = V3.STYLES[app.view3d.style];
    var txt = (st ? st.label : '') + '  ·  ' +
              (app.view3d.cam.persp ? 'Perspectiva' : 'Paralela');
    ctx.save();
    ctx.font = '11px system-ui,sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    var w = ctx.measureText(txt).width + 14;
    ctx.fillStyle = 'rgba(18,22,30,0.72)';
    ctx.fillRect(10, 10, w, 20);
    ctx.fillStyle = '#c9d2e0';
    ctx.fillText(txt, 17, 15);
    ctx.restore();
  };

  /* ---------- Trayectorias de mecanizado ---------- */
  function camColors(t) {
    if (t === 'rapid') return 'rgba(230,90,80,0.85)';
    if (t === 'drill') return 'rgba(250,190,60,0.95)';
    return 'rgba(90,200,255,0.95)';
  }

  Renderer.prototype.drawCamPaths = function () {
    var app = this.app;
    if (!app.camShow || !app.cam || !app.cam.paths.length) return;
    var ctx = this.ctx, self = this;
    ctx.save();
    ctx.lineWidth = 1;
    app.cam.paths.forEach(function (p) {
      var last = null;
      ctx.beginPath();
      var mode = null;
      p.moves.forEach(function (m) {
        if (m.x === undefined && m.y === undefined && m.z === undefined) return;
        var cur = { x: m.x === undefined ? (last ? last.x : 0) : m.x,
                    y: m.y === undefined ? (last ? last.y : 0) : m.y,
                    z: m.z === undefined ? (last ? last.z : 0) : m.z };
        var t = (m.t === 'rapid') ? 'rapid' : (m.t === 'drill' ? 'drill' : 'feed');
        if (t !== mode) {
          if (mode) { ctx.strokeStyle = camColors(mode); ctx.stroke(); }
          ctx.beginPath();
          if (last) { var s0 = self.w2s(last); ctx.moveTo(s0.x, s0.y); }
          mode = t;
        }
        var s = self.w2s(cur);
        if (!last) ctx.moveTo(s.x, s.y); else ctx.lineTo(s.x, s.y);
        last = cur;
      });
      if (mode) { ctx.strokeStyle = camColors(mode); ctx.stroke(); }
    });
    ctx.restore();
  };

  Renderer.prototype.drawCamPaths3D = function (ctx, W, H) {
    var app = this.app;
    if (!app.camShow || !app.cam || !app.cam.paths.length) return;
    if (!ctx) return;
    var cam = app.view3d.cam;
    var VP = cam.vp(W, H, cam.radius);
    function proj(p) {
      var q = G3.apply4(VP, p);
      if (q[3] <= 1e-9) return null;
      return { x: (q[0] / q[3] * 0.5 + 0.5) * W, y: (0.5 - q[1] / q[3] * 0.5) * H };
    }
    ctx.save();
    ctx.lineWidth = 1.1;
    app.cam.paths.forEach(function (p) {
      var last = null, mode = null;
      ctx.beginPath();
      p.moves.forEach(function (m) {
        if (m.x === undefined && m.y === undefined && m.z === undefined) return;
        var cur = { x: m.x === undefined ? (last ? last.x : 0) : m.x,
                    y: m.y === undefined ? (last ? last.y : 0) : m.y,
                    z: m.z === undefined ? (last ? last.z : 0) : m.z };
        var t = (m.t === 'rapid') ? 'rapid' : (m.t === 'drill' ? 'drill' : 'feed');
        if (t !== mode) {
          if (mode) { ctx.strokeStyle = camColors(mode); ctx.stroke(); }
          ctx.beginPath();
          if (last) { var s0 = proj(last); if (s0) ctx.moveTo(s0.x, s0.y); }
          mode = t;
        }
        var s = proj(cur);
        if (s) { if (!last) ctx.moveTo(s.x, s.y); else ctx.lineTo(s.x, s.y); }
        last = cur;
      });
      if (mode) { ctx.strokeStyle = camColors(mode); ctx.stroke(); }
    });
    ctx.restore();
  };

  /* Cruz filar sencilla en 3D */
  Renderer.prototype.drawCross3D = function (ctx) {
    var app = this.app;
    if (!app.cursorScreen || !app.showCross) return;
    var p = app.cursorScreen;
    ctx.save();
    ctx.strokeStyle = 'rgba(190,200,215,0.55)';
    ctx.lineWidth = 1;
    var L = 26;
    ctx.beginPath();
    ctx.moveTo(p.x - L, p.y); ctx.lineTo(p.x + L, p.y);
    ctx.moveTo(p.x, p.y - L); ctx.lineTo(p.x, p.y + L);
    ctx.stroke();
    ctx.strokeRect(p.x - 4, p.y - 4, 8, 8);
    ctx.restore();
  };

  /* ---------- Navegación con el ratón ---------- */
  App.prototype.wire3D = function () {
    /* En 3D el lienzo 2D queda oculto, así que los eventos se recogen en
       el propio lienzo WebGL (la superposición no los intercepta).

       Convenios de navegación, los mismos de SolidWorks y CATIA:
         botón central          órbita
         Mayús + central        encuadre
         Ctrl + central         encuadre (alternativa de CATIA)
         rueda                  zoom hacia el cursor
         botón izquierdo        designar / precisar punto
       Y, como en AutoCAD, con ORBITA activa el botón izquierdo orbita. */
    var self = this, cv = this.cv3d;
    function local(e) {
      var r = cv.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    var drag = null;
    var UMBRAL = 4;          /* píxeles para distinguir clic de arrastre */

    /* Punto resuelto bajo el cursor: captura sobre la geometría o, si no
       hay nada, el plano de trabajo. */
    function resolver(sp) {
      var h = CAD.Pick3D ? CAD.Pick3D.snap(self, sp.x, sp.y) : null;
      self.snap3d = h;
      if (h && h.p) {
        self.cursorWorld = { x: h.p.x, y: h.p.y, z: h.p.z };
        return self.cursorWorld;
      }
      var gp = self.view3d.groundPoint(sp.x, sp.y, self.doc.vars.ELEVATION || 0, self.doc);
      if (gp) self.cursorWorld = { x: gp.x, y: gp.y, z: gp.z };
      return self.cursorWorld;
    }

    cv.addEventListener('pointerdown', function (e) {
      if (!self.is3D) return;
      var sp = local(e);

      /* ViewCube */
      if (self.cubeHits) {
        var v = V3.cubeHit(self.cubeHits, sp.x, sp.y);
        if (v) { e.stopPropagation(); self.view3d.cam.setView(v); self.refresh(); return; }
      }

      /* Navegación: central, o izquierdo con la órbita activa */
      var navega = (e.button === 1) || (e.button === 0 && self.orbitMode);
      if (navega) {
        e.preventDefault(); e.stopPropagation();
        var modo = (e.shiftKey || e.ctrlKey) ? 'pan' : 'orbit';
        if (e.button === 1 && !e.shiftKey && !e.ctrlKey) modo = 'orbit';
        drag = { mode: modo, p: sp, p0: sp };
        try { cv.setPointerCapture(e.pointerId); } catch (err) { }
        return;
      }
      if (e.button !== 0) return;

      e.stopPropagation();
      var p = self.pending;

      /* Petición de punto: se toma la captura resuelta */
      if (p && p.kind === 'point') {
        var wp = resolver(sp);
        if (wp) self.acceptPoint({ x: wp.x, y: wp.y, z: wp.z });
        return;
      }
      /* Petición de un objeto concreto */
      if (p && p.kind === 'entity') {
        var hit = self.view3d.pick(self, sp.x, sp.y);
        if (!hit || !hit.ent) { self.out('No se encontró ningún objeto.', 'warn'); self.setPrompt(p.text); return; }
        if (p.opts.filter && !p.opts.filter(hit.ent)) { self.out('Objeto no válido.', 'warn'); self.setPrompt(p.text); return; }
        self.resolve({ ent: hit.ent, p: hit.p || self.cursorWorld, shift: !!e.shiftKey });
        return;
      }
      /* Designación (o sin comando): clic sobre objeto, o ventana */
      drag = { mode: 'box', p: sp, p0: sp, shift: e.shiftKey, select: true };
      try { cv.setPointerCapture(e.pointerId); } catch (err) { }
    });

    cv.addEventListener('pointermove', function (e) {
      if (!self.is3D) return;
      var sp = local(e);
      self.cursorScreen = sp;

      if (!drag) {
        /* el tabulador entre capturas se reinicia al mover el cursor */
        if (self.snapTab && self.snapTabAt &&
            (Math.abs(sp.x - self.snapTabAt.x) > 2 || Math.abs(sp.y - self.snapTabAt.y) > 2)) {
          self.snapTab = 0; self.snapTabAt = null;
        }
        var p = self.pending;
        if (p && p.kind === 'point') {
          var wp = resolver(sp);
          if (wp) {
            self.ui.setCoords && self.ui.setCoords(wp);
            if (p.opts.preview) { try { self.preview = p.opts.preview(wp) || []; } catch (err) { self.preview = []; } }
            if (p.opts.rubber === 'line' && p.opts.base) self.rubber = { type: 'line', p1: p.opts.base, p2: wp };
          }
          self.hoverEnt = null;
        } else {
          self.snap3d = null;
          var gp = self.view3d.groundPoint(sp.x, sp.y, self.doc.vars.ELEVATION || 0, self.doc);
          if (gp) { self.cursorWorld = { x: gp.x, y: gp.y, z: gp.z }; self.ui.setCoords && self.ui.setCoords(gp); }
          /* realce del objeto bajo el cursor */
          if (self.doc.vars.SELECTIONPREVIEW !== 0 && CAD.Pick3D)
            self.hoverEnt = CAD.Pick3D.hover(self, sp.x, sp.y);
        }
        self.v3dOverlayDirty = true;
        self.refresh();
        return;
      }

      e.stopPropagation();
      if (drag.mode === 'box') {
        if (Math.abs(sp.x - drag.p0.x) > UMBRAL || Math.abs(sp.y - drag.p0.y) > UMBRAL) {
          self.box3d = { a: drag.p0, b: sp };
          self.refresh();
        }
        return;
      }
      var dx = sp.x - drag.p.x, dy = sp.y - drag.p.y;
      drag.p = sp;
      if (drag.mode === 'orbit') self.view3d.cam.orbit(dx * 0.0085, dy * 0.0085);
      else self.view3d.cam.pan(dx, dy, self.view3d.W, self.view3d.H);
      self.refresh();
    });

    cv.addEventListener('pointerup', function (e) {
      if (!self.is3D || !drag) return;
      e.stopPropagation();
      var sp = local(e);
      var d = drag; drag = null;
      try { cv.releasePointerCapture(e.pointerId); } catch (err) { }

      if (d.mode !== 'box') return;
      var movido = Math.abs(sp.x - d.p0.x) > UMBRAL || Math.abs(sp.y - d.p0.y) > UMBRAL;
      self.box3d = null;

      if (!movido) {
        /* clic simple: designar el objeto bajo el cursor */
        var hit = self.view3d.pick(self, sp.x, sp.y);
        if (hit && hit.ent) {
          if (self.pending && self.pending.kind === 'select') self.addToSelection([hit.ent]);
          else if (d.shift) {
            var k = self.selSet.indexOf(hit.ent);
            if (k >= 0) self.selSet.splice(k, 1); else self.selSet.push(hit.ent);
          } else self.selSet = [hit.ent];
        } else if (self.pending && self.pending.kind === 'select') {
          self.out('No se encontró ningún objeto.', 'warn');
        } else if (!d.shift) self.selSet = [];
      } else {
        /* ventana (izquierda a derecha) o captura (derecha a izquierda) */
        var crossing = sp.x < d.p0.x;
        var ents = CAD.Pick3D ? CAD.Pick3D.boxSelect(self, d.p0, sp, crossing) : [];
        if (self.pending && self.pending.kind === 'select') self.addToSelection(ents);
        else if (d.shift) {
          ents.forEach(function (x) { var k = self.selSet.indexOf(x); if (k >= 0) self.selSet.splice(k, 1); });
        } else self.selSet = ents;
      }
      self.v3dDirty();
      self.refresh();
    });

    cv.addEventListener('pointercancel', function () { drag = null; self.box3d = null; self.refresh(); });

    /* Zoom hacia el cursor, como en SolidWorks y en el 2D de la propia
       aplicación: el punto señalado se queda quieto. */
    cv.addEventListener('wheel', function (e) {
      if (!self.is3D) return;
      e.preventDefault(); e.stopPropagation();
      var sp = local(e);
      var f = e.deltaY < 0 ? 1 / 1.12 : 1.12;
      var cam = self.view3d.cam;
      if (cam.zoomAt) cam.zoomAt(f, sp.x, sp.y, self.view3d.W, self.view3d.H);
      else cam.zoom(f);
      self.refresh();
    }, { passive: false });

    /* El botón derecho termina el comando, como en 2D */
    cv.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      if (self.orbitMode) { self.cancel(); return; }
      if (self.rightAsEnter) self.rightAsEnter();
    });

    cv.addEventListener('dblclick', function (e) {
      if (!self.is3D) return;
      var sp = local(e);
      if (self.cubeHits && V3.cubeHit(self.cubeHits, sp.x, sp.y)) { e.stopPropagation(); return; }
      var hit = self.view3d.pick(self, sp.x, sp.y);
      if (hit && hit.ent) {
        self.selSet = [hit.ent];
        self.ui.togglePalette('props', true);
        self.refresh();
      }
    });
  };

  /* ---------- Comando de conmutación rápida ---------- */
  CAD.Cmd.add(['3D', 'MODO3D'], { group: 'view3d', icon: 'view3d', title: 'Conmutar 2D/3D', transparent: true },
  async function (ctx) {
    var on = !ctx.app.is3D;
    ctx.app.set3D(on);
    if (on && !ctx.app.doc.ents().some(CAD.Solid.is3D))
      ctx.out('No hay sólidos en el dibujo. Use PRISMARECT, CILINDRO, EXTRUSION…');
    ctx.app.refresh();
    ctx.out(on ? 'Vista 3D activada. Rueda = zoom, botón central = órbita, Mayús+central = encuadre.'
               : 'Vista 2D.');
  });
})();
