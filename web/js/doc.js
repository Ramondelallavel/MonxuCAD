/* ============================================================
   doc.js — Base de datos del dibujo
   Entidades, capas, bloques, estilos de texto y cota, variables
   de sistema y pila de deshacer/rehacer.
   ============================================================ */
(function () {
  'use strict';
  var CAD = (window.CAD = window.CAD || {});
  var G = CAD.G;
  var E = (CAD.E = {});

  /* ---------- Utilidades ---------- */
  var deep = (typeof structuredClone === 'function')
    ? function (o) { return structuredClone(o); }
    : function (o) { return JSON.parse(JSON.stringify(o)); };
  E.deep = deep;

  /* ============================================================
     Documento
     ============================================================ */
  function Doc() {
    this.name = 'Dibujo1';
    this.entities = [];
    this.layers = {};
    this.layerOrder = [];
    this.blocks = {};          // name -> {name, base:{x,y}, entities:[]}
    this.ltypes = {};
    this.textStyles = {};
    this.dimStyles = {};
    this.nextId = 1;
    this.anonBlockCount = 0;
    this._space = null;              /* array activo: modelo o presentación */
    this.layouts = [
      { name: 'Presentación1', w: 420, h: 297, margin: 10, entities: [], viewports: [] },
      { name: 'Presentación2', w: 297, h: 210, margin: 10, entities: [], viewports: [] }
    ];
    this.groups = {};
    this.undoStack = [];
    this.redoStack = [];
    this.dirty = false;
    this.rev = 0;            /* cambia con cada alta o baja: invalida índices */
    this._tx = null;         /* transacción de deshacer en curso */
    this.vars = {
      CLAYER: '0', CECOLOR: 256, CELTYPE: 'ByLayer', CELWEIGHT: -1, CETRANSPARENCY: 0,
      LTSCALE: 1, CELTSCALE: 1, TEXTSIZE: 2.5, TEXTSTYLE: 'Standard',
      DIMSTYLE: 'ISO-25', DIMSCALE: 1,
      OSMODE: 1 + 2 + 4 + 16 + 32 + 64 + 512, ORTHOMODE: 0, SNAPMODE: 0, GRIDMODE: 1,
      POLARMODE: 1, POLARANG: 45, OTRACK: 1,
      SNAPUNIT: 10, GRIDUNIT: 10, GRIDMAJOR: 5,
      LUNITS: 2, LUPREC: 4, AUNITS: 0, AUPREC: 2, INSUNITS: 4,
      PDMODE: 0, PDSIZE: 0, FILLMODE: 1, LWDISPLAY: 0, BLIPMODE: 0,
      PICKBOX: 4, APERTURE: 10, GRIPSIZE: 5, CURSORSIZE: 5, DYNMODE: 1,
      LIMMIN: { x: 0, y: 0 }, LIMMAX: { x: 420, y: 297 }, LIMCHECK: 0,
      UCSORG: { x: 0, y: 0 }, UCSANG: 0, ANGBASE: 0, ANGDIR: 0,
      SELECTIONCYCLING: 1, TRIMEXTENDMODE: 2, DYNPICOORDS: 0, MIRRTEXT: 0, CANNOSCALE: '1:1', HPNAME: 'ANSI31', HPSCALE: 1, HPANG: 0
    };
    this.init();
  }
  CAD.Doc = Doc;

  Doc.prototype.init = function () {
    this.addLayer({ name: '0', color: 7, ltype: 'CONTINUOUS', lw: -3 });
    this.addLayer({ name: 'Defpoints', color: 7, ltype: 'CONTINUOUS', lw: -3, plot: false });
    var self = this;
    Object.keys(G.LTYPES).forEach(function (n) {
      self.ltypes[n] = { name: n, desc: G.LTYPES[n].desc, pat: G.LTYPES[n].pat.slice() };
    });
    this.textStyles.Standard = { name: 'Standard', font: 'txt.shx', bigfont: '', h: 0, wfac: 1, oblique: 0, css: 'AcadStick' };
    this.textStyles.Annotative = { name: 'Annotative', font: 'txt.shx', bigfont: '', h: 0, wfac: 1, oblique: 0, css: 'AcadStick' };
    this.textStyles.Arial = { name: 'Arial', font: 'arial.ttf', bigfont: '', h: 0, wfac: 1, oblique: 0, css: 'Arial' };
    this.dimStyles['ISO-25'] = defaultDimStyle('ISO-25');
    this.dimStyles.Standard = defaultDimStyle('Standard');
  };

  function defaultDimStyle(name) {
    return {
      name: name,
      DIMASZ: 2.5,      // tamaño de flecha
      DIMTXT: 2.5,      // altura de texto
      DIMEXE: 1.25,     // extensión de línea de extensión
      DIMEXO: 0.625,    // desfase de origen
      DIMGAP: 0.625,    // hueco alrededor del texto
      DIMDLI: 3.75,     // incremento entre líneas base
      DIMTAD: 1,        // 0 centrado, 1 encima
      DIMJUST: 0,
      DIMTIH: 0, DIMTOH: 0,
      DIMDEC: 2, DIMADEC: 0,
      DIMLFAC: 1, DIMSCALE: 1,
      DIMCLRD: 256, DIMCLRE: 256, DIMCLRT: 256,
      DIMBLK: 'ClosedFilled',
      DIMTXSTY: 'Standard',
      DIMPOST: '', DIMZIN: 8, DIMRND: 0,
      DIMSE1: 0, DIMSE2: 0, DIMSD1: 0, DIMSD2: 0,
      DIMTOFL: 1, DIMATFIT: 3, DIMTMOVE: 0,
      DIMTOL: 0, DIMLIM: 0, DIMTP: 0.1, DIMTM: 0.1, DIMTDEC: 2, DIMTFAC: 0.7,
      DIMALT: 0, DIMALTF: 0.0393701, DIMALTD: 3, DIMAPOST: ''
    };
  }
  E.defaultDimStyle = defaultDimStyle;

  /* ---------- Capas ---------- */
  Doc.prototype.addLayer = function (o) {
    var l = Object.assign({
      name: 'Capa1', on: true, frozen: false, locked: false, plot: true,
      color: 7, ltype: 'CONTINUOUS', lw: -3, transparency: 0, desc: ''
    }, o);
    if (!this.layers[l.name]) this.layerOrder.push(l.name);
    this.layers[l.name] = l;
    return l;
  };
  Doc.prototype.layer = function (n) { return this.layers[n] || this.layers['0']; };
  Doc.prototype.layerList = function () {
    var self = this;
    return this.layerOrder.slice().sort(function (a, b) {
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    }).map(function (n) { return self.layers[n]; });
  };
  Doc.prototype.deleteLayer = function (n) {
    if (n === '0' || n === 'Defpoints') return 'No se puede eliminar esta capa.';
    if (n === this.vars.CLAYER) return 'No se puede eliminar la capa actual.';
    var used = this.entities.some(function (e) { return e.layer === n; });
    if (used) return 'La capa contiene objetos y no se puede eliminar.';
    delete this.layers[n];
    this.layerOrder = this.layerOrder.filter(function (x) { return x !== n; });
    return null;
  };

  /* ---------- Espacio activo (modelo / presentación) ---------- */
  Doc.prototype.ents = function () { return this._space || this.entities; };
  Doc.prototype.setSpace = function (arr) { this._space = (arr === this.entities) ? null : (arr || null); };
  Doc.prototype.inPaper = function () { return !!this._space; };

  /* ---------- Entidades ---------- */
  Doc.prototype.newId = function () { return this.nextId++; };

  Doc.prototype.add = function (ent) {
    if (!ent.id) ent.id = this.newId();
    if (ent.layer === undefined) ent.layer = this.vars.CLAYER;
    if (ent.color === undefined) ent.color = this.vars.CECOLOR;
    if (ent.ltype === undefined) ent.ltype = this.vars.CELTYPE;
    if (ent.lw === undefined) ent.lw = this.vars.CELWEIGHT;
    if (ent.ltscale === undefined) ent.ltscale = this.vars.CELTSCALE;
    var arr = this.ents();
    arr.push(ent);
    if (this._tx) this._tx.ops.push({ k: 'a', arr: arr, e: ent, i: arr.length - 1 });
    this.dirty = true;
    this.rev++;
    return ent;
  };
  Doc.prototype.addAll = function (arr) { var s = this; arr.forEach(function (e) { s.add(e); }); return arr; };
  Doc.prototype.remove = function (ent) {
    var lists = [this.ents(), this.entities];
    this.layouts.forEach(function (l) { lists.push(l.entities); });
    for (var k = 0; k < lists.length; k++) {
      var i = lists[k].indexOf(ent);
      if (i >= 0) {
        lists[k].splice(i, 1);
        if (this._tx) this._tx.ops.push({ k: 'r', arr: lists[k], e: ent, i: i });
        this.dirty = true;
        this.rev++;
        return;
      }
    }
  };

  /* Declara que un objeto va a modificarse en el sitio.
     Guarda su estado anterior una sola vez por transacción. */
  Doc.prototype.touch = function (ent) {
    if (ent && E.invalidate) E.invalidate(ent);
    if (!this._tx || !ent) return ent;
    if (!this._tx.mods.has(ent)) this._tx.mods.set(ent, deep(ent));
    this.dirty = true;
    return ent;
  };
  Doc.prototype.touchAll = function (list) {
    if (!list) return list;
    for (var i = 0; i < list.length; i++) this.touch(list[i]);
    return list;
  };
  Doc.prototype.removeAll = function (arr) { var s = this; arr.slice().forEach(function (e) { s.remove(e); }); };
  Doc.prototype.byId = function (id) {
    var e = this.ents();
    for (var i = 0; i < e.length; i++) if (e[i].id === id) return e[i];
    for (var j = 0; j < this.entities.length; j++) if (this.entities[j].id === id) return this.entities[j];
    return null;
  };

  /* Entidades visibles (capa encendida y no congelada) */
  /* Firma del estado de capas: cambia al encender, congelar o bloquear */
  Doc.prototype.layerSig = function () {
    var s = '', o = this.layerOrder, L = this.layers;
    for (var i = 0; i < o.length; i++) {
      var l = L[o[i]];
      if (!l) continue;
      s += (l.on ? 1 : 0) + (l.frozen ? 2 : 0) + (l.locked ? 4 : 0) + ',';
    }
    return s;
  };

  /* La lista de visibles se reutiliza mientras nada cambie: los índices
     espaciales dependen de que su identidad se mantenga. */
  Doc.prototype.visible = function () {
    var arr = this.ents();
    var sig = this.rev + '|' + this.layerSig();
    if (this._visCache && this._visSig === sig && this._visSrc === arr) return this._visCache;
    var out = [], L = this.layers, def = L['0'];
    for (var i = 0; i < arr.length; i++) {
      var e = arr[i];
      if (e.hidden) continue;
      var l = L[e.layer] || def;
      if (!l.on || l.frozen) continue;
      out.push(e);
    }
    this._visCache = out;
    this._visSig = sig;
    this._visSrc = arr;
    return out;
  };

  Doc.prototype.selectable = function () {
    var arr = this.visible();
    var sig = this.rev + '|' + this.layerSig();
    if (this._selCache && this._selSig === sig && this._selSrc === arr) return this._selCache;
    var out = [], L = this.layers;
    for (var i = 0; i < arr.length; i++) {
      var l = L[arr[i].layer];
      if (l && l.locked) continue;
      out.push(arr[i]);
    }
    this._selCache = out;
    this._selSig = sig;
    this._selSrc = arr;
    return out;
  };

  /* ---------- Deshacer / Rehacer por registro de cambios ----------
     Sólo se clona lo que cambia: las tablas del dibujo (pequeñas) y
     los objetos que se tocan. Un documento de cien mil entidades ya
     no se copia entero en cada comando. */
  Doc.prototype.metaSnapshot = function () {
    return {
      layers: deep(this.layers),
      layerOrder: this.layerOrder.slice(),
      blocks: deep(this.blocks),
      ltypes: deep(this.ltypes),
      textStyles: deep(this.textStyles),
      dimStyles: deep(this.dimStyles),
      groups: deep(this.groups),
      vars: deep(this.vars),
      nextId: this.nextId,
      layouts: this.layouts.map(function (l) {
        return { name: l.name, w: l.w, h: l.h, margin: l.margin, viewports: deep(l.viewports) };
      })
    };
  };
  Doc.prototype.metaRestore = function (m) {
    if (!m) return;
    this.layers = deep(m.layers);
    this.layerOrder = m.layerOrder.slice();
    this.blocks = deep(m.blocks);
    this.ltypes = deep(m.ltypes);
    this.textStyles = deep(m.textStyles);
    this.dimStyles = deep(m.dimStyles);
    this.groups = deep(m.groups);
    this.vars = deep(m.vars);
    this.nextId = m.nextId;
    var self = this;
    m.layouts.forEach(function (l, i) {
      var t = self.layouts[i];
      if (!t) return;
      t.name = l.name; t.w = l.w; t.h = l.h; t.margin = l.margin;
      t.viewports = deep(l.viewports);
    });
  };

  Doc.prototype.snapshot = function () {
    return {
      entities: deep(this.entities),
      layers: deep(this.layers),
      layerOrder: this.layerOrder.slice(),
      blocks: deep(this.blocks),
      ltypes: deep(this.ltypes),
      textStyles: deep(this.textStyles),
      dimStyles: deep(this.dimStyles),
      layouts: deep(this.layouts),
      groups: deep(this.groups),
      vars: deep(this.vars),
      nextId: this.nextId
    };
  };
  Doc.prototype.restore = function (s) {
    this.entities = deep(s.entities);
    this.layers = deep(s.layers);
    this.layerOrder = s.layerOrder.slice();
    this.blocks = deep(s.blocks);
    this.ltypes = deep(s.ltypes);
    this.textStyles = deep(s.textStyles);
    this.dimStyles = deep(s.dimStyles);
    this.vars = deep(s.vars);
    this.nextId = s.nextId;
    if (s.layouts) {
      var spaceIdx = -1;
      for (var li = 0; li < this.layouts.length; li++) if (this.layouts[li].entities === this._space) spaceIdx = li;
      this.layouts = deep(s.layouts);
      this._space = spaceIdx >= 0 && this.layouts[spaceIdx] ? this.layouts[spaceIdx].entities : null;
    }
    if (s.groups) this.groups = deep(s.groups);
  };
  Doc.prototype.mark = function (label) {
    this.commitTx();
    this._tx = { label: label || '', ops: [], mods: new Map(), meta: this.metaSnapshot() };
    this.redoStack.length = 0;
    /* captura automática: lo que el comando ya tiene designado o ha
       señalado hasta ahora es lo que puede modificar en el sitio */
    var app = CAD.APP;
    if (app) {
      if (app.selSet && app.selSet.length) this.touchAll(app.selSet);
      if (app.activeCtx && app.activeCtx._seen && app.activeCtx._seen.length) this.touchAll(app.activeCtx._seen);
    }
    return this._tx;
  };

  /* Abandona la transacción en curso sin registrarla (el comando no hizo nada) */
  Doc.prototype.discardTx = function () { this._tx = null; };

  Doc.prototype.commitTx = function () {
    var tx = this._tx;
    this._tx = null;
    if (!tx) return null;
    if (!tx.ops.length && !tx.mods.size && !metaDiffers(tx.meta, this)) return null;
    this.undoStack.push(tx);
    if (this.undoStack.length > 120) this.undoStack.shift();
    return tx;
  };

  function metaDiffers(m, doc) {
    if (!m) return false;
    if (m.nextId !== doc.nextId) return true;
    if (m.layerOrder.length !== doc.layerOrder.length) return true;
    var a = JSON.stringify(m.vars), b = JSON.stringify(doc.vars);
    if (a !== b) return true;
    if (Object.keys(m.blocks).length !== Object.keys(doc.blocks).length) return true;
    if (Object.keys(m.layers).length !== Object.keys(doc.layers).length) return true;
    if (JSON.stringify(m.layers) !== JSON.stringify(doc.layers)) return true;
    if (JSON.stringify(m.groups) !== JSON.stringify(doc.groups)) return true;
    if (JSON.stringify(m.dimStyles) !== JSON.stringify(doc.dimStyles)) return true;
    if (JSON.stringify(m.textStyles) !== JSON.stringify(doc.textStyles)) return true;
    for (var i = 0; i < m.layouts.length; i++) {
      var t = doc.layouts[i];
      if (!t) return true;
      if (m.layouts[i].name !== t.name || m.layouts[i].w !== t.w || m.layouts[i].h !== t.h) return true;
      if (JSON.stringify(m.layouts[i].viewports) !== JSON.stringify(t.viewports)) return true;
    }
    return false;
  }

  /* Invierte una transacción y devuelve la inversa (para rehacer) */
  Doc.prototype.applyInverse = function (tx) {
    var inv = { label: tx.label, ops: [], mods: new Map(), meta: this.metaSnapshot() };
    /* objetos modificados: se guarda el estado actual y se restaura el anterior */
    tx.mods.forEach(function (before, ent) {
      inv.mods.set(ent, deep(ent));
      Object.keys(ent).forEach(function (k) { if (!(k in before)) delete ent[k]; });
      Object.keys(before).forEach(function (k) { ent[k] = before[k]; });
      if (E.invalidate) E.invalidate(ent);
    });
    /* operaciones estructurales, en orden inverso */
    for (var i = tx.ops.length - 1; i >= 0; i--) {
      var op = tx.ops[i];
      if (op.k === 'a') {
        var j = op.arr.indexOf(op.e);
        if (j >= 0) op.arr.splice(j, 1);
        inv.ops.push({ k: 'r', arr: op.arr, e: op.e, i: op.i });
      } else {
        op.arr.splice(Math.min(op.i, op.arr.length), 0, op.e);
        inv.ops.push({ k: 'a', arr: op.arr, e: op.e, i: op.i });
      }
    }
    this.metaRestore(tx.meta);
    this.rev++;
    this.dirty = true;
    if (E.invalidateAll) E.invalidateAll();
    return inv;
  };

  Doc.prototype.undo = function () {
    this.commitTx();
    if (!this.undoStack.length) return null;
    var tx = this.undoStack.pop();
    var inv = this.applyInverse(tx);
    this.redoStack.push(inv);
    return tx.label;
  };

  Doc.prototype.redo = function () {
    this.commitTx();
    if (!this.redoStack.length) return null;
    var tx = this.redoStack.pop();
    var inv = this.applyInverse(tx);
    this.undoStack.push(inv);
    return tx.label;
  };

  /* ============================================================
     Constructores de entidades
     ============================================================ */
  function base(type, o) {
    return Object.assign({ id: 0, type: type, color: undefined, layer: undefined, ltype: undefined, lw: undefined }, o);
  }
  E.line = function (p1, p2, o) { return base('LINE', Object.assign({ p1: G.clone(p1), p2: G.clone(p2) }, o)); };
  E.xline = function (p, d, o) { return base('XLINE', Object.assign({ p: G.clone(p), d: G.norm(d) }, o)); };
  E.ray = function (p, d, o) { return base('RAY', Object.assign({ p: G.clone(p), d: G.norm(d) }, o)); };
  E.circle = function (c, r, o) { return base('CIRCLE', Object.assign({ c: G.clone(c), r: r }, o)); };
  E.arc = function (c, r, a0, a1, o) { return base('ARC', Object.assign({ c: G.clone(c), r: r, a0: a0, a1: a1 }, o)); };
  E.pline = function (verts, closed, o) {
    return base('LWPOLYLINE', Object.assign({
      verts: verts.map(function (v) { return { x: v.x, y: v.y, b: v.b || 0, sw: v.sw || 0, ew: v.ew || 0 }; }),
      closed: !!closed, width: 0, elev: 0
    }, o));
  };
  E.point = function (p, o) { return base('POINT', Object.assign({ p: G.clone(p) }, o)); };
  E.ellipse = function (c, maj, ratio, t0, t1, o) {
    return base('ELLIPSE', Object.assign({ c: G.clone(c), maj: G.clone(maj), ratio: ratio, t0: t0 === undefined ? 0 : t0, t1: t1 === undefined ? G.TAU : t1 }, o));
  };
  E.text = function (p, h, s, rot, o) {
    return base('TEXT', Object.assign({
      p: G.clone(p), h: h, text: s, rot: rot || 0, style: 'Standard',
      halign: 0, valign: 0, p2: null, wfac: 1, oblique: 0
    }, o));
  };
  E.mtext = function (p, h, s, width, o) {
    return base('MTEXT', Object.assign({
      p: G.clone(p), h: h, text: s, width: width || 0, rot: 0, style: 'Standard',
      attach: 1, lineSpace: 1.0
    }, o));
  };
  E.insert = function (name, p, o) {
    return base('INSERT', Object.assign({ name: name, p: G.clone(p), sx: 1, sy: 1, rot: 0, attribs: [] }, o));
  };
  E.solid = function (pts, o) { return base('SOLID', Object.assign({ pts: pts.map(G.clone) }, o)); };
  E.hatch = function (loops, o) {
    return base('HATCH', Object.assign({
      loops: loops, pattern: 'ANSI31', angle: 0, scale: 1, solid: false,
      origin: { x: 0, y: 0 }, assoc: [], transparency: 0
    }, o));
  };
  E.spline = function (fit, closed, o) {
    return base('SPLINE', Object.assign({ fit: fit.map(G.clone), ctrl: [], degree: 3, closed: !!closed }, o));
  };
  E.dim = function (kind, o) {
    return base('DIMENSION', Object.assign({
      kind: kind, style: 'ISO-25', textOverride: '', textPos: null, measurement: 0, rot: 0
    }, o));
  };
  E.attdef = function (p, h, tag, prompt, def, o) {
    return base('ATTDEF', Object.assign({
      p: G.clone(p), h: h, tag: String(tag || 'ETIQUETA').toUpperCase(),
      prompt: prompt || '', def: def === undefined ? '' : def, text: String(tag || 'ETIQUETA').toUpperCase(),
      rot: 0, style: 'Standard', halign: 0, valign: 0, p2: null, wfac: 1, oblique: 0, flags: 0
    }, o));
  };
  E.attrib = function (p, h, tag, value, o) {
    return base('ATTRIB', Object.assign({
      p: G.clone(p), h: h, tag: String(tag || '').toUpperCase(), text: value === undefined ? '' : String(value),
      rot: 0, style: 'Standard', halign: 0, valign: 0, p2: null, wfac: 1, oblique: 0, flags: 0
    }, o));
  };
  E.leader = function (pts, text, o) {
    return base('LEADER', Object.assign({ pts: pts.map(G.clone), text: text || '', style: 'ISO-25', h: 2.5 }, o));
  };

  /* ============================================================
     Descomposición en polilíneas (hit-test, snap, área, export)
     ============================================================ */
  var CURVE_SEGS = 64;

  E.segs = function (ent, doc, quality) {
    var q = quality || 1;
    switch (ent.type) {
      case 'LINE': return [{ pts: [ent.p1, ent.p2], closed: false }];
      case 'XLINE': {
        var big = 1e6;
        return [{ pts: [G.polar(ent.p, Math.atan2(ent.d.y, ent.d.x), -big), G.polar(ent.p, Math.atan2(ent.d.y, ent.d.x), big)], closed: false }];
      }
      case 'RAY': {
        var b2 = 1e6;
        return [{ pts: [ent.p, G.polar(ent.p, Math.atan2(ent.d.y, ent.d.x), b2)], closed: false }];
      }
      case 'CIRCLE': return [{ pts: G.arcPts(ent.c, ent.r, 0, G.TAU, true, Math.round(CURVE_SEGS * q)).slice(0, -1), closed: true }];
      case 'ARC': return [{ pts: G.arcPts(ent.c, ent.r, ent.a0, ent.a1, true, Math.max(8, Math.round((G.sweep(ent.a0, ent.a1) / G.TAU) * CURVE_SEGS * q))), closed: false }];
      case 'ELLIPSE': {
        var closed = Math.abs((ent.t1 - ent.t0) - G.TAU) < 1e-6;
        var pts = G.ellPts(ent.c, ent.maj.x, ent.maj.y, ent.ratio, ent.t0, ent.t1, Math.round(CURVE_SEGS * q * 1.5));
        if (closed) pts = pts.slice(0, -1);
        return [{ pts: pts, closed: closed }];
      }
      case 'LWPOLYLINE': return [{ pts: E.plinePts(ent, q), closed: ent.closed }];
      case 'SPLINE': return [{ pts: E.splinePts(ent), closed: ent.closed }];
      case 'POINT': return [{ pts: [ent.p], closed: false }];
      case 'SOLID': return [{ pts: ent.pts.slice(), closed: true }];
      case 'HATCH': return ent.loops.map(function (l) { return { pts: l, closed: true }; });
      case 'TEXT': case 'MTEXT': case 'ATTDEF': case 'ATTRIB': {
        var b = E.extents(ent, doc);
        if (!G.bboxValid(b)) return [];
        return [{ pts: [{ x: b.x1, y: b.y1 }, { x: b.x2, y: b.y1 }, { x: b.x2, y: b.y2 }, { x: b.x1, y: b.y2 }], closed: true }];
      }
      case 'INSERT': {
        var out = [];
        E.insertChildren(ent, doc).forEach(function (c) { out = out.concat(E.segs(c, doc, q)); });
        return out;
      }
      case 'DIMENSION': case 'LEADER': {
        var geo = CAD.Dim ? CAD.Dim.build(ent, doc) : null;
        if (!geo) return [];
        var o2 = [];
        geo.lines.forEach(function (l) { o2.push({ pts: [l[0], l[1]], closed: false }); });
        geo.arcs.forEach(function (a) { o2.push({ pts: G.arcPts(a.c, a.r, a.a0, a.a1, true), closed: false }); });
        geo.solids.forEach(function (s) { o2.push({ pts: s, closed: true }); });
        return o2;
      }
      default: return [];
    }
  };

  /* Puntos de una polilínea desarrollando los bulges */
  E.plinePts = function (ent, q) {
    var out = [], v = ent.verts, n = v.length;
    if (!n) return out;
    var last = ent.closed ? n : n - 1;
    for (var i = 0; i < last; i++) {
      var a = v[i], b = v[(i + 1) % n];
      out.push({ x: a.x, y: a.y });
      if (a.b) {
        var arc = G.bulgeArc(a, b, a.b);
        if (arc) {
          var seg = Math.max(4, Math.ceil((Math.abs(arc.inc) / G.TAU) * CURVE_SEGS * (q || 1)));
          var pts = G.arcPts(arc.c, arc.r, arc.a0, arc.a1, arc.ccw, seg);
          for (var k = 1; k < pts.length - 1; k++) out.push(pts[k]);
        }
      }
    }
    if (!ent.closed) out.push({ x: v[n - 1].x, y: v[n - 1].y });
    return out;
  };

  /* Spline por Catmull-Rom sobre puntos de ajuste */
  E.splinePts = function (ent) {
    var f = ent.fit && ent.fit.length ? ent.fit : ent.ctrl;
    if (!f || f.length < 2) return f ? f.slice() : [];
    if (f.length === 2) return f.slice();
    var pts = f.slice();
    if (ent.closed) pts = [f[f.length - 1]].concat(f, [f[0], f[1]]);
    else pts = [f[0]].concat(f, [f[f.length - 1]]);
    var out = [], steps = 16;
    for (var i = 1; i < pts.length - 2; i++) {
      var p0 = pts[i - 1], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2];
      for (var j = 0; j < steps; j++) {
        var t = j / steps, t2 = t * t, t3 = t2 * t;
        out.push({
          x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
          y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
        });
      }
    }
    out.push(pts[pts.length - 2]);
    return out;
  };

  /* Hijos de una inserción de bloque, ya transformados */
  E.insertChildren = function (ent, doc) {
    var blk = doc.blocks[ent.name];
    if (!blk) return [];
    var m = G.mMul(G.mMul(G.mTrans(-blk.base.x, -blk.base.y), G.mScale(ent.sx, ent.sy)), G.mMul(G.mRot(ent.rot), G.mTrans(ent.p.x, ent.p.y)));
    var src = blk.entities.filter(function (c) { return c.type !== 'ATTDEF'; });
    if (ent.attribs && ent.attribs.length) src = src.concat(ent.attribs);
    return src.map(function (c) {
      var n = deep(c);
      E.transform(n, m, doc);
      if (n.color === 256 || n.color === undefined) n.color = ent.color;
      if (n.color === 0) n.color = ent.color === 256 ? 256 : ent.color;
      if (n.layer === '0') n.layer = ent.layer;
      if (n.ltype === 'ByBlock' || n.ltype === 'ByLayer') n.ltype = ent.ltype;
      n.__inBlock = true;
      return n;
    });
  };

  /* ============================================================
     Extensión (bounding box)
     ============================================================ */
  E.extents = function (ent, doc) {
    var b = G.bboxNew();
    switch (ent.type) {
      case 'LINE': G.bboxAdd(b, ent.p1); G.bboxAdd(b, ent.p2); return b;
      case 'CIRCLE': return { x1: ent.c.x - ent.r, y1: ent.c.y - ent.r, x2: ent.c.x + ent.r, y2: ent.c.y + ent.r };
      case 'ARC': return G.bboxArc(ent.c, ent.r, ent.a0, ent.a1, true);
      case 'POINT': return { x1: ent.p.x, y1: ent.p.y, x2: ent.p.x, y2: ent.p.y };
      case 'XLINE': case 'RAY': return G.bboxNew();
      case 'TEXT': case 'ATTDEF': case 'ATTRIB': {
        var w = E.textWidth(ent, doc), h = ent.h;
        var o = E.textOrigin(ent, w, h);
        var c = Math.cos(ent.rot), s = Math.sin(ent.rot);
        [[0, 0], [w, 0], [w, h], [0, h]].forEach(function (p) {
          G.bboxAdd(b, { x: o.x + p[0] * c - p[1] * s, y: o.y + p[0] * s + p[1] * c });
        });
        return b;
      }
      case 'MTEXT': {
        var mt = E.mtextLayout(ent, doc);
        var c2 = Math.cos(ent.rot), s2 = Math.sin(ent.rot);
        [[0, 0], [mt.w, 0], [mt.w, -mt.h], [0, -mt.h]].forEach(function (p) {
          G.bboxAdd(b, { x: mt.o.x + p[0] * c2 - p[1] * s2, y: mt.o.y + p[0] * s2 + p[1] * c2 });
        });
        return b;
      }
      default: {
        E.segs(ent, doc, 1).forEach(function (s3) { s3.pts.forEach(function (p) { G.bboxAdd(b, p); }); });
        return b;
      }
    }
  };

  E.extentsAll = function (list, doc) {
    var b = G.bboxNew();
    var f = E.bboxOf || E.extents;
    for (var i = 0; i < list.length; i++) G.bboxMerge(b, f(list[i], doc));
    return b;
  };

  /* ============================================================
     Texto: métricas aproximadas (sin canvas)
     ============================================================ */
  E.textWidth = function (ent, doc) {
    var st = (doc && doc.textStyles[ent.style]) || { wfac: 1 };
    var f = (ent.wfac || 1) * (st.wfac || 1);
    return ent.text.length * ent.h * 0.62 * f;
  };
  E.textOrigin = function (ent, w, h) {
    var x = ent.p.x, y = ent.p.y;
    var ha = ent.halign || 0, va = ent.valign || 0;
    if (ha === 1 || ha === 4) x -= w / 2; else if (ha === 2) x -= w;
    if (va === 1) y -= h * 0.25;   // base inferior aprox
    else if (va === 2) y -= h / 2;
    else if (va === 3) y -= h;
    var c = Math.cos(ent.rot), s = Math.sin(ent.rot);
    var dx = x - ent.p.x, dy = y - ent.p.y;
    return { x: ent.p.x + dx * c - dy * s, y: ent.p.y + dx * s + dy * c };
  };
  E.mtextLines = function (ent) {
    var raw = String(ent.text || '').replace(/\\P/g, '\n').replace(/\\[A-Za-z][^;\\]*;/g, '');
    return raw.split('\n');
  };
  E.mtextLayout = function (ent, doc) {
    var lines = E.mtextLines(ent);
    var maxw = 0;
    lines.forEach(function (l) { maxw = Math.max(maxw, l.length * ent.h * 0.62); });
    var w = ent.width > 0 ? ent.width : maxw;
    var lh = ent.h * 1.4 * (ent.lineSpace || 1);
    var h = lines.length * lh;
    var o = { x: ent.p.x, y: ent.p.y };
    var att = ent.attach || 1;
    var col = (att - 1) % 3, row = Math.floor((att - 1) / 3);
    if (col === 1) o.x -= w / 2; else if (col === 2) o.x -= w;
    if (row === 1) o.y += h / 2; else if (row === 2) o.y += h;
    return { o: o, w: w, h: h, lh: lh, lines: lines };
  };

  /* ============================================================
     Transformaciones
     ============================================================ */
  E.transform = function (ent, m, doc) {
    if (doc && doc.touch) doc.touch(ent); else if (E.invalidate) E.invalidate(ent);
    var sf = G.mScaleFactor(m), rot = G.mRotation(m), mir = G.mIsMirror(m);
    switch (ent.type) {
      case 'LINE': ent.p1 = G.mApply(m, ent.p1); ent.p2 = G.mApply(m, ent.p2); break;
      case 'XLINE': case 'RAY': ent.p = G.mApply(m, ent.p); ent.d = G.norm(G.mApplyVec(m, ent.d)); break;
      case 'POINT': ent.p = G.mApply(m, ent.p); break;
      case 'CIRCLE': ent.c = G.mApply(m, ent.c); ent.r *= sf; break;
      case 'ARC': {
        var p0 = G.polar(ent.c, ent.a0, ent.r), p1 = G.polar(ent.c, ent.a1, ent.r);
        ent.c = G.mApply(m, ent.c); ent.r *= sf;
        var q0 = G.mApply(m, p0), q1 = G.mApply(m, p1);
        if (mir) { ent.a0 = G.ang(ent.c, q1); ent.a1 = G.ang(ent.c, q0); }
        else { ent.a0 = G.ang(ent.c, q0); ent.a1 = G.ang(ent.c, q1); }
        break;
      }
      case 'ELLIPSE': {
        ent.c = G.mApply(m, ent.c);
        var mj = G.mApplyVec(m, ent.maj);
        var mn = G.mApplyVec(m, { x: -ent.maj.y * ent.ratio, y: ent.maj.x * ent.ratio });
        ent.maj = mj;
        ent.ratio = Math.min(1, G.len(mn) / (G.len(mj) || 1));
        if (mir) { var t = ent.t0; ent.t0 = -ent.t1; ent.t1 = -t; }
        break;
      }
      case 'LWPOLYLINE':
        ent.verts = ent.verts.map(function (v) {
          var p = G.mApply(m, v);
          return { x: p.x, y: p.y, b: mir ? -v.b : v.b, sw: (v.sw || 0) * sf, ew: (v.ew || 0) * sf };
        });
        if (mir) {
          // al reflejar, el bulge pasa al vértice correcto
          var bl = ent.verts.map(function (v) { return v.b; });
          for (var i = 0; i < ent.verts.length; i++) ent.verts[i].b = bl[i];
        }
        ent.width = (ent.width || 0) * sf;
        break;
      case 'SPLINE':
        ent.fit = ent.fit.map(function (p) { return G.mApply(m, p); });
        ent.ctrl = (ent.ctrl || []).map(function (p) { return G.mApply(m, p); });
        break;
      case 'SOLID': ent.pts = ent.pts.map(function (p) { return G.mApply(m, p); }); break;
      case 'TEXT': case 'ATTDEF': case 'ATTRIB':
        ent.p = G.mApply(m, ent.p);
        if (ent.p2) ent.p2 = G.mApply(m, ent.p2);
        ent.h *= sf;
        ent.rot = mir ? E.mirrorTextRot(ent.rot, m, doc) : ent.rot + rot;
        break;
      case 'MTEXT':
        ent.p = G.mApply(m, ent.p); ent.h *= sf; ent.width *= sf;
        ent.rot = mir ? E.mirrorTextRot(ent.rot, m, doc) : ent.rot + rot;
        break;
      case 'INSERT':
        ent.p = G.mApply(m, ent.p); ent.sx *= mir ? -sf : sf; ent.sy *= sf; ent.rot += rot;
        break;
      case 'HATCH':
        ent.loops = ent.loops.map(function (l) { return l.map(function (p) { return G.mApply(m, p); }); });
        ent.scale *= sf; ent.angle += rot;
        break;
      case 'DIMENSION':
        ['p1', 'p2', 'p3', 'p4', 'center', 'textPos'].forEach(function (k) {
          if (ent[k]) ent[k] = G.mApply(m, ent[k]);
        });
        if (ent.rot !== undefined) ent.rot += rot;
        break;
      case 'LEADER':
        ent.pts = ent.pts.map(function (p) { return G.mApply(m, p); });
        ent.h *= sf;
        break;
    }
    return ent;
  };

  /* Rotación de un texto al reflejarlo.
     MIRRTEXT = 0 (por defecto): el texto sigue leyéndose del derecho.
     MIRRTEXT = 1: el texto se refleja como el resto de la geometría. */
  E.mirrorTextRot = function (rot, m, doc) {
    var d = G.mApplyVec(m, { x: Math.cos(rot), y: Math.sin(rot) });
    var a = Math.atan2(d.y, d.x);
    if (!(doc && doc.vars && doc.vars.MIRRTEXT)) {
      var n = G.na(a);
      if (n > Math.PI / 2 + 1e-9 && n < 1.5 * Math.PI - 1e-9) a = n - Math.PI;
      else a = n;
    }
    return a;
  };

  E.move = function (ent, dx, dy, doc) { return E.transform(ent, G.mTrans(dx, dy), doc); };
  E.copyEnt = function (ent) { var n = deep(ent); n.id = 0; return n; };

  /* ============================================================
     Puntos de referencia a objetos (OSNAP) y pinzamientos (grips)
     ============================================================ */
  E.snapPoints = function (ent, doc) {
    var out = [];
    function push(t, p) { if (p && isFinite(p.x) && isFinite(p.y)) out.push({ type: t, p: p, ent: ent }); }
    switch (ent.type) {
      case 'LINE':
        push('end', ent.p1); push('end', ent.p2); push('mid', G.mid(ent.p1, ent.p2));
        break;
      case 'CIRCLE':
        push('cen', ent.c);
        for (var q = 0; q < 4; q++) push('qua', G.polar(ent.c, (q * Math.PI) / 2, ent.r));
        break;
      case 'ARC':
        push('cen', ent.c);
        push('end', G.polar(ent.c, ent.a0, ent.r));
        push('end', G.polar(ent.c, ent.a1, ent.r));
        push('mid', G.polar(ent.c, ent.a0 + G.sweep(ent.a0, ent.a1) / 2, ent.r));
        for (var q2 = 0; q2 < 4; q2++) {
          var a = (q2 * Math.PI) / 2;
          if (G.inArc(a, ent.a0, ent.a1)) push('qua', G.polar(ent.c, a, ent.r));
        }
        break;
      case 'ELLIPSE':
        push('cen', ent.c);
        [0, Math.PI / 2, Math.PI, 1.5 * Math.PI].forEach(function (t) {
          push('qua', G.ellPt(ent.c, ent.maj.x, ent.maj.y, ent.ratio, t));
        });
        break;
      case 'POINT': push('nod', ent.p); break;
      case 'LWPOLYLINE': {
        var v = ent.verts, n = v.length;
        for (var i = 0; i < n; i++) {
          push('end', { x: v[i].x, y: v[i].y });
          var nx = v[(i + 1) % n];
          if (i === n - 1 && !ent.closed) break;
          if (v[i].b) {
            var arc = G.bulgeArc(v[i], nx, v[i].b);
            if (arc) { push('cen', arc.c); push('mid', G.polar(arc.c, arc.a0 + (arc.ccw ? 1 : -1) * G.sweep(arc.ccw ? arc.a0 : arc.a1, arc.ccw ? arc.a1 : arc.a0) / 2, arc.r)); }
          } else push('mid', G.mid(v[i], nx));
        }
        break;
      }
      case 'SOLID': ent.pts.forEach(function (p) { push('end', p); }); break;
      case 'TEXT': case 'ATTDEF': case 'ATTRIB': push('ins', ent.p); break;
      case 'MTEXT': push('ins', ent.p); break;
      case 'INSERT':
        push('ins', ent.p);
        E.insertChildren(ent, doc).forEach(function (c) {
          E.snapPoints(c, doc).forEach(function (s) { s.ent = ent; out.push(s); });
        });
        break;
      case 'SPLINE': (ent.fit || []).forEach(function (p) { push('end', p); }); break;
      case 'HATCH': break;
      case 'DIMENSION':
        ['p1', 'p2', 'p3', 'center'].forEach(function (k) { if (ent[k]) push('end', ent[k]); });
        break;
      case 'LEADER': ent.pts.forEach(function (p) { push('end', p); }); break;
    }
    return out;
  };

  /* Pinzamientos editables */
  E.grips = function (ent, doc) {
    var g = [];
    switch (ent.type) {
      case 'LINE': g.push({ p: ent.p1, k: 'p1' }, { p: G.mid(ent.p1, ent.p2), k: 'mid' }, { p: ent.p2, k: 'p2' }); break;
      case 'CIRCLE':
        g.push({ p: ent.c, k: 'c' });
        for (var q = 0; q < 4; q++) g.push({ p: G.polar(ent.c, (q * Math.PI) / 2, ent.r), k: 'r' + q });
        break;
      case 'ARC':
        g.push({ p: ent.c, k: 'c' },
          { p: G.polar(ent.c, ent.a0, ent.r), k: 'a0' },
          { p: G.polar(ent.c, ent.a1, ent.r), k: 'a1' },
          { p: G.polar(ent.c, ent.a0 + G.sweep(ent.a0, ent.a1) / 2, ent.r), k: 'am' });
        break;
      case 'LWPOLYLINE': ent.verts.forEach(function (v, i) { g.push({ p: { x: v.x, y: v.y }, k: 'v' + i }); }); break;
      case 'ELLIPSE':
        g.push({ p: ent.c, k: 'c' },
          { p: G.add(ent.c, ent.maj), k: 'maj' },
          { p: G.sub(ent.c, ent.maj), k: 'maj2' },
          { p: G.add(ent.c, { x: -ent.maj.y * ent.ratio, y: ent.maj.x * ent.ratio }), k: 'min' });
        break;
      case 'POINT': g.push({ p: ent.p, k: 'p' }); break;
      case 'TEXT': case 'MTEXT': case 'ATTDEF': case 'ATTRIB': g.push({ p: ent.p, k: 'p' }); break;
      case 'INSERT': g.push({ p: ent.p, k: 'p' }); break;
      case 'SOLID': ent.pts.forEach(function (p, i) { g.push({ p: p, k: 'p' + i }); }); break;
      case 'SPLINE': (ent.fit || []).forEach(function (p, i) { g.push({ p: p, k: 'f' + i }); }); break;
      case 'LEADER': ent.pts.forEach(function (p, i) { g.push({ p: p, k: 'p' + i }); }); break;
      case 'DIMENSION':
        ['p1', 'p2', 'p3', 'center'].forEach(function (k) { if (ent[k]) g.push({ p: ent[k], k: k }); });
        if (ent.textPos) g.push({ p: ent.textPos, k: 'textPos' });
        break;
      case 'HATCH': {
        var b = E.extents(ent, doc);
        if (G.bboxValid(b)) g.push({ p: { x: (b.x1 + b.x2) / 2, y: (b.y1 + b.y2) / 2 }, k: 'ctr' });
        break;
      }
    }
    return g;
  };

  /* Mover un pinzamiento concreto */
  E.moveGrip = function (ent, key, np, doc) {
    if (doc && doc.touch) doc.touch(ent); else if (E.invalidate) E.invalidate(ent);
    switch (ent.type) {
      case 'LINE':
        if (key === 'p1') ent.p1 = G.clone(np);
        else if (key === 'p2') ent.p2 = G.clone(np);
        else { var d = G.sub(np, G.mid(ent.p1, ent.p2)); ent.p1 = G.add(ent.p1, d); ent.p2 = G.add(ent.p2, d); }
        break;
      case 'CIRCLE':
        if (key === 'c') ent.c = G.clone(np); else ent.r = Math.max(1e-6, G.dist(ent.c, np));
        break;
      case 'ARC':
        if (key === 'c') ent.c = G.clone(np);
        else if (key === 'a0') { ent.a0 = G.ang(ent.c, np); }
        else if (key === 'a1') { ent.a1 = G.ang(ent.c, np); }
        else ent.r = Math.max(1e-6, G.dist(ent.c, np));
        break;
      case 'LWPOLYLINE': {
        var i = parseInt(key.slice(1), 10);
        if (ent.verts[i]) { ent.verts[i].x = np.x; ent.verts[i].y = np.y; }
        break;
      }
      case 'ELLIPSE':
        if (key === 'c') ent.c = G.clone(np);
        else if (key === 'maj') ent.maj = G.sub(np, ent.c);
        else if (key === 'maj2') ent.maj = G.sub(ent.c, np);
        else ent.ratio = Math.min(1, G.dist(ent.c, np) / (G.len(ent.maj) || 1));
        break;
      case 'POINT': case 'TEXT': case 'MTEXT': case 'ATTDEF': case 'ATTRIB': case 'INSERT': ent.p = G.clone(np); break;
      case 'SOLID': ent.pts[parseInt(key.slice(1), 10)] = G.clone(np); break;
      case 'SPLINE': ent.fit[parseInt(key.slice(1), 10)] = G.clone(np); break;
      case 'LEADER': ent.pts[parseInt(key.slice(1), 10)] = G.clone(np); break;
      case 'DIMENSION': ent[key] = G.clone(np); break;
      case 'HATCH': {
        var b = E.extents(ent, doc), c = { x: (b.x1 + b.x2) / 2, y: (b.y1 + b.y2) / 2 };
        E.transform(ent, G.mTrans(np.x - c.x, np.y - c.y), doc);
        break;
      }
    }
  };

  /* ============================================================
     Pruebas de selección
     ============================================================ */
  E.hit = function (ent, p, tol, doc) {
    if (ent.type === 'HATCH' && (ent.solid || ent.pattern === 'SOLID')) {
      for (var li = 0; li < ent.loops.length; li++) if (G.ptInPoly(p, ent.loops[li])) return true;
    }
    if (ent.type === 'SOLID') return G.ptInPoly(p, ent.pts);
    if (ent.type === 'TEXT' || ent.type === 'MTEXT' || ent.type === 'ATTDEF' || ent.type === 'ATTRIB') {
      var b = E.extents(ent, doc);
      return p.x >= b.x1 - tol && p.x <= b.x2 + tol && p.y >= b.y1 - tol && p.y <= b.y2 + tol;
    }
    var ss = E.segs(ent, doc, 1);
    for (var i = 0; i < ss.length; i++) {
      var pts = ss[i].pts, n = pts.length;
      if (n === 1) { if (G.dist(p, pts[0]) <= tol) return true; continue; }
      var last = ss[i].closed ? n : n - 1;
      for (var j = 0; j < last; j++) {
        if (G.distToSeg(p, pts[j], pts[(j + 1) % n]) <= tol) return true;
      }
    }
    return false;
  };

  E.hitBox = function (ent, box, crossing, doc) {
    var b = E.extents(ent, doc);
    if (!crossing) return G.bboxValid(b) && G.bboxIn(box, b);
    if (G.bboxValid(b) && G.bboxIn(box, b)) return true;
    if (G.bboxValid(b) && !G.bboxHit(box, b)) return false;
    var ss = E.segs(ent, doc, 1);
    for (var i = 0; i < ss.length; i++) {
      var pts = ss[i].pts, n = pts.length;
      if (n === 1) return pts[0].x >= box.x1 && pts[0].x <= box.x2 && pts[0].y >= box.y1 && pts[0].y <= box.y2;
      var last = ss[i].closed ? n : n - 1;
      for (var j = 0; j < last; j++) if (G.segHitBox(pts[j], pts[(j + 1) % n], box)) return true;
    }
    return false;
  };

  /* ============================================================
     Propiedades efectivas (resolución ByLayer / ByBlock)
     ============================================================ */
  E.effColor = function (ent, doc) {
    var c = ent.color;
    if (c === undefined || c === 256 || c === 'ByLayer') return doc.layer(ent.layer).color;
    if (c === 0 || c === 'ByBlock') return 7;
    return c;
  };
  E.effLtype = function (ent, doc) {
    var t = ent.ltype;
    if (!t || t === 'ByLayer' || t === 'BYLAYER') return doc.layer(ent.layer).ltype;
    if (t === 'ByBlock' || t === 'BYBLOCK') return 'CONTINUOUS';
    return t;
  };
  E.effLw = function (ent, doc) {
    var w = ent.lw;
    if (w === undefined || w === -1) w = doc.layer(ent.layer).lw;
    if (w === -3 || w === -2) w = 25;
    return w;
  };

  /* ============================================================
     Descripción legible (comando LIST)
     ============================================================ */
  E.describe = function (ent, doc) {
    var L = [];
    var names = {
      LINE: 'LÍNEA', LWPOLYLINE: 'POLILÍNEA', CIRCLE: 'CÍRCULO', ARC: 'ARCO',
      ELLIPSE: 'ELIPSE', POINT: 'PUNTO', TEXT: 'TEXTO', MTEXT: 'TEXTOM',
      INSERT: 'REFERENCIA A BLOQUE', HATCH: 'SOMBREADO', SOLID: 'SÓLIDO',
      SPLINE: 'SPLINE', DIMENSION: 'COTA', LEADER: 'DIRECTRIZ', XLINE: 'LÍNEA AUX', RAY: 'RAYO',
      ATTDEF: 'DEFINICIÓN DE ATRIBUTO', ATTRIB: 'ATRIBUTO'
    };
    L.push((names[ent.type] || ent.type) + '   Capa: ' + ent.layer);
    L.push('        Identificador = ' + ent.id);
    var col = ent.color === 256 ? 'POR CAPA' : ent.color === 0 ? 'POR BLOQUE' : String(ent.color);
    L.push('        Color: ' + col + '     Tipo de línea: ' + (ent.ltype || 'ByLayer'));
    var f = function (v) { return G.fmt(v, doc.vars.LUPREC); };
    switch (ent.type) {
      case 'LINE':
        L.push('   desde punto, X=' + f(ent.p1.x) + '  Y=' + f(ent.p1.y));
        L.push('     a punto, X=' + f(ent.p2.x) + '  Y=' + f(ent.p2.y));
        L.push('       Longitud = ' + f(G.dist(ent.p1, ent.p2)) + ',  Ángulo en plano XY = ' + G.fmt(G.deg(G.na(G.ang(ent.p1, ent.p2))), 2));
        L.push('       Delta X = ' + f(ent.p2.x - ent.p1.x) + ',  Delta Y = ' + f(ent.p2.y - ent.p1.y));
        break;
      case 'CIRCLE':
        L.push('       centro, X=' + f(ent.c.x) + '  Y=' + f(ent.c.y));
        L.push('       radio ' + f(ent.r));
        L.push('       circunferencia ' + f(2 * Math.PI * ent.r));
        L.push('       área ' + f(Math.PI * ent.r * ent.r));
        break;
      case 'ARC':
        L.push('       centro, X=' + f(ent.c.x) + '  Y=' + f(ent.c.y));
        L.push('       radio ' + f(ent.r));
        L.push('       ángulo inicial ' + G.fmt(G.deg(G.na(ent.a0)), 2));
        L.push('       ángulo final ' + G.fmt(G.deg(G.na(ent.a1)), 2));
        L.push('       longitud de arco ' + f(ent.r * G.sweep(ent.a0, ent.a1)));
        break;
      case 'LWPOLYLINE': {
        var pts = E.plinePts(ent, 2);
        L.push('       ' + (ent.closed ? 'Cerrada' : 'Abierta'));
        L.push('       ' + ent.verts.length + ' vértices');
        L.push('       longitud ' + f(G.polyLen(pts, ent.closed)));
        if (ent.closed) L.push('       área ' + f(Math.abs(G.polyArea(pts))));
        break;
      }
      case 'TEXT': case 'MTEXT': case 'ATTDEF': case 'ATTRIB':
        L.push('       punto de inserción, X=' + f(ent.p.x) + '  Y=' + f(ent.p.y));
        L.push('       altura ' + f(ent.h));
        L.push('       texto "' + ent.text + '"');
        L.push('       estilo ' + ent.style);
        break;
      case 'INSERT':
        L.push('       nombre de bloque "' + ent.name + '"');
        L.push('       punto, X=' + f(ent.p.x) + '  Y=' + f(ent.p.y));
        L.push('       factores de escala X=' + f(ent.sx) + '  Y=' + f(ent.sy));
        L.push('       ángulo de rotación ' + G.fmt(G.deg(ent.rot), 2));
        break;
      case 'HATCH':
        L.push('       patrón ' + ent.pattern + (ent.solid ? ' (sólido)' : ''));
        L.push('       escala ' + f(ent.scale) + '  ángulo ' + G.fmt(G.deg(ent.angle), 2));
        var ar = 0;
        ent.loops.forEach(function (l, i) { ar += (i === 0 ? 1 : -1) * Math.abs(G.polyArea(l)); });
        L.push('       área ' + f(Math.abs(ar)));
        break;
      case 'DIMENSION':
        L.push('       tipo ' + ent.kind);
        L.push('       medida ' + f(ent.measurement));
        L.push('       estilo de cota ' + ent.style);
        break;
    }
    return L;
  };
})();
