/* ============================================================
   render.js — Visor gráfico (área de dibujo)
   ============================================================ */
(function () {
  'use strict';
  var CAD = (window.CAD = window.CAD || {});
  var G = CAD.G, E = CAD.E;

  var THEME = CAD.THEME = {
    bg: '#212830',
    bgPaper: '#ffffff',
    gridMinor: '#2c3742',
    gridMajor: '#3c4a58',
    axisX: '#5a3a3a',
    axisY: '#3a5a3a',
    cross: '#ffffff',
    pickbox: '#c8c8c8',
    selWindow: 'rgba(38,118,207,0.16)',
    selWindowEdge: '#4d9bf0',
    selCross: 'rgba(76,175,80,0.14)',
    selCrossEdge: '#6ec071',
    lasso: 'rgba(38,118,207,0.16)',
    highlight: '#ffffff',
    selGlow: 'rgba(120,190,255,0.55)',   /* resplandor del objeto designado */
    hoverGlow: 'rgba(190,215,245,0.42)', /* previsualización al pasar el cursor */
    grip: '#1e6fd9',
    gripHover: '#ff8c1a',
    gripHot: '#e03131',
    snap: '#22d34c',
    track: '#59d94a',
    polar: '#59d94a',
    ucs: '#a5b4c4',
    preview: '#a8b4c0',
    accentVp: '#2f7fd1'
  };

  /* ============================================================
     Sistema de coordenadas personales (SCP)
     ============================================================ */
  CAD.UCS = {
    u2w: function (doc, p) {
      var a = doc.vars.UCSANG || 0, o = doc.vars.UCSORG || { x: 0, y: 0 };
      if (!a) return { x: p.x + o.x, y: p.y + o.y };
      var c = Math.cos(a), s2 = Math.sin(a);
      return { x: o.x + p.x * c - p.y * s2, y: o.y + p.x * s2 + p.y * c };
    },
    w2u: function (doc, p) {
      var a = doc.vars.UCSANG || 0, o = doc.vars.UCSORG || { x: 0, y: 0 };
      var dx = p.x - o.x, dy = p.y - o.y;
      if (!a) return { x: dx, y: dy };
      var c = Math.cos(-a), s2 = Math.sin(-a);
      return { x: dx * c - dy * s2, y: dx * s2 + dy * c };
    },
    vec2w: function (doc, v) {
      var a = doc.vars.UCSANG || 0;
      if (!a) return { x: v.x, y: v.y };
      var c = Math.cos(a), s2 = Math.sin(a);
      return { x: v.x * c - v.y * s2, y: v.x * s2 + v.y * c };
    },
    isWorld: function (doc) {
      var o = doc.vars.UCSORG || { x: 0, y: 0 };
      return !(doc.vars.UCSANG || 0) && !o.x && !o.y;
    }
  };

  function Renderer(canvas, app) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.app = app;
    this.view = { cx: 0, cy: 0, zoom: 2 };
    this.viewStack = [];
    this.dpr = 1;
    this.W = 100; this.H = 100;
    this.needs = true;
    this.paperView = { cx: 210, cy: 148, zoom: 2 };
  }
  CAD.Renderer = Renderer;

  Renderer.prototype.resize = function () {
    this.invalidateScene();
    var r = this.cv.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = Math.max(1, Math.round(r.width));
    this.H = Math.max(1, Math.round(r.height));
    this.cv.width = Math.round(this.W * this.dpr);
    this.cv.height = Math.round(this.H * this.dpr);
    this.needs = true;
  };

  /* ---------- Transformaciones ---------- */
  Renderer.prototype.w2s = function (p) {
    return { x: (p.x - this.view.cx) * this.view.zoom + this.W / 2, y: this.H / 2 - (p.y - this.view.cy) * this.view.zoom };
  };
  Renderer.prototype.s2w = function (p) {
    return { x: (p.x - this.W / 2) / this.view.zoom + this.view.cx, y: (this.H / 2 - p.y) / this.view.zoom + this.view.cy };
  };
  Renderer.prototype.sx = function (x) { return (x - this.view.cx) * this.view.zoom + this.W / 2; };
  Renderer.prototype.sy = function (y) { return this.H / 2 - (y - this.view.cy) * this.view.zoom; };

  Renderer.prototype.pushView = function () {
    this.viewStack.push({ cx: this.view.cx, cy: this.view.cy, zoom: this.view.zoom });
    if (this.viewStack.length > 25) this.viewStack.shift();
  };
  Renderer.prototype.prevView = function () {
    if (!this.viewStack.length) return false;
    this.view = this.viewStack.pop();
    this.needs = true;
    return true;
  };
  Renderer.prototype.zoomBox = function (b, margin) {
    if (!G.bboxValid(b)) return false;
    var w = Math.max(b.x2 - b.x1, 1e-6), h = Math.max(b.y2 - b.y1, 1e-6);
    var m = margin === undefined ? 0.94 : margin;
    this.pushView();
    this.view.zoom = Math.min(this.W / w, this.H / h) * m;
    if (!isFinite(this.view.zoom) || this.view.zoom <= 0) this.view.zoom = 1;
    this.view.zoom = Math.max(1e-6, Math.min(1e7, this.view.zoom));
    this.view.cx = (b.x1 + b.x2) / 2;
    this.view.cy = (b.y1 + b.y2) / 2;
    this.needs = true;
    return true;
  };
  Renderer.prototype.zoomBy = function (f, sp) {
    var before = this.s2w(sp);
    this.view.zoom = Math.max(1e-6, Math.min(1e7, this.view.zoom * f));
    var after = this.s2w(sp);
    this.view.cx += before.x - after.x;
    this.view.cy += before.y - after.y;
    this.needs = true;
  };
  Renderer.prototype.panBy = function (dxs, dys) {
    this.view.cx -= dxs / this.view.zoom;
    this.view.cy += dys / this.view.zoom;
    this.needs = true;
  };

  /* ---------- Colores ---------- */
  Renderer.prototype.colorOf = function (ent, doc) {
    var c = E.effColor(ent, doc);
    if (typeof c === 'number' && this._colMemo) {
      var m = this._colMemo.get(c);
      if (m !== undefined) return m;
      var v = c === 7 ? (this.app.paperMode ? '#000000' : (this.app.lightTheme ? '#000000' : '#ffffff')) : G.aciCSS(c);
      this._colMemo.set(c, v);
      return v;
    }
    if (c && typeof c === 'object' && c.rgb) return 'rgb(' + c.rgb.join(',') + ')';
    var i = c | 0;
    if (i === 7) return this.app.paperMode ? '#000000' : '#ffffff';
    return G.aciCSS(i);
  };

  Renderer.prototype.lwPx = function (ent, doc) {
    if (!doc.vars.LWDISPLAY) return 1;
    var w = E.effLw(ent, doc);
    if (w <= 0) return 1;
    return Math.max(1, (w / 100) * 3.7795 * 0.75);
  };

  Renderer.prototype.dashOf = function (ent, doc) {
    var name = E.effLtype(ent, doc);
    if (name === 'CONTINUOUS' || name === 'Continuous') return null;
    var memo = this._dashMemo;
    var mk = name + '|' + (ent.ltscale || 1);
    if (memo) { var hit = memo.get(mk); if (hit !== undefined) return hit; }
    var lt = doc.ltypes[name];
    if (!lt || !lt.pat || !lt.pat.length) { if (memo) memo.set(mk, null); return null; }
    var s = (doc.vars.LTSCALE || 1) * (ent.ltscale || 1) * this.view.zoom;
    var out = lt.pat.map(function (v) { return Math.max(0.1, Math.abs(v) * s); });
    var total = out.reduce(function (a, b) { return a + b; }, 0);
    if (total < 1.5) { if (memo) memo.set(mk, null); return null; }   /* demasiado denso */
    if (total > 4000) { if (memo) memo.set(mk, null); return null; }  /* demasiado largo */
    if (memo) memo.set(mk, out);
    return out;
  };

  /* ============================================================
     Dibujo principal
     ============================================================ */
  /* Rectángulo del dibujo que ocupa la ventana, con un margen */
  Renderer.prototype.viewBox = function (pad) {
    var a = this.s2w({ x: 0, y: this.H }), b = this.s2w({ x: this.W, y: 0 });
    var m = (pad === undefined ? 24 : pad) / this.view.zoom;
    return { x1: a.x - m, y1: a.y - m, x2: b.x + m, y2: b.y + m };
  };

  Renderer.prototype.render = function () {
    var ctx = this.ctx, app = this.app;
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'round';

    this.paintScene(ctx);

    /* ---- superposiciones: se repintan siempre, son baratas ---- */
    var self = this, doc = app.doc;
    this._colMemo = this._colMemo || new Map();
    this._dashMemo = this._dashMemo || new Map();
    if (app.selSet.length) {
      ctx.save();
      var lim = Math.min(app.selSet.length, 4000);
      /* el resplandor sólo con pocos objetos: con miles no aporta y cuesta */
      if (lim <= 600) for (var g = 0; g < lim; g++) self.drawEntity(app.selSet[g], doc, { glow: true });
      for (var i = 0; i < lim; i++) self.drawEntity(app.selSet[i], doc, { hl: true });
      ctx.restore();
      this.drawGrips();
    }
    if (app.hoverEnt && app.selSet.indexOf(app.hoverEnt) < 0 &&
        doc.vars.SELECTIONPREVIEW !== 0) {
      this.drawEntity(app.hoverEnt, doc, { glow: true, hoverGlow: true });
      this.drawEntity(app.hoverEnt, doc, { hover: true });
    }
    if (app.preview && app.preview.length) {
      ctx.save();
      app.preview.forEach(function (e) { self.drawEntity(e, doc, { preview: true }); });
      ctx.restore();
    }
    if (app.rubber) this.drawRubber(app.rubber);

    this.drawUCS();
    if (app.pickBox) this.drawPickWindow(app.pickBox);
    if (app.lassoPath) this.drawLasso(app.lassoPath);
    if (CAD.Track) CAD.Track.draw(this, ctx);
    if (app.trackLines) this.drawTracking(app.trackLines);
    if (app.snapHit) this.drawSnapMarker(app.snapHit);
    if (app.showCross) this.drawCrosshair();

    ctx.restore();
    this.needs = false;
  };

  /* ============================================================
     Caché de escena
     El fondo, la rejilla y los objetos se pintan en un lienzo
     auxiliar más grande que la ventana. Mientras sólo se encuadre
     dentro de ese margen, dibujar es un único volcado de imagen.
     ============================================================ */
  Renderer.prototype.sceneSig = function () {
    var app = this.app, doc = app.doc, v = doc.vars;
    return [doc.rev, doc.layerSig(), v.LWDISPLAY, v.GRIDMODE, v.GRIDUNIT, v.GRIDMAJOR,
      v.LTSCALE, v.FILLMODE, v.PDMODE, v.PDSIZE, v.UCSANG, v.UCSORG.x, v.UCSORG.y,
      app.paperMode ? 'P' : 'M', app.layoutIndex, app.activeVp ? 1 : 0,
      app.lightTheme ? 1 : 0, THEME.bg, app.wipeoutFrames === false ? 0 : 1,
      this.W, this.H, this.dpr, this.fastMode ? 1 : 0].join('|');
  };

  Renderer.prototype.paintScene = function (ctx) {
    var sc = this.scene;
    if (!sc) {
      var cv = document.createElement('canvas');
      sc = this.scene = { cv: cv, ctx: cv.getContext('2d', { alpha: false }), valid: false };
    }
    var pad = Math.round(Math.max(64, Math.min(260, Math.min(this.W, this.H) * 0.3)));
    var sig = this.sceneSig();
    var v = this.view;
    var reuse = sc.valid && sc.sig === sig && sc.zoom === v.zoom && sc.pad === pad;
    var dx = 0, dy = 0;
    if (reuse) {
      dx = (sc.cx - v.cx) * v.zoom;
      dy = (v.cy - sc.cy) * v.zoom;
      if (Math.abs(dx) > pad - 1 || Math.abs(dy) > pad - 1) reuse = false;
    }
    if (!reuse) {
      var t0 = performance.now();
      this.buildScene(sc, pad, sig);
      this.lastSceneMs = performance.now() - t0;
      dx = 0; dy = 0;
    }
    ctx.drawImage(sc.cv, 0, 0, sc.cv.width, sc.cv.height,
      -pad + dx, -pad + dy, sc.wCss, sc.hCss);
  };

  Renderer.prototype.buildScene = function (sc, pad, sig) {
    var wCss = this.W + pad * 2, hCss = this.H + pad * 2;
    var pw = Math.round(wCss * this.dpr), ph = Math.round(hCss * this.dpr);
    if (sc.cv.width !== pw || sc.cv.height !== ph) { sc.cv.width = pw; sc.cv.height = ph; }
    var mainCtx = this.ctx, mainW = this.W, mainH = this.H;
    this.ctx = sc.ctx;
    this.W = wCss; this.H = hCss;
    this._colMemo = new Map();
    this._dashMemo = new Map();
    this.stats = { dibujados: 0, lotes: 0, puntos: 0, omitidos: 0 };
    sc.ctx.save();
    sc.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    sc.ctx.lineCap = 'butt';
    sc.ctx.lineJoin = 'round';
    try {
      this.drawWorld();
    } finally {
      sc.ctx.restore();
      this.ctx = mainCtx;
      this.W = mainW; this.H = mainH;
    }
    sc.valid = true; sc.sig = sig; sc.pad = pad;
    sc.cx = this.view.cx; sc.cy = this.view.cy; sc.zoom = this.view.zoom;
    sc.wCss = wCss; sc.hCss = hCss;
  };

  Renderer.prototype.invalidateScene = function () { if (this.scene) this.scene.valid = false; };

  /* Fondo, rejilla y objetos, en el contexto activo */
  Renderer.prototype.drawWorld = function () {
    var ctx = this.ctx, app = this.app, doc = app.doc;
    ctx.fillStyle = app.paperMode ? '#5a5f66' : (app.lightTheme ? '#ffffff' : THEME.bg);
    ctx.fillRect(0, 0, this.W, this.H);
    if (app.paperMode) { this.renderPaper(); return; }
    if (doc.vars.GRIDMODE) this.drawGrid();
    var wb = this.viewBox();
    this.drawEntities(CAD.queryVisible(app, wb), doc, wb);
  };

  var BATCHABLE = { LINE: 1, LWPOLYLINE: 1, CIRCLE: 1, ARC: 1, ELLIPSE: 1, SPLINE: 1 };

  Renderer.prototype.drawEntities = function (list, doc, wbox) {
    var ctx = this.ctx, self = this;
    if (!wbox) wbox = this.viewBox();
    var zoom = this.view.zoom;
    var minPx = this.fastMode ? 3.2 : 1.4;
    var batches = new Map();
    var dots = null;
    var hatches = null;
    var complex = null;
    var n = list.length;

    for (var i = 0; i < n; i++) {
      var ent = list[i];
      var t = ent.type;
      if (t === 'HATCH') {
        if (ent.wipeout) (complex || (complex = [])).push(ent);
        else (hatches || (hatches = [])).push(ent);
        continue;
      }
      if (!BATCHABLE[t]) { (complex || (complex = [])).push(ent); continue; }
      var b = E.bboxOf(ent, doc);
      if (b.x1 <= b.x2) {
        if (b.x2 < wbox.x1 || b.x1 > wbox.x2 || b.y2 < wbox.y1 || b.y1 > wbox.y2) { self.stats.omitidos++; continue; }
        var dpx = Math.max(b.x2 - b.x1, b.y2 - b.y1) * zoom;
        if (dpx < minPx) {
          (dots || (dots = [])).push(b.x1, b.y1, self.colorOf(ent, doc));
          continue;
        }
      }
      var col = self.colorOf(ent, doc);
      var lw = self.lwPx(ent, doc);
      var dash = self.dashOf(ent, doc);
      var key = col + '|' + lw + '|' + (dash ? dash.join(',') : '');
      var bt = batches.get(key);
      if (!bt) { bt = { col: col, lw: lw, dash: dash, path: new Path2D() }; batches.set(key, bt); }
      self.addToPath(bt.path, ent, doc);
      self.stats.dibujados++;
    }

    /* sombreados primero: son rellenos */
    if (hatches) for (var h = 0; h < hatches.length; h++) self.drawEntity(hatches[h], doc);
    if (this.fastMode && complex && complex.length > 600) complex.length = 600;

    /* un solo trazado por combinación de color, grosor y tipo de línea */
    ctx.save();
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'round';
    batches.forEach(function (bt) {
      ctx.strokeStyle = bt.col;
      ctx.lineWidth = bt.lw;
      ctx.setLineDash(bt.dash || EMPTY);
      ctx.stroke(bt.path);
      self.stats.lotes++;
    });
    ctx.restore();

    /* objetos diminutos: una marca de un píxel */
    if (dots) {
      ctx.save();
      for (var d = 0; d < dots.length; d += 3) {
        ctx.fillStyle = dots[d + 2];
        ctx.fillRect(Math.round(self.sx(dots[d])), Math.round(self.sy(dots[d + 1])), 1, 1);
        self.stats.puntos++;
      }
      ctx.restore();
    }

    if (complex) for (var c = 0; c < complex.length; c++) self.drawEntity(complex[c], doc);
  };

  var EMPTY = [];

  /* Añade la geometría de un objeto al trazado del lote */
  Renderer.prototype.addToPath = function (path, ent, doc) {
    var z = this.view.zoom;
    switch (ent.type) {
      case 'LINE': {
        path.moveTo(this.sx(ent.p1.x), this.sy(ent.p1.y));
        path.lineTo(this.sx(ent.p2.x), this.sy(ent.p2.y));
        return;
      }
      case 'CIRCLE': {
        var r = ent.r * z;
        if (r < 0.4) return;
        var cx = this.sx(ent.c.x), cy = this.sy(ent.c.y);
        path.moveTo(cx + r, cy);
        path.arc(cx, cy, r, 0, G.TAU);
        return;
      }
      case 'ARC': {
        var ra = ent.r * z;
        if (ra < 0.4) return;
        var ax = this.sx(ent.c.x), ay = this.sy(ent.c.y);
        /* El subtrazado empieza donde arranca el barrido del lienzo, que
           es el ángulo -a1: colocando el lápiz en -a0 se dibujaba además
           la cuerda que cierra el arco. */
        path.moveTo(ax + ra * Math.cos(-ent.a1), ay + ra * Math.sin(-ent.a1));
        path.arc(ax, ay, ra, -ent.a1, -ent.a0);
        return;
      }
      case 'ELLIPSE': {
        var ma = G.len(ent.maj) * z;
        if (ma < 0.4) return;
        var ex = this.sx(ent.c.x), ey = this.sy(ent.c.y);
        var rot = -Math.atan2(ent.maj.y, ent.maj.x);
        var p0 = G.ellPt(ent.c, ent.maj.x, ent.maj.y, ent.ratio, ent.t0);
        path.moveTo(this.sx(p0.x), this.sy(p0.y));
        /* El parámetro del lienzo es el del mundo cambiado de signo (la Y
           va al revés), así que el barrido va de -t0 a -t1 en sentido
           antihorario.  Al revés se pintaba el arco complementario y una
           cuerda de propina. */
        path.ellipse(ex, ey, ma, ma * ent.ratio, rot, -ent.t0, -ent.t1, true);
        return;
      }
      default: {
        var segs = E.dispOf(ent, doc, this.quality());
        for (var i = 0; i < segs.length; i++) this.addPts(path, segs[i].pts, segs[i].closed);
        return;
      }
    }
  };

  /* Vuelca puntos descartando los que caen a menos de medio píxel.
     El cierre se hace con una línea explícita y nunca con closePath():
     sobre un trazado que va creciendo, closePath() es cuadrático y
     hunde el rendimiento al agrupar miles de objetos en un lote. */
  Renderer.prototype.addPts = function (path, pts, closed) {
    var n = pts.length;
    if (n < 2) return;
    var px = this.sx(pts[0].x), py = this.sy(pts[0].y);
    path.moveTo(px, py);
    var lx = px, ly = py;
    for (var i = 1; i < n; i++) {
      var x = this.sx(pts[i].x), y = this.sy(pts[i].y);
      if (i < n - 1 && Math.abs(x - lx) < 0.6 && Math.abs(y - ly) < 0.6) continue;
      path.lineTo(x, y);
      lx = x; ly = y;
    }
    if (closed) path.lineTo(px, py);
  };

  /* Entidades del espacio modelo visibles, con independencia del espacio activo */
  Renderer.prototype.modelVisible = function (doc, vp) {
    var frozen = (vp && vp.frozen) || [];
    return doc.entities.filter(function (e) {
      var l = doc.layer(e.layer);
      return l.on && !l.frozen && !e.hidden && frozen.indexOf(e.layer) < 0;
    });
  };

  /* ============================================================
     Espacio papel
     ============================================================ */
  Renderer.prototype.renderPaper = function () {
    var ctx = this.ctx, app = this.app, doc = app.doc;
    var lay = app.layout;
    if (!lay) return;
    var interView = this.view;
    var pv;

    if (app.activeVp) {
      /* dentro de una ventana: this.view es la vista de modelo */
      var vp = app.activeVp;
      pv = this.paperView;
      var vcx = vp.x + vp.w / 2, vcy = vp.y + vp.h / 2;
      if (vp.locked) {
        this.view.zoom = vp.scale * pv.zoom;
        this.view.cx = vp.cx - (vcx - pv.cx) / vp.scale;
        this.view.cy = vp.cy - (vcy - pv.cy) / vp.scale;
      } else {
        vp.scale = Math.max(1e-9, this.view.zoom / pv.zoom);
        vp.cx = this.view.cx + (vcx - pv.cx) / vp.scale;
        vp.cy = this.view.cy + (vcy - pv.cy) / vp.scale;
      }
    } else {
      pv = this.view;
      this.paperView = pv;
    }

    /* --- hoja --- */
    this.view = pv;
    this.drawSheet(lay);

    /* --- contenido de cada ventana gráfica --- */
    var self = this;
    (lay.viewports || []).forEach(function (vp2) {
      if (vp2.on === false) return;
      var a = self.w2s({ x: vp2.x, y: vp2.y + vp2.h });
      var b = self.w2s({ x: vp2.x + vp2.w, y: vp2.y });
      if (b.x < 0 || a.x > self.W || b.y < 0 || a.y > self.H) return;
      ctx.save();
      ctx.beginPath();
      ctx.rect(a.x, a.y, b.x - a.x, b.y - a.y);
      ctx.clip();
      ctx.fillStyle = self.app.lightTheme ? '#ffffff' : '#ffffff';
      ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
      var keep = self.view;
      self.view = self.vpView(vp2, pv);
      var savedPaper = self.app.paperMode;
      self.app.paperMode = true;      /* fuerza tinta oscura sobre papel */
      var mv = self.modelVisible(doc, vp2);
      var vb = self.viewBox();
      self.drawEntities(CAD.queryModel(doc, mv, vb), doc, vb);
      self.app.paperMode = savedPaper;
      self.view = keep;
      ctx.restore();
      /* marco de la ventana */
      ctx.save();
      ctx.setLineDash([]);
      var active = self.app.activeVp === vp2;
      ctx.strokeStyle = active ? THEME.accentVp : '#8d949c';
      ctx.lineWidth = active ? 2 : 1;
      ctx.strokeRect(a.x + .5, a.y + .5, b.x - a.x, b.y - a.y);
      ctx.restore();
    });

    /* --- entidades del espacio papel --- */
    this.view = pv;
    this.drawEntities(doc.visible(), doc);

    /* --- vuelve a la vista interactiva --- */
    this.view = interView;
  };

  Renderer.prototype.vpView = function (vp, pv) {
    var vcx = vp.x + vp.w / 2, vcy = vp.y + vp.h / 2;
    var sc = vp.scale || 1;
    return {
      cx: vp.cx - (vcx - pv.cx) / sc,
      cy: vp.cy - (vcy - pv.cy) / sc,
      zoom: sc * pv.zoom
    };
  };

  Renderer.prototype.drawSheet = function (lay) {
    var ctx = this.ctx;
    var p1 = this.w2s({ x: 0, y: 0 }), p2 = this.w2s({ x: lay.w, y: lay.h });
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 5;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(p1.x, p2.y, p2.x - p1.x, p1.y - p2.y);
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = '#2a2d31'; ctx.lineWidth = 1;
    ctx.strokeRect(p1.x + .5, p2.y + .5, p2.x - p1.x, p1.y - p2.y);
    var m = lay.margin || 10;
    var q1 = this.w2s({ x: m, y: m }), q2 = this.w2s({ x: lay.w - m, y: lay.h - m });
    ctx.setLineDash([5, 4]); ctx.strokeStyle = '#a8adb3';
    ctx.strokeRect(q1.x + .5, q2.y + .5, q2.x - q1.x, q1.y - q2.y);
    ctx.setLineDash([]);
    ctx.restore();
  };

  /* ---------- Rejilla ---------- */
  Renderer.prototype.drawGrid = function () {
    var ctx = this.ctx, doc = this.app.doc;
    var base = doc.vars.GRIDUNIT || 10;
    var major = doc.vars.GRIDMAJOR || 5;
    var z = this.view.zoom;
    var step = base;
    while (step * z < 8) step *= (step * z * major < 8 ? major : 2);
    while (step * z > 160) step /= 2;
    var majStep = step * major;
    var tl = this.s2w({ x: 0, y: 0 }), br = this.s2w({ x: this.W, y: this.H });
    var x0 = Math.floor(tl.x / step) * step, x1 = Math.ceil(br.x / step) * step;
    var y0 = Math.floor(br.y / step) * step, y1 = Math.ceil(tl.y / step) * step;
    if ((x1 - x0) / step > 4000 || (y1 - y0) / step > 4000) return;

    var ua = doc.vars.UCSANG || 0, uo = doc.vars.UCSORG || { x: 0, y: 0 };
    ctx.save();
    if (ua || uo.x || uo.y) {
      var so = this.w2s(uo);
      ctx.translate(so.x, so.y);
      ctx.rotate(-ua);
      ctx.translate(-so.x, -so.y);
    }
    ctx.lineWidth = 1;
    /* menores */
    ctx.strokeStyle = this.app.paperMode ? '#e2e2e2' : THEME.gridMinor;
    ctx.beginPath();
    for (var x = x0; x <= x1 + 1e-9; x += step) {
      if (Math.abs(x % majStep) < step / 100) continue;
      var px = Math.round(this.sx(x)) + 0.5;
      ctx.moveTo(px, 0); ctx.lineTo(px, this.H);
    }
    for (var y = y0; y <= y1 + 1e-9; y += step) {
      if (Math.abs(y % majStep) < step / 100) continue;
      var py = Math.round(this.sy(y)) + 0.5;
      ctx.moveTo(0, py); ctx.lineTo(this.W, py);
    }
    ctx.stroke();
    /* mayores */
    ctx.strokeStyle = this.app.paperMode ? '#cfcfcf' : THEME.gridMajor;
    ctx.beginPath();
    var mx0 = Math.floor(tl.x / majStep) * majStep, my0 = Math.floor(br.y / majStep) * majStep;
    for (var X = mx0; X <= x1 + 1e-9; X += majStep) {
      var PX = Math.round(this.sx(X)) + 0.5;
      ctx.moveTo(PX, 0); ctx.lineTo(PX, this.H);
    }
    for (var Y = my0; Y <= y1 + 1e-9; Y += majStep) {
      var PY = Math.round(this.sy(Y)) + 0.5;
      ctx.moveTo(0, PY); ctx.lineTo(this.W, PY);
    }
    ctx.stroke();
    /* ejes */
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = this.app.paperMode ? '#f0b8b8' : THEME.axisX;
    ctx.beginPath(); var ay = Math.round(this.sy(0)) + 0.5;
    ctx.moveTo(0, ay); ctx.lineTo(this.W, ay); ctx.stroke();
    ctx.strokeStyle = this.app.paperMode ? '#b8e8b8' : THEME.axisY;
    ctx.beginPath(); var ax = Math.round(this.sx(0)) + 0.5;
    ctx.moveTo(ax, 0); ctx.lineTo(ax, this.H); ctx.stroke();
    ctx.restore();
  };

  /* ---------- Hoja (espacio papel) ---------- */
  Renderer.prototype.drawPaper = function () {
    var ctx = this.ctx, lay = this.app.layout;
    if (!lay) return;
    var w = lay.w, h = lay.h;
    var p1 = this.w2s({ x: 0, y: 0 }), p2 = this.w2s({ x: w, y: h });
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 4;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(p1.x, p2.y, p2.x - p1.x, p1.y - p2.y);
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = '#8a8a8a'; ctx.lineWidth = 1;
    ctx.strokeRect(p1.x + .5, p2.y + .5, p2.x - p1.x, p1.y - p2.y);
    /* margen de impresión */
    var m = lay.margin || 10;
    var q1 = this.w2s({ x: m, y: m }), q2 = this.w2s({ x: w - m, y: h - m });
    ctx.setLineDash([4, 4]); ctx.strokeStyle = '#a0a0a0';
    ctx.strokeRect(q1.x + .5, q2.y + .5, q2.x - q1.x, q1.y - q2.y);
    ctx.setLineDash([]);
    ctx.restore();
  };

  /* ============================================================
     Entidades
     ============================================================ */
  Renderer.prototype.drawEntity = function (ent, doc, o) {
    o = o || {};
    var ctx = this.ctx;
    var b = ent.type === 'XLINE' || ent.type === 'RAY' ? null : E.bboxOf(ent, doc);
    if (b && G.bboxValid(b)) {
      var s1 = this.w2s({ x: b.x1, y: b.y2 }), s2 = this.w2s({ x: b.x2, y: b.y1 });
      if (s2.x < -60 || s1.x > this.W + 60 || s2.y < -60 || s1.y > this.H + 60) return;
    }
    ctx.save();
    var col, lw = this.lwPx(ent, doc), dash = this.dashOf(ent, doc);
    if (o.glow) {
      /* Resplandor ancho por debajo: es lo que hace que un objeto
         designado se distinga aunque comparta color con el fondo de la
         capa, igual que en AutoCAD desde 2015. */
      col = o.hoverGlow ? THEME.hoverGlow : THEME.selGlow;
      lw = Math.max(lw, 1) + (o.hoverGlow ? 3.5 : 4.5);
      dash = null;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    }
    else if (o.hl) { col = THEME.highlight; ctx.globalAlpha = 0.95; lw = Math.max(lw, 1.6); dash = [6, 4]; }
    else if (o.hover) { col = '#eef4ff'; lw = Math.max(lw, 1.7); }
    else if (o.preview) { col = o.color || THEME.preview; lw = 1; dash = dash || null; }
    else col = this.colorOf(ent, doc);
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = lw;
    if (dash) ctx.setLineDash(dash);

    switch (ent.type) {
      case 'LINE': this.pathPts(ctx, [ent.p1, ent.p2], false); ctx.stroke(); break;
      case 'XLINE': case 'RAY': {
        var ang = Math.atan2(ent.d.y, ent.d.x);
        var big = (this.W + this.H) / this.view.zoom;
        var a = ent.type === 'XLINE' ? G.polar(ent.p, ang, -big) : ent.p;
        this.pathPts(ctx, [a, G.polar(ent.p, ang, big)], false); ctx.stroke();
        break;
      }
      case 'CIRCLE': {
        var c = this.w2s(ent.c), r = ent.r * this.view.zoom;
        if (r > 0.4) { ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, G.TAU); ctx.stroke(); }
        break;
      }
      case 'ARC': {
        var ca = this.w2s(ent.c), ra = ent.r * this.view.zoom;
        if (ra > 0.4) { ctx.beginPath(); ctx.arc(ca.x, ca.y, ra, -ent.a1, -ent.a0); ctx.stroke(); }
        break;
      }
      case 'ELLIPSE': {
        var ce = this.w2s(ent.c), ma = G.len(ent.maj) * this.view.zoom;
        var rot = -Math.atan2(ent.maj.y, ent.maj.x);
        ctx.beginPath();
        ctx.ellipse(ce.x, ce.y, ma, ma * ent.ratio, rot, -ent.t0, -ent.t1, true);
        ctx.stroke();
        break;
      }
      case 'LWPOLYLINE': {
        var dsp = E.dispOf(ent, doc, this.quality());
        var pts = dsp[0] ? dsp[0].pts : [];
        if (ent.width > 0 && doc.vars.FILLMODE) {
          this.drawWidePline(ctx, pts, ent.closed, ent.width * this.view.zoom, col);
        } else { this.pathPts(ctx, pts, ent.closed); ctx.stroke(); }
        break;
      }
      case 'SPLINE': this.pathPts(ctx, E.splinePts(ent), ent.closed); ctx.stroke(); break;
      case 'POINT': this.drawPoint(ctx, ent, doc, col); break;
      case 'SOLID': {
        this.pathPts(ctx, ent.pts, true);
        if (doc.vars.FILLMODE && !o.hl) ctx.fill(); else ctx.stroke();
        break;
      }
      case 'TEXT': case 'ATTRIB': this.drawText(ctx, ent, doc, col, o); break;
      case 'ATTDEF': this.drawText(ctx, ent, doc, o.preview ? col : '#a07de0', o); break;
      case 'MTEXT': this.drawMText(ctx, ent, doc, col, o); break;
      case 'HATCH': this.drawHatch(ctx, ent, doc, col, o); break;
      case 'INSERT': {
        var self = this;
        E.insertChildren(ent, doc).forEach(function (ch) {
          self.drawEntity(ch, doc, o.hl || o.hover || o.preview ? o : {});
        });
        break;
      }
      case 'DIMENSION': case 'LEADER': this.drawDim(ctx, ent, doc, col, o); break;
    }
    ctx.restore();
  };

  Renderer.prototype.quality = function () { return this.view.zoom > 8 ? 2 : 1; };

  Renderer.prototype.pathPts = function (ctx, pts, closed) {
    ctx.beginPath();
    if (!pts.length) return;
    var p = this.w2s(pts[0]);
    ctx.moveTo(p.x, p.y);
    for (var i = 1; i < pts.length; i++) { p = this.w2s(pts[i]); ctx.lineTo(p.x, p.y); }
    if (closed) ctx.closePath();
  };

  Renderer.prototype.drawWidePline = function (ctx, pts, closed, wpx, col) {
    ctx.save();
    ctx.lineWidth = Math.max(1, wpx);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = col;
    this.pathPts(ctx, pts, closed);
    ctx.stroke();
    ctx.restore();
  };

  Renderer.prototype.drawPoint = function (ctx, ent, doc, col) {
    var p = this.w2s(ent.p);
    var mode = doc.vars.PDMODE | 0;
    var size = doc.vars.PDSIZE || 0;
    var r = size > 0 ? size * this.view.zoom / 2 : 4;
    r = Math.max(2, Math.min(40, r));
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.setLineDash([]); ctx.lineWidth = 1;
    var base = mode % 32, deco = mode - base;
    ctx.beginPath();
    if (base === 0) { ctx.arc(p.x, p.y, 1.4, 0, G.TAU); ctx.fill(); }
    else if (base === 1) { /* nada */ }
    else if (base === 2) { ctx.moveTo(p.x - r, p.y); ctx.lineTo(p.x + r, p.y); ctx.moveTo(p.x, p.y - r); ctx.lineTo(p.x, p.y + r); ctx.stroke(); }
    else if (base === 3) { ctx.moveTo(p.x - r, p.y - r); ctx.lineTo(p.x + r, p.y + r); ctx.moveTo(p.x - r, p.y + r); ctx.lineTo(p.x + r, p.y - r); ctx.stroke(); }
    else if (base === 4) { ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y - r); ctx.stroke(); }
    if (deco === 32) { ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, G.TAU); ctx.stroke(); }
    if (deco === 64) { ctx.strokeRect(p.x - r, p.y - r, 2 * r, 2 * r); }
    if (deco === 96) { ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, G.TAU); ctx.stroke(); ctx.strokeRect(p.x - r, p.y - r, 2 * r, 2 * r); }
  };

  Renderer.prototype.fontOf = function (style, doc, px) {
    var st = doc.textStyles[style] || doc.textStyles.Standard;
    var fam = (st && st.css) || 'AcadStick';
    return px.toFixed(2) + 'px "' + fam + '", "Arial Narrow", Arial, sans-serif';
  };

  Renderer.prototype.drawText = function (ctx, ent, doc, col, o) {
    var px = ent.h * this.view.zoom;
    if (px < 3) {
      var b = E.extents(ent, doc);
      var q1 = this.w2s({ x: b.x1, y: b.y2 }), q2 = this.w2s({ x: b.x2, y: b.y1 });
      ctx.setLineDash([]); ctx.strokeStyle = col; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(q1.x, (q1.y + q2.y) / 2); ctx.lineTo(q2.x, (q1.y + q2.y) / 2); ctx.stroke();
      return;
    }
    var p = this.w2s(ent.p);
    ctx.save();
    ctx.setLineDash([]);
    ctx.translate(p.x, p.y);
    ctx.rotate(-ent.rot);
    var st = doc.textStyles[ent.style] || {};
    var wf = (ent.wfac || 1) * (st.wfac || 1);
    if (wf !== 1) ctx.scale(wf, 1);
    if (st.oblique) ctx.transform(1, 0, -Math.tan(G.rad(st.oblique)), 1, 0, 0);
    ctx.font = this.fontOf(ent.style, doc, px);
    ctx.fillStyle = col;
    ctx.textAlign = ent.halign === 1 || ent.halign === 4 ? 'center' : ent.halign === 2 ? 'right' : 'left';
    ctx.textBaseline = ent.valign === 3 ? 'top' : ent.valign === 2 ? 'middle' : ent.valign === 1 ? 'bottom' : 'alphabetic';
    ctx.fillText(ent.text, 0, 0);
    if (o && o.hl) { ctx.globalAlpha = 0.35; ctx.fillText(ent.text, 0, 0); }
    ctx.restore();
  };

  Renderer.prototype.drawMText = function (ctx, ent, doc, col, o) {
    var lay = E.mtextLayout(ent, doc);
    var px = ent.h * this.view.zoom;
    if (px < 3) {
      var b = E.extents(ent, doc);
      var q1 = this.w2s({ x: b.x1, y: b.y2 }), q2 = this.w2s({ x: b.x2, y: b.y1 });
      ctx.setLineDash([]); ctx.strokeStyle = col; ctx.globalAlpha = 0.7;
      ctx.fillRect(q1.x, q1.y, q2.x - q1.x, q2.y - q1.y);
      return;
    }
    var o2 = this.w2s(lay.o);
    ctx.save();
    ctx.setLineDash([]);
    ctx.translate(o2.x, o2.y);
    ctx.rotate(-ent.rot);
    ctx.font = this.fontOf(ent.style, doc, px);
    ctx.fillStyle = col;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    var lhp = lay.lh * this.view.zoom;
    var maxW = ent.width > 0 ? ent.width * this.view.zoom : Infinity;
    var y = lhp * 0.82;
    for (var i = 0; i < lay.lines.length; i++) {
      var line = lay.lines[i];
      if (maxW < Infinity && ctx.measureText(line).width > maxW) {
        var words = line.split(' '), cur = '';
        for (var w = 0; w < words.length; w++) {
          var t = cur ? cur + ' ' + words[w] : words[w];
          if (ctx.measureText(t).width > maxW && cur) { ctx.fillText(cur, 0, y); y += lhp; cur = words[w]; }
          else cur = t;
        }
        ctx.fillText(cur, 0, y); y += lhp;
      } else { ctx.fillText(line, 0, y); y += lhp; }
    }
    ctx.restore();
  };

  Renderer.prototype.drawDim = function (ctx, ent, doc, col, o) {
    var geo = CAD.Dim.build(ent, doc);
    var self = this;
    ctx.setLineDash(o && o.hl ? [6, 4] : []);
    ctx.beginPath();
    geo.lines.forEach(function (l) {
      var a = self.w2s(l[0]), b = self.w2s(l[1]);
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    });
    geo.arcs.forEach(function (a) {
      var c = self.w2s(a.c), r = a.r * self.view.zoom;
      if (r > 0.4) { ctx.moveTo(c.x + r * Math.cos(-a.a1), c.y + r * Math.sin(-a.a1)); ctx.arc(c.x, c.y, r, -a.a1, -a.a0); }
    });
    ctx.stroke();
    geo.solids.forEach(function (s) {
      ctx.beginPath();
      var p = self.w2s(s[0]); ctx.moveTo(p.x, p.y);
      for (var i = 1; i < s.length; i++) { p = self.w2s(s[i]); ctx.lineTo(p.x, p.y); }
      ctx.closePath(); ctx.fill();
    });
    geo.dots.forEach(function (d) {
      var c = self.w2s(d.c);
      ctx.beginPath(); ctx.arc(c.x, c.y, d.r * self.view.zoom, 0, G.TAU); ctx.fill();
    });
    geo.texts.forEach(function (t) {
      var px = t.h * self.view.zoom;
      if (px < 3) return;
      var p = self.w2s(t.p);
      ctx.save();
      ctx.setLineDash([]);
      ctx.translate(p.x, p.y); ctx.rotate(-t.rot);
      ctx.font = self.fontOf('Standard', doc, px);
      ctx.fillStyle = col;
      ctx.textAlign = t.halign === 1 ? 'center' : t.halign === 2 ? 'right' : 'left';
      ctx.textBaseline = t.valign === 2 ? 'middle' : t.valign === 3 ? 'top' : 'alphabetic';
      ctx.fillText(t.text, 0, 0);
      ctx.restore();
    });
  };

  /* ---------- Sombreado ---------- */
  Renderer.prototype.drawHatch = function (ctx, ent, doc, col, o) {
    if (!ent.loops || !ent.loops.length) return;
    var self = this;
    ctx.save();
    ctx.setLineDash([]);
    ctx.beginPath();
    ent.loops.forEach(function (loop) {
      if (loop.length < 2) return;
      var p = self.w2s(loop[0]);
      ctx.moveTo(p.x, p.y);
      for (var i = 1; i < loop.length; i++) { p = self.w2s(loop[i]); ctx.lineTo(p.x, p.y); }
      ctx.closePath();
    });
    if (ent.wipeout) {
      ctx.fillStyle = this.app.paperMode ? '#ffffff' : (this.app.lightTheme ? '#ffffff' : THEME.bg);
      ctx.fill('evenodd');
      if (this.app.wipeoutFrames !== false) {
        ctx.setLineDash([]);
        ctx.strokeStyle = o && o.hl ? THEME.highlight : col;
        ctx.lineWidth = o && o.hl ? 1.6 : 1;
        var self2 = this;
        ent.loops.forEach(function (loop) { self2.pathPts(ctx, loop, true); ctx.stroke(); });
      }
      ctx.restore();
      return;
    }
    var alpha = 1 - (ent.transparency || 0) / 100;
    ctx.globalAlpha = o && o.hl ? 0.55 : alpha;
    if (ent.solid || CAD.HatchLib.isSolid(ent.pattern)) {
      ctx.fillStyle = col;
      ctx.fill('evenodd');
    } else if (ent.gradient) {
      var b = E.extents(ent, doc);
      var g1 = this.w2s({ x: b.x1, y: b.y2 }), g2 = this.w2s({ x: b.x2, y: b.y1 });
      var grd = ctx.createLinearGradient(g1.x, g1.y, g2.x, g2.y);
      grd.addColorStop(0, ent.gradient[0]); grd.addColorStop(1, ent.gradient[1]);
      ctx.fillStyle = grd; ctx.fill('evenodd');
    } else {
      ctx.clip('evenodd');
      this.drawHatchPattern(ctx, ent, doc, col);
    }
    ctx.restore();
    if (o && o.hl) {
      ctx.save(); ctx.setLineDash([6, 4]); ctx.strokeStyle = THEME.highlight; ctx.lineWidth = 1.4;
      ent.loops.forEach(function (loop) { self.pathPts(ctx, loop, true); ctx.stroke(); });
      ctx.restore();
    }
  };

  Renderer.prototype.drawHatchPattern = function (ctx, ent, doc, col) {
    var b = E.extents(ent, doc);
    if (!G.bboxValid(b)) return;
    var z = this.view.zoom;
    var sc = ent.scale || 1;
    /* si el patrón queda más denso que 2 px se aumenta la escala visible */
    var defs = CAD.HatchLib.defs(ent.pattern);
    if (!defs.length) return;
    var minDy = Infinity;
    defs.forEach(function (d) { minDy = Math.min(minDy, Math.abs(d.dy || 1)); });
    var eff = sc;
    if (minDy * sc * z < 2.2) eff = 2.2 / (minDy * z);
    var segs = CAD.HatchLib.segments(ent.pattern, b, ent.angle || 0, eff, ent.origin, 9000);
    if (!segs.length) return;
    ctx.strokeStyle = col;
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.beginPath();
    var self = this;
    for (var i = 0; i < segs.length; i++) {
      var a = self.w2s(segs[i][0]), c = self.w2s(segs[i][1]);
      if ((a.x < -50 && c.x < -50) || (a.x > self.W + 50 && c.x > self.W + 50)) continue;
      if ((a.y < -50 && c.y < -50) || (a.y > self.H + 50 && c.y > self.H + 50)) continue;
      ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y);
    }
    ctx.stroke();
  };

  /* ============================================================
     Adornos de interfaz
     ============================================================ */
  Renderer.prototype.drawGrips = function () {
    var ctx = this.ctx, app = this.app, doc = app.doc;
    var gs = doc.vars.GRIPSIZE || 5;
    ctx.save();
    ctx.setLineDash([]);
    var all = [];
    app.selSet.forEach(function (e) {
      E.grips(e, doc).forEach(function (g) { all.push({ p: g.p, k: g.k, e: e }); });
    });
    if (all.length > 800) { ctx.restore(); return; }
    var self = this;
    all.forEach(function (g) {
      var s = self.w2s(g.p);
      var hot = app.hotGrip && app.hotGrip.e === g.e && app.hotGrip.k === g.k;
      var hov = app.hoverGrip && app.hoverGrip.e === g.e && app.hoverGrip.k === g.k;
      ctx.fillStyle = hot ? THEME.gripHot : hov ? THEME.gripHover : THEME.grip;
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;
      ctx.fillRect(s.x - gs, s.y - gs, gs * 2, gs * 2);
      ctx.strokeRect(s.x - gs + .5, s.y - gs + .5, gs * 2 - 1, gs * 2 - 1);
    });
    ctx.restore();
  };

  Renderer.prototype.drawPickWindow = function (pb) {
    var ctx = this.ctx;
    var a = this.w2s(pb.p1), b = this.w2s(pb.p2);
    var x = Math.min(a.x, b.x), y = Math.min(a.y, b.y), w = Math.abs(b.x - a.x), h = Math.abs(b.y - a.y);
    ctx.save();
    if (pb.crossing) {
      ctx.fillStyle = THEME.selCross; ctx.strokeStyle = THEME.selCrossEdge; ctx.setLineDash([6, 4]);
    } else {
      ctx.fillStyle = THEME.selWindow; ctx.strokeStyle = THEME.selWindowEdge; ctx.setLineDash([]);
    }
    ctx.lineWidth = 1;
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x + .5, y + .5, w, h);
    ctx.restore();
  };

  Renderer.prototype.drawLasso = function (l) {
    var ctx = this.ctx, self = this;
    if (!l.pts || l.pts.length < 2) return;
    ctx.save();
    ctx.beginPath();
    l.pts.forEach(function (p, i) {
      var s = self.w2s(p);
      if (i) ctx.lineTo(s.x, s.y); else ctx.moveTo(s.x, s.y);
    });
    ctx.closePath();
    if (l.crossing) {
      ctx.fillStyle = THEME.selCross; ctx.strokeStyle = THEME.selCrossEdge; ctx.setLineDash([6, 4]);
    } else {
      ctx.fillStyle = THEME.selWindow; ctx.strokeStyle = THEME.selWindowEdge; ctx.setLineDash([]);
    }
    ctx.lineWidth = 1.2;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  };

  Renderer.prototype.drawRubber = function (r) {
    var ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = r.color || THEME.preview;
    ctx.lineWidth = 1;
    ctx.setLineDash(r.dash || [7, 5]);
    ctx.beginPath();
    if (r.type === 'line') {
      var a = this.w2s(r.p1), b = this.w2s(r.p2);
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    } else if (r.type === 'rect') {
      var c = this.w2s(r.p1), d = this.w2s(r.p2);
      ctx.rect(Math.min(c.x, d.x), Math.min(c.y, d.y), Math.abs(d.x - c.x), Math.abs(d.y - c.y));
    } else if (r.type === 'circle') {
      var e = this.w2s(r.c);
      ctx.arc(e.x, e.y, Math.max(0.1, r.r * this.view.zoom), 0, G.TAU);
    } else if (r.type === 'poly') {
      var self = this, first = true;
      r.pts.forEach(function (p) {
        var s = self.w2s(p);
        if (first) { ctx.moveTo(s.x, s.y); first = false; } else ctx.lineTo(s.x, s.y);
      });
      if (r.closed) ctx.closePath();
    }
    ctx.stroke();
    ctx.restore();
  };

  Renderer.prototype.drawTracking = function (lines) {
    var ctx = this.ctx, self = this;
    ctx.save();
    ctx.lineWidth = 1;
    lines.forEach(function (l) {
      ctx.setLineDash(l.dash || [5, 5]);
      ctx.strokeStyle = l.color || THEME.polar;
      ctx.beginPath();
      var a = self.w2s(l.p1), b = self.w2s(l.p2);
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      ctx.stroke();
    });
    ctx.restore();
  };

  var SNAP_LABEL = {
    end: 'Punto final', mid: 'Punto medio', cen: 'Centro', nod: 'Nodo', qua: 'Cuadrante',
    int: 'Intersección', ins: 'Inserción', per: 'Perpendicular', tan: 'Tangente',
    nea: 'Cercano', ext: 'Extensión', par: 'Paralelo', app: 'Intersección ficticia',
    geo: 'Centro geométrico', mtp: 'Punto medio entre 2'
  };
  CAD.SNAP_LABEL = SNAP_LABEL;

  Renderer.prototype.drawSnapMarker = function (h) {
    var ctx = this.ctx, p = this.w2s(h.p), r = 6;
    ctx.save();
    ctx.setLineDash([]);
    ctx.strokeStyle = THEME.snap;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    switch (h.type) {
      case 'end': ctx.rect(p.x - r, p.y - r, 2 * r, 2 * r); break;
      case 'mid': ctx.moveTo(p.x, p.y - r - 1); ctx.lineTo(p.x + r + 1, p.y + r); ctx.lineTo(p.x - r - 1, p.y + r); ctx.closePath(); break;
      case 'cen': case 'geo': ctx.arc(p.x, p.y, r, 0, G.TAU); break;
      case 'nod': ctx.arc(p.x, p.y, r, 0, G.TAU); ctx.moveTo(p.x - r, p.y - r); ctx.lineTo(p.x + r, p.y + r); ctx.moveTo(p.x - r, p.y + r); ctx.lineTo(p.x + r, p.y - r); break;
      case 'qua': ctx.moveTo(p.x, p.y - r - 1); ctx.lineTo(p.x + r + 1, p.y); ctx.lineTo(p.x, p.y + r + 1); ctx.lineTo(p.x - r - 1, p.y); ctx.closePath(); break;
      case 'int': case 'app':
        ctx.moveTo(p.x - r, p.y - r); ctx.lineTo(p.x + r, p.y + r);
        ctx.moveTo(p.x - r, p.y + r); ctx.lineTo(p.x + r, p.y - r); break;
      case 'ins':
        ctx.rect(p.x - r, p.y - r, r * 1.3, r * 1.3);
        ctx.rect(p.x - r * 0.3, p.y - r * 0.3, r * 1.3, r * 1.3); break;
      case 'per':
        ctx.moveTo(p.x - r, p.y - r); ctx.lineTo(p.x - r, p.y + r); ctx.lineTo(p.x + r, p.y + r);
        ctx.moveTo(p.x - r, p.y + 1); ctx.lineTo(p.x - 1, p.y + 1); ctx.lineTo(p.x - 1, p.y + r); break;
      case 'tan':
        ctx.arc(p.x, p.y + 2, r - 1, 0, G.TAU);
        ctx.moveTo(p.x - r, p.y - r + 1); ctx.lineTo(p.x + r, p.y - r + 1); break;
      case 'nea':
        ctx.moveTo(p.x - r, p.y - r); ctx.lineTo(p.x + r, p.y + r);
        ctx.moveTo(p.x - r, p.y + r); ctx.lineTo(p.x + r, p.y - r);
        ctx.moveTo(p.x - r, p.y + r); ctx.lineTo(p.x + r, p.y + r); break;
      default: ctx.rect(p.x - r, p.y - r, 2 * r, 2 * r);
    }
    ctx.stroke();
    ctx.restore();
  };

  Renderer.prototype.drawCrosshair = function () {
    var ctx = this.ctx, app = this.app;
    var p = app.cursorScreen;
    if (!p) return;
    var doc = app.doc;
    var pct = doc.vars.CURSORSIZE || 5;
    var half = pct >= 100 ? Math.max(this.W, this.H) : (Math.min(this.W, this.H) * pct) / 200;
    var pb = doc.vars.PICKBOX || 4;
    ctx.save();
    ctx.setLineDash([]);
    ctx.strokeStyle = app.paperMode ? '#202020' : THEME.cross;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.9;
    var x = Math.round(p.x) + 0.5, y = Math.round(p.y) + 0.5;
    var ua = app.paperMode && !app.activeVp ? 0 : (doc.vars.UCSANG || 0);
    ctx.beginPath();
    if (ua) {
      var c1 = Math.cos(-ua), s1 = Math.sin(-ua);
      ctx.moveTo(x - half * c1, y - half * s1); ctx.lineTo(x + half * c1, y + half * s1);
      ctx.moveTo(x + half * s1, y - half * c1); ctx.lineTo(x - half * s1, y + half * c1);
    } else {
      ctx.moveTo(x - half, y); ctx.lineTo(x + half, y);
      ctx.moveTo(x, y - half); ctx.lineTo(x, y + half);
    }
    ctx.stroke();
    if (app.showPickbox) {
      ctx.strokeStyle = app.paperMode ? '#303030' : THEME.pickbox;
      ctx.strokeRect(x - pb, y - pb, pb * 2, pb * 2);
    }
    if (app.aperture) {
      ctx.strokeStyle = 'rgba(255,255,255,.35)';
      var ap = doc.vars.APERTURE || 10;
      ctx.strokeRect(x - ap, y - ap, ap * 2, ap * 2);
    }
    ctx.restore();
  };

  Renderer.prototype.drawUCS = function () {
    var ctx = this.ctx, app = this.app, doc = app.doc;
    var L = 34;
    var ua = 0, org = null;
    if (!(app.paperMode && !app.activeVp)) {
      ua = doc.vars.UCSANG || 0;
      var so = this.w2s(doc.vars.UCSORG || { x: 0, y: 0 });
      if (so.x > 46 && so.x < this.W - 46 && so.y > 46 && so.y < this.H - 46) org = so;
    }
    var ox = org ? org.x : 62, oy = org ? org.y : this.H - 58;
    ctx.save();
    ctx.setLineDash([]);
    ctx.translate(ox, oy);
    if (ua) ctx.rotate(-ua);
    ctx.lineWidth = 1.7;
    ctx.strokeStyle = app.paperMode && !app.activeVp ? '#3a3f45' : (app.lightTheme ? '#333' : THEME.ucs);
    ctx.fillStyle = ctx.strokeStyle;
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(L, 0);
    ctx.moveTo(0, 0); ctx.lineTo(0, -L);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(L, 0); ctx.lineTo(L - 7, -3); ctx.lineTo(L - 7, 3); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, -L); ctx.lineTo(-3, -L + 7); ctx.lineTo(3, -L + 7); ctx.closePath(); ctx.fill();
    ctx.strokeRect(4.5, -9.5, 5, 5);
    ctx.font = '11px "Segoe UI", system-ui, sans-serif';
    ctx.save();
    if (ua) ctx.rotate(ua);
    ctx.fillText('X', L * Math.cos(-ua) + 5, L * Math.sin(-ua) + 4);
    ctx.fillText('Y', L * Math.sin(-ua) - 4, -L * Math.cos(-ua) - 5);
    ctx.restore();
    if (app.paperMode && !app.activeVp) {
      ctx.font = '10px "Segoe UI", system-ui, sans-serif';
      ctx.fillText('PAPEL', 2, 14);
    }
    ctx.restore();
  };
})();
