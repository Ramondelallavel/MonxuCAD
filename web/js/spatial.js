/* ============================================================
   spatial.js — Rendimiento: caché geométrica por entidad,
   índice espacial en rejilla y utilidades de nivel de detalle.

   La caché guarda el cuadro delimitador y la polilínea de
   visualización de cada objeto, de modo que encuadrar y hacer
   zoom no vuelven a calcular geometría. El índice permite tocar
   sólo los objetos que caen en la ventana o bajo el cursor.
   ============================================================ */
(function () {
  'use strict';
  var CAD = window.CAD, G = CAD.G, E = CAD.E;

  /* ============================================================
     Caché geométrica
     ============================================================ */
  var MAP = new WeakMap();
  var Cache = (CAD.Cache = {
    hits: 0, misses: 0,
    clear: function () { MAP = new WeakMap(); Cache.hits = 0; Cache.misses = 0; },
    drop: function (ent) { MAP.delete(ent); }
  });

  E.invalidate = function (ent) { MAP.delete(ent); };
  E.invalidateAll = function (list) {
    if (!list) { Cache.clear(); return; }
    for (var i = 0; i < list.length; i++) MAP.delete(list[i]);
  };

  var NOCACHE0 = { DIMENSION: 1, LEADER: 1 };
  function slot(ent) {
    var s = MAP.get(ent);
    if (!s) { s = {}; MAP.set(ent, s); }
    return s;
  }

  /* Cuadro delimitador con caché */
  E.bboxOf = function (ent, doc) {
    if (NOCACHE0[ent.type]) return E.extents(ent, doc);
    var s = slot(ent);
    if (s.bbox) { Cache.hits++; return s.bbox; }
    Cache.misses++;
    s.bbox = E.extents(ent, doc);
    return s.bbox;
  };

  /* Polilíneas de visualización con caché (q = 1 basta, 2 = fina) */
  var NOCACHE = { DIMENSION: 1, LEADER: 1, XLINE: 1, RAY: 1 };
  E.dispOf = function (ent, doc, q) {
    if (NOCACHE[ent.type]) return E.segs(ent, doc, q >= 2 ? 2 : 1);
    var s = slot(ent);
    var k = q >= 2 ? 'd2' : 'd1';
    if (s[k]) { Cache.hits++; return s[k]; }
    Cache.misses++;
    s[k] = E.segs(ent, doc, q >= 2 ? 2 : 1);
    return s[k];
  };

  /* Longitud de la diagonal del cuadro, para el nivel de detalle */
  E.sizeOf = function (ent, doc) {
    var b = E.bboxOf(ent, doc);
    if (!G.bboxValid(b)) return Infinity;
    return Math.hypot(b.x2 - b.x1, b.y2 - b.y1);
  };

  /* ============================================================
     Índice espacial en rejilla uniforme
     ============================================================ */
  function Index() {
    this.cells = null;
    this.cols = 0; this.rows = 0;
    this.x0 = 0; this.y0 = 0; this.cw = 1; this.ch = 1;
    this.list = null;
    this.unbounded = [];     /* líneas auxiliares, rayos, objetos sin bbox */
    this.stamp = -1;
    this.built = false;
  }
  CAD.Index = Index;

  Index.prototype.build = function (list, doc) {
    this.list = list;
    this.unbounded = [];
    this.built = true;
    var n = list.length;
    if (!n) { this.cells = null; return this; }
    var b = G.bboxNew();
    var boxes = new Array(n);
    for (var i = 0; i < n; i++) {
      var bb = E.bboxOf(list[i], doc);
      boxes[i] = bb;
      if (!G.bboxValid(bb)) { this.unbounded.push(list[i]); continue; }
      G.bboxMerge(b, bb);
    }
    if (!G.bboxValid(b)) { this.cells = null; return this; }
    /* ~48 objetos por celda */
    var target = Math.max(1, Math.ceil(n / 48));
    var side = Math.max(1, Math.min(256, Math.round(Math.sqrt(target))));
    var w = Math.max(1e-9, b.x2 - b.x1), h = Math.max(1e-9, b.y2 - b.y1);
    this.cols = side; this.rows = side;
    this.x0 = b.x1; this.y0 = b.y1;
    this.cw = w / side; this.ch = h / side;
    this.bbox = b;
    var cells = this.cells = new Array(side * side);
    for (var c = 0; c < cells.length; c++) cells[c] = null;
    for (var j = 0; j < n; j++) {
      var q = boxes[j];
      if (!G.bboxValid(q)) continue;
      var i0 = this.col(q.x1), i1 = this.col(q.x2);
      var j0 = this.row(q.y1), j1 = this.row(q.y2);
      /* un objeto que cubre más de un cuarto de la rejilla va a la lista global */
      if ((i1 - i0 + 1) * (j1 - j0 + 1) > cells.length / 4) { this.unbounded.push(list[j]); continue; }
      for (var yy = j0; yy <= j1; yy++) {
        for (var xx = i0; xx <= i1; xx++) {
          var idx = yy * this.cols + xx;
          if (!cells[idx]) cells[idx] = [];
          cells[idx].push(list[j]);
        }
      }
    }
    return this;
  };

  Index.prototype.col = function (x) { return Math.max(0, Math.min(this.cols - 1, Math.floor((x - this.x0) / this.cw))); };
  Index.prototype.row = function (y) { return Math.max(0, Math.min(this.rows - 1, Math.floor((y - this.y0) / this.ch))); };

  /* Objetos candidatos dentro de un rectángulo del dibujo */
  Index.prototype.query = function (box, out) {
    out = out || [];
    if (!this.built) return out;
    if (!this.cells) {
      var l = this.list || [];
      for (var i = 0; i < l.length; i++) out.push(l[i]);
      return out;
    }
    for (var u = 0; u < this.unbounded.length; u++) out.push(this.unbounded[u]);
    if (box.x2 < this.bbox.x1 || box.x1 > this.bbox.x2 ||
        box.y2 < this.bbox.y1 || box.y1 > this.bbox.y2) return out;
    var i0 = this.col(box.x1), i1 = this.col(box.x2);
    var j0 = this.row(box.y1), j1 = this.row(box.y2);
    var seen = this._seen || (this._seen = new Set());
    seen.clear();
    for (var yy = j0; yy <= j1; yy++) {
      var base = yy * this.cols;
      for (var xx = i0; xx <= i1; xx++) {
        var cell = this.cells[base + xx];
        if (!cell) continue;
        for (var k = 0; k < cell.length; k++) {
          var e = cell[k];
          if (seen.has(e)) continue;
          seen.add(e);
          out.push(e);
        }
      }
    }
    return out;
  };

  /* ============================================================
     Índices vivos del documento
     ============================================================ */
  var IDXS = new Map();

  CAD.indexFor = function (doc, list, key) {
    var rec = IDXS.get(key);
    if (rec && rec.rev === doc.rev && rec.count === list.length && rec.list === list) return rec.idx;
    rec = { idx: new Index().build(list, doc), rev: doc.rev, count: list.length, list: list };
    IDXS.set(key, rec);
    if (IDXS.size > 8) { var first = IDXS.keys().next().value; IDXS.delete(first); }
    return rec.idx;
  };
  CAD.dropIndex = function () { IDXS.clear(); };

  function ordered(doc, arr, ref) {
    if (arr.length < 2) return arr;
    var order = doc._order;
    if (!order || doc._orderRev !== doc.rev || doc._orderRef !== ref) {
      order = doc._order = new Map();
      for (var i = 0; i < ref.length; i++) order.set(ref[i], i);
      doc._orderRev = doc.rev;
      doc._orderRef = ref;
    }
    arr.sort(function (a, b) { return (order.get(a) || 0) - (order.get(b) || 0); });
    return arr;
  }

  /* Objetos visibles del espacio activo dentro del rectángulo dado */
  function pick(doc, list, key, box) {
    if (list.length < 500) return list;
    var idx = CAD.indexFor(doc, list, key);
    if (!idx.cells || !idx.bbox) return list;
    /* si la ventana abarca todo el dibujo no hay nada que filtrar */
    if (box.x1 <= idx.bbox.x1 && box.y1 <= idx.bbox.y1 &&
        box.x2 >= idx.bbox.x2 && box.y2 >= idx.bbox.y2) return list;
    var out = idx.query(box, []);
    if (out.length > list.length * 0.72) return list;
    return ordered(doc, out, list);
  }

  CAD.queryVisible = function (app, box) {
    var doc = app.doc;
    var key = (doc.inPaper() ? 'P' : 'M') + (app.layoutIndex === undefined ? 0 : app.layoutIndex);
    return pick(doc, doc.visible(), key, box);
  };

  /* Objetos del espacio modelo dentro del rectángulo (ventanas gráficas) */
  CAD.queryModel = function (doc, list, box) {
    return pick(doc, list, 'VP' + list.length, box);
  };
})();
