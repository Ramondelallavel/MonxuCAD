/* ============================================================
   cmd.js — Motor de comandos
   Registro, alias, peticiones asíncronas (punto, distancia,
   ángulo, cadena, palabra clave, designación de objetos).
   ============================================================ */
(function () {
  'use strict';
  var CAD = (window.CAD = window.CAD || {});
  var G = CAD.G, E = CAD.E;

  var CANCEL = CAD.CANCEL = { cancel: true, toString: function () { return '*Cancelado*'; } };

  /* ============================================================
     Registro de comandos
     ============================================================ */
  var Cmd = CAD.Cmd = {
    reg: {},        /* NOMBRE -> def */
    alias: {},      /* ALIAS -> NOMBRE */
    order: []
  };

  Cmd.add = function (names, opts, fn) {
    if (typeof opts === 'function') { fn = opts; opts = {}; }
    var list = Array.isArray(names) ? names : [names];
    var main = list[0].toUpperCase();
    var def = Object.assign({ name: main, fn: fn, group: 'otros', names: list.map(function (s) { return s.toUpperCase(); }) }, opts);
    Cmd.reg[main] = def;
    Cmd.order.push(main);
    list.forEach(function (nm) { Cmd.alias[nm.toUpperCase()] = main; });
    (opts.aliases || []).forEach(function (a) { Cmd.alias[a.toUpperCase()] = main; });
    return def;
  };

  Cmd.find = function (txt) {
    if (!txt) return null;
    var t = String(txt).trim().toUpperCase().replace(/^[-_'"]+/, '');
    if (!t) return null;
    if (Cmd.alias[t]) return Cmd.reg[Cmd.alias[t]];
    return null;
  };

  Cmd.suggest = function (txt) {
    var t = String(txt).trim().toUpperCase().replace(/^[-_']+/, '');
    if (!t) return [];
    var seen = {}, out = [];
    Object.keys(Cmd.alias).forEach(function (a) {
      if (a.indexOf(t) === 0 && !seen[a]) {
        seen[a] = 1;
        out.push({ alias: a, cmd: Cmd.alias[a], def: Cmd.reg[Cmd.alias[a]] });
      }
    });
    out.sort(function (a, b) {
      if (a.alias.length !== b.alias.length) return a.alias.length - b.alias.length;
      return a.alias.localeCompare(b.alias);
    });
    return out.slice(0, 12);
  };

  /* ============================================================
     Análisis de entrada
     ============================================================ */
  function num(s) {
    s = String(s).trim().replace(',', '.');
    if (!/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(s)) return NaN;
    return parseFloat(s);
  }
  CAD.num = num;

  /* Devuelve {p} | {dist} | null */
  CAD.parsePoint = function (txt, app, base, dir) {
    var s = String(txt).trim();
    if (!s) return null;
    var rel = false, wcs = false;
    if (s[0] === '@') { rel = true; s = s.slice(1); }
    if (s[0] === '*') { wcs = true; s = s.slice(1); }
    var last = base || app.lastPoint || { x: 0, y: 0 };
    var doc = app.doc;
    var ucs = (CAD.UCS && doc && !wcs) ? CAD.UCS : null;
    var ub = (ucs && !app.ignoreUCS) ? (doc.vars.UCSANG || 0) : 0;

    /* polar: d<a */
    var m = s.match(/^([-+0-9.,eE]+)\s*<\s*([-+0-9.,eE]+)$/);
    if (m) {
      var d = num(m[1]), a = num(m[2]);
      if (isNaN(d) || isNaN(a)) return null;
      var o = rel ? last : (ucs && !app.ignoreUCS ? ucs.u2w(doc, { x: 0, y: 0 }) : { x: 0, y: 0 });
      return { p: G.polar(o, G.rad(a) + ub, d) };
    }
    /* cartesiano x,y */
    var parts = s.split(/[;]|,(?=\s*[-+.\d])/);
    if (parts.length >= 2) {
      var x = num(parts[0]), y = num(parts[1]);
      if (!isNaN(x) && !isNaN(y)) {
        if (rel) {
          var v = (ucs && !app.ignoreUCS) ? ucs.vec2w(doc, { x: x, y: y }) : { x: x, y: y };
          return { p: { x: last.x + v.x, y: last.y + v.y } };
        }
        return { p: (ucs && !app.ignoreUCS) ? ucs.u2w(doc, { x: x, y: y }) : { x: x, y: y } };
      }
    }
    /* distancia directa */
    var dd = num(s);
    if (!isNaN(dd)) return { dist: dd };
    return null;
  };

  function kwShort(k) {
    var up = k.replace(/[^A-ZÁÉÍÓÚÑ]/g, '');
    return up || k[0].toUpperCase();
  }
  CAD.kwShort = kwShort;

  function matchKeyword(txt, kws) {
    if (!kws || !kws.length) return null;
    var t = String(txt).trim().toUpperCase();
    if (!t) return null;
    for (var i = 0; i < kws.length; i++) {
      if (kwShort(kws[i]).toUpperCase() === t) return kws[i];
    }
    for (var j = 0; j < kws.length; j++) {
      var full = kws[j].toUpperCase().replace(/[^A-ZÁÉÍÓÚÑ0-9]/g, '');
      if (full === t || full.indexOf(t) === 0) return kws[j];
    }
    return null;
  }
  CAD.matchKeyword = matchKeyword;

  /* ============================================================
     Contexto de comando
     ============================================================ */
  function Ctx(app, def) {
    this.app = app;
    this.doc = app.doc;
    this.def = def;
    this.name = def ? def.name : '';
    this._seen = [];
  }

  /* Todo objeto que el motor entrega al comando queda anotado: si ya hay
     transacción abierta se guarda su estado, y si no, se guardará al abrirla. */
  Ctx.prototype._see = function (list) {
    if (!list) return list;
    var arr = Array.isArray(list) ? list : [list];
    if (this.doc._tx) this.doc.touchAll(arr);
    else {
      for (var i = 0; i < arr.length; i++) {
        if (arr[i] && this._seen.indexOf(arr[i]) < 0) this._seen.push(arr[i]);
      }
    }
    return list;
  };
  CAD.Ctx = Ctx;

  Ctx.prototype.out = function (s, cls) { this.app.out(s, cls); };
  Ctx.prototype.err = function (s) { this.app.out(s, 'err'); };

  function buildPrompt(msg, opts) {
    var s = msg;
    if (opts && opts.keywords && opts.keywords.length) s += ' [' + opts.keywords.join('/') + ']';
    if (opts && opts.def !== undefined && opts.def !== null && opts.def !== '') s += ' <' + opts.def + '>';
    return s + ': ';
  }

  Ctx.prototype._ask = function (kind, msg, opts) {
    var app = this.app;
    opts = opts || {};
    return new Promise(function (resolve, reject) {
      app.pending = {
        kind: kind, msg: msg, opts: opts, resolve: resolve, reject: reject,
        text: buildPrompt(msg, opts)
      };
      app.setPrompt(app.pending.text);
      app.refresh();
    });
  };

  /* --- Punto --- */
  Ctx.prototype.getPoint = function (msg, opts) {
    opts = opts || {};
    return this._ask('point', msg, opts);
  };
  /* --- Esquina (segundo punto de un rectángulo) --- */
  Ctx.prototype.getCorner = function (msg, base, opts) {
    opts = Object.assign({ base: base, rubber: 'rect' }, opts || {});
    return this._ask('point', msg, opts);
  };
  /* --- Cadena --- */
  Ctx.prototype.getString = function (msg, opts) { return this._ask('string', msg, opts || {}); };
  /* --- Número --- */
  Ctx.prototype.getReal = function (msg, opts) { return this._ask('real', msg, opts || {}); };
  Ctx.prototype.getInt = function (msg, opts) { return this._ask('int', msg, opts || {}); };
  /* --- Distancia (número o dos puntos) --- */
  Ctx.prototype.getDist = function (msg, opts) { return this._ask('dist', msg, opts || {}); };
  /* --- Ángulo --- */
  Ctx.prototype.getAngle = function (msg, opts) { return this._ask('angle', msg, opts || {}); };
  /* --- Palabra clave --- */
  Ctx.prototype.getKeyword = function (msg, kws, opts) {
    return this._ask('keyword', msg, Object.assign({ keywords: kws }, opts || {}));
  };
  /* --- Designación de objetos --- */
  Ctx.prototype.getSelection = function (msg, opts) {
    opts = opts || {};
    var app = this.app;
    var self = this;
    if (!opts.force && app.selSet.length) {
      var s = app.selSet.slice();
      this.out(s.length + ' encontrado(s)');
      return Promise.resolve(this._see(s));
    }
    return this._ask('select', msg || 'Designe objetos', opts).then(function (r) { return self._see(r); });
  };
  /* --- Un solo objeto --- */
  Ctx.prototype.getEntity = function (msg, opts) {
    var self = this;
    return this._ask('entity', msg, opts || {}).then(function (r) {
      if (r && r.ent) self._see([r.ent]);
      return r;
    });
  };

  Ctx.prototype.setPreview = function (arr) { this.app.preview = arr || []; this.app.refresh(); };
  Ctx.prototype.setRubber = function (r) { this.app.rubber = r; this.app.refresh(); };

  /* ============================================================
     Métodos del motor (se mezclan en App.prototype)
     ============================================================ */
  var Engine = CAD.Engine = {};

  Engine.out = function (s, cls) {
    if (this.ui && this.ui.log) this.ui.log(s, cls);
  };
  Engine.setPrompt = function (s) {
    this.promptText = s;
    if (this.ui && this.ui.setPrompt) this.ui.setPrompt(s);
  };

  Engine.exec = function (line) {
    var app = this;
    var txt = String(line || '').trim();
    if (!txt) return;
    if (this.pending) { this.feedText(txt); return; }
    var def = Cmd.find(txt);
    if (!def) {
      /* ¿es una variable de sistema? */
      var vn = txt.toUpperCase();
      if (app.doc.vars[vn] !== undefined) { app.startCommand('SETVAR', [vn]); return; }
      this.out('Comando: ' + txt, 'echo');
      this.out('Comando desconocido "' + txt.toUpperCase() + '". Pulse F1 para consultar la ayuda.', 'err');
      this.setPrompt('Comando: ');
      return;
    }
    this.startCommand(def.name);
  };

  Engine.startCommand = function (name, args) {
    var app = this;
    var def = Cmd.reg[name.toUpperCase()] || Cmd.find(name);
    if (!def) { this.out('Comando desconocido "' + name + '"', 'err'); return; }

    if (this.pending && def.transparent) {
      /* comando transparente: se ejecuta sin interrumpir */
      var savedPending = this.pending;
      var savedPrompt = this.promptText;
      this.out("'" + def.name, 'echo');
      var c2 = new Ctx(this, def);
      Promise.resolve(def.fn(c2, args || [])).catch(function () { }).then(function () {
        app.pending = savedPending;
        app.setPrompt(savedPrompt);
        app.refresh();
      });
      return;
    }
    if (this.pending) this.cancel(true);

    this.out(def.name, 'echo');
    this.lastCommand = def.name;
    this.cmdSeq = (this.cmdSeq || 0) + 1;
    var mySeq = this.cmdSeq;
    this.activeCmd = def;
    this.cmdStartSel = this.selSet.slice();
    var ctx = new Ctx(this, def);
    this.activeCtx = ctx;
    if (this.ui && this.ui.setActiveCommand) this.ui.setActiveCommand(def.name);

    Promise.resolve()
      .then(function () { return def.fn(ctx, args || []); })
      .then(function (r) {
        app.finishCommand(mySeq);
        if (r && r.msg) app.out(r.msg);
      })
      .catch(function (e) {
        if (e === CANCEL || (e && e.cancel)) app.out('*Cancelado*', 'warn');
        else { app.out('Error en ' + def.name + ': ' + (e && e.message ? e.message : e), 'err'); if (e && e.stack) console.error(e); }
        app.finishCommand(mySeq);
      });
  };

  Engine.finishCommand = function (seq) {
    /* si entretanto se inició otro comando, no se toca su estado */
    if (seq !== undefined && seq !== this.cmdSeq) return;
    if (this.doc && this.doc.commitTx) this.doc.commitTx();
    this.pending = null;
    this.activeCmd = null;
    this.activeCtx = null;
    this.preview = [];
    this.rubber = null;
    this.trackLines = null;
    this.trackLabel = null;
    this.osnapOverride = null;
    if (CAD.Track) CAD.Track.clear();
    this.setPrompt('Comando: ');
    if (this.ui && this.ui.setActiveCommand) this.ui.setActiveCommand('');
    this.refresh();
    if (this.multipleCmd) {
      var nm = this.multipleCmd, self = this;
      setTimeout(function () { if (self.multipleCmd === nm && !self.pending) self.startCommand(nm); }, 0);
    }
  };

  Engine.cancel = function (silent) {
    this.mtpCollect = null;
    this.osnapOverride = null;
    this.multipleCmd = null;
    if (this.pending) {
      var rj = this.pending.reject;
      this.pending = null;
      rj(CANCEL);
    } else if (this.selSet.length) {
      this.selSet = [];
      this.refresh();
    }
    if (!silent) this.setPrompt('Comando: ');
  };

  /* ---------- Entrada de texto ---------- */
  Engine.feedText = function (txt) {
    var p = this.pending;
    if (!p) { this.exec(txt); return; }
    var t = String(txt);
    this.out(p.text + t, 'echo');

    /* palabras clave */
    var kw = matchKeyword(t, p.opts.keywords);
    if (kw) { this.resolve({ kw: kwShort(kw), keyword: kw }); return; }

    /* comando transparente */
    if (t[0] === "'") {
      var d = Cmd.find(t);
      if (d) { this.startCommand(d.name); return; }
    }

    switch (p.kind) {
      case 'point': {
        var r = CAD.parsePoint(t, this, p.opts.base);
        if (r && r.p) { this.acceptPoint(r.p); return; }
        if (r && r.dist !== undefined && p.opts.base) {
          var dir = this.lastDir !== undefined ? this.lastDir : G.ang(p.opts.base, this.cursorWorld || p.opts.base);
          this.acceptPoint(G.polar(p.opts.base, dir, r.dist));
          return;
        }
        if (!t && p.opts.allowNone) { this.resolve(null); return; }
        this.out('Punto no válido.', 'err');
        this.setPrompt(p.text);
        return;
      }
      case 'string':
        this.resolve(t);
        return;
      case 'real': case 'dist': {
        if (!t && p.opts.def !== undefined) { this.resolve(p.opts.def); return; }
        var v = num(t);
        if (isNaN(v)) {
          var pr = CAD.parsePoint(t, this, p.opts.base);
          if (pr && pr.p && p.opts.base) { this.resolve(G.dist(p.opts.base, pr.p)); return; }
          if (pr && pr.p) { this.pending.opts.base = pr.p; this.setPrompt('Precise segundo punto: '); return; }
          this.out('Se requiere un valor numérico.', 'err'); this.setPrompt(p.text); return;
        }
        this.resolve(v);
        return;
      }
      case 'int': {
        if (!t && p.opts.def !== undefined) { this.resolve(p.opts.def); return; }
        var iv = parseInt(t, 10);
        if (isNaN(iv)) { this.out('Se requiere un número entero.', 'err'); this.setPrompt(p.text); return; }
        this.resolve(iv);
        return;
      }
      case 'angle': {
        if (!t && p.opts.def !== undefined) { this.resolve(p.opts.def); return; }
        var av = num(t);
        if (isNaN(av)) {
          var ar = CAD.parsePoint(t, this, p.opts.base);
          if (ar && ar.p && p.opts.base) { this.resolve(G.ang(p.opts.base, ar.p)); return; }
          this.out('Se requiere un ángulo.', 'err'); this.setPrompt(p.text); return;
        }
        this.resolve(G.rad(av));
        return;
      }
      case 'keyword': {
        if (!t && p.opts.def !== undefined) { this.resolve({ kw: kwShort(p.opts.def), keyword: p.opts.def }); return; }
        this.out('Opción no válida.', 'err'); this.setPrompt(p.text);
        return;
      }
      case 'select': {
        this.selectByKeyword(t);
        return;
      }
      case 'entity': {
        this.out('Se requiere designar un objeto.', 'err'); this.setPrompt(p.text);
        return;
      }
    }
  };

  Engine.resolve = function (val) {
    var p = this.pending;
    if (!p) return;
    this.pending = null;
    p.resolve(val);
  };

  Engine.acceptPoint = function (pt) {
    var p = this.pending;
    if (!p) return;
    /* referencia "punto medio entre 2 puntos" */
    if (this.mtpCollect) {
      this.mtpCollect.push({ x: pt.x, y: pt.y });
      if (this.mtpCollect.length < 2) {
        this.setPrompt('Segundo punto del medio: ');
        this.refresh();
        return;
      }
      var a = this.mtpCollect[0], b = this.mtpCollect[1];
      this.mtpCollect = null;
      pt = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      this.setPrompt(p.text);
    }
    /* referencia a objeto usada: permite cotas asociativas */
    this.lastSnapRef = (this.snapHit && this.snapHit.ent)
      ? { ent: this.snapHit.ent, type: this.snapHit.type, p: { x: this.snapHit.p.x, y: this.snapHit.p.y } }
      : null;
    this.osnapOverride = null;
    this.lastPoint = { x: pt.x, y: pt.y };
    if (p.opts.base) this.lastDir = G.ang(p.opts.base, pt);
    this.resolve({ x: pt.x, y: pt.y });
  };

  /* ---------- Enter / Espacio ---------- */
  Engine.feedEnter = function () {
    var p = this.pending;
    if (!p) {
      if (this.lastCommand) this.startCommand(this.lastCommand);
      return;
    }
    if (p.kind === 'select') {
      var set = p.set || [];
      this.out(p.text + '', 'echo');
      this.resolve(set);
      return;
    }
    if (p.opts.def !== undefined && p.opts.def !== null) {
      if (p.kind === 'keyword') { this.resolve({ kw: kwShort(p.opts.def), keyword: p.opts.def }); return; }
      this.resolve(p.opts.def);
      return;
    }
    if (p.opts.allowNone) { this.resolve(null); return; }
    if (p.opts.enterKw) {
      this.resolve({ kw: kwShort(p.opts.enterKw), keyword: p.opts.enterKw });
      return;
    }
    /* Enter equivale a terminar */
    this.resolve(null);
  };

  /* ---------- Clic en el área gráfica ---------- */
  /* Convierte la última referencia en un vínculo estable {id, type, i} */
  Engine.assocRef = function (p) {
    var r = this.lastSnapRef;
    this.lastSnapRef = null;
    if (!r || !r.ent || !r.ent.id) return null;
    if (G.dist(r.p, p) > 1e-6) return null;
    var pts = CAD.E.snapPoints(r.ent, this.doc).filter(function (s) { return s.type === r.type; });
    for (var i = 0; i < pts.length; i++) {
      if (G.dist(pts[i].p, p) < 1e-6) return { id: r.ent.id, type: r.type, i: i };
    }
    return null;
  };

  Engine.feedPick = function (sp, wp, ent) {
    var p = this.pending;
    if (!p) return false;
    if (p.kind === 'point') { this.acceptPoint(wp); return true; }
    if (p.kind === 'entity') {
      if (!ent) { this.out('No se encontró ningún objeto.', 'warn'); this.setPrompt(p.text); return true; }
      if (p.opts.filter && !p.opts.filter(ent)) { this.out('Objeto no válido.', 'warn'); this.setPrompt(p.text); return true; }
      this.resolve({ ent: ent, p: wp });
      return true;
    }
    if (p.kind === 'select') {
      if (ent) this.addToSelection([ent]);
      else this.out('No se encontró ningún objeto.', 'warn');
      return true;
    }
    if (p.kind === 'dist' || p.kind === 'angle' || p.kind === 'real') {
      if (!p.opts.base) { p.opts.base = wp; this.setPrompt('Precise segundo punto: '); this.refresh(); return true; }
      if (p.kind === 'angle') this.resolve(G.ang(p.opts.base, wp));
      else this.resolve(G.dist(p.opts.base, wp));
      return true;
    }
    return false;
  };

  /* ---------- Designación ---------- */
  Engine.addToSelection = function (ents, quiet) {
    var p = this.pending;
    var target = (p && p.kind === 'select') ? (p.set = p.set || []) : this.selSet;
    var added = 0;
    var self = this;
    ents.forEach(function (e) {
      if (self.doc.layer(e.layer).locked) return;
      if (target.indexOf(e) < 0) { target.push(e); added++; }
    });
    if (p && p.kind === 'select') {
      this.selSet = target.slice();
      if (!quiet) this.out(added + ' encontrado(s)' + (target.length !== added ? ', total ' + target.length : ''));
      this.setPrompt(p.text);
    }
    this.refresh();
    return added;
  };

  Engine.removeFromSelection = function (ents) {
    var p = this.pending;
    var target = (p && p.kind === 'select') ? (p.set = p.set || []) : this.selSet;
    var removed = 0;
    ents.forEach(function (e) {
      var i = target.indexOf(e);
      if (i >= 0) { target.splice(i, 1); removed++; }
    });
    if (p && p.kind === 'select') this.selSet = target.slice();
    this.refresh();
    return removed;
  };

  Engine.selectByKeyword = function (t) {
    var p = this.pending;
    var up = String(t).trim().toUpperCase();
    var doc = this.doc, self = this;
    var all = doc.selectable();
    function done(list, label) {
      self.addToSelection(list);
    }
    if (up === 'TODO' || up === 'T' || up === 'ALL') { done(all); return; }
    if (up === 'U' || up === 'ULTIMO' || up === 'L' || up === 'LAST') {
      if (all.length) done([all[all.length - 1]]);
      return;
    }
    if (up === 'P' || up === 'PREVIO' || up === 'PREVIOUS') {
      done(this.prevSelSet || []); return;
    }
    if (up === 'Q' || up === 'QUITAR' || up === 'R' || up === 'REMOVE') {
      p.removeMode = true;
      this.out('Quitar objetos:'); this.setPrompt('Quitar objetos: ');
      return;
    }
    if (up === 'A' || up === 'ANADIR' || up === 'AÑADIR' || up === 'ADD') {
      p.removeMode = false;
      this.setPrompt(p.text);
      return;
    }
    if (up === 'V' || up === 'VENTANA' || up === 'W' || up === 'WINDOW') {
      this.out('Precise primera esquina:'); p.forceMode = 'window'; return;
    }
    if (up === 'C' || up === 'CAPTURA' || up === 'CROSSING') {
      this.out('Precise primera esquina:'); p.forceMode = 'crossing'; return;
    }
    if (up === 'D' || up === 'DESHACER' || up === 'UNDO') {
      if (p.set && p.set.length) { p.set.pop(); this.selSet = p.set.slice(); this.refresh(); }
      this.setPrompt(p.text);
      return;
    }
    this.out('Se requiere un punto o una opción [Ventana/Captura/TOdo/Último/Previo/Quitar/Añadir].', 'warn');
    this.setPrompt(p.text);
  };

  /* Selección por ventana desde la interfaz */
  Engine.selectBox = function (p1, p2, crossing) {
    var doc = this.doc;
    var box = { x1: Math.min(p1.x, p2.x), y1: Math.min(p1.y, p2.y), x2: Math.max(p1.x, p2.x), y2: Math.max(p1.y, p2.y) };
    var cand = CAD.queryVisible(this, box);
    var hit = cand.filter(function (e) {
      var l = doc.layers[e.layer];
      if (l && l.locked) return false;
      return E.hitBox(e, box, crossing, doc);
    });
    var p = this.pending;
    if (p && p.kind === 'select' && p.removeMode) {
      var r = this.removeFromSelection(hit);
      this.out(r + ' encontrado(s), ' + r + ' quitado(s), total ' + (p.set ? p.set.length : 0));
      this.setPrompt(p.text);
      return hit;
    }
    this.addToSelection(hit);
    return hit;
  };

  /* Candidatos bajo el cursor, ya filtrados por el índice espacial */
  Engine.nearCursor = function (sp, tol) {
    var doc = this.doc, r = this.r;
    var wp = r.s2w(sp);
    var box = { x1: wp.x - tol, y1: wp.y - tol, x2: wp.x + tol, y2: wp.y + tol };
    var list = CAD.queryVisible(this, box);
    var lock = doc.layers;
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      var l = lock[e.layer];
      if (l && l.locked) continue;
      var b = E.bboxOf(e, doc);
      if (b.x1 <= b.x2 && (b.x2 < box.x1 || b.x1 > box.x2 || b.y2 < box.y1 || b.y1 > box.y2)) continue;
      out.push(e);
    }
    return { list: out, wp: wp };
  };

  Engine.pickAt = function (sp) {
    var doc = this.doc;
    var tol = (doc.vars.PICKBOX || 4) / this.r.view.zoom;
    var q = this.nearCursor(sp, tol);
    for (var i = q.list.length - 1; i >= 0; i--) {
      if (E.hit(q.list[i], q.wp, tol, doc)) return q.list[i];
    }
    return null;
  };

  Engine.pickAllAt = function (sp) {
    var doc = this.doc;
    var tol = (doc.vars.PICKBOX || 4) / this.r.view.zoom;
    var q = this.nearCursor(sp, tol);
    return q.list.filter(function (e) { return E.hit(e, q.wp, tol, doc); });
  };
})();
