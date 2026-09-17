/* ============================================================
   commands-extra2.js — Selección avanzada, aislamiento, regiones
   booleanas, tablas, calculadora y depuración de dibujo.
   ============================================================ */
(function () {
  'use strict';
  var CAD = window.CAD, G = CAD.G, E = CAD.E, Cmd = CAD.Cmd, CU = CAD.CU;
  var isKw = CU.isKw;
  function pt(v) { return v && v.x !== undefined ? v : null; }

  /* ============================================================
     DESIGNAR SEMEJANTES
     ============================================================ */
  Cmd.add(['DESIGNASEMEJANTE', 'SELECTSIMILAR'], { group: 'edit', icon: 'qselect', title: 'Designar semejantes' }, async function (ctx) {
    var sel = await ctx.getSelection('Designe objetos');
    if (!sel || !sel.length) return;
    var doc = ctx.doc;
    var keys = {};
    sel.forEach(function (e) { keys[e.type + '|' + e.layer] = 1; });
    var out = doc.selectable().filter(function (e) { return keys[e.type + '|' + e.layer]; });
    ctx.app.selSet = out;
    ctx.out(out.length + ' elemento(s) semejante(s) designado(s).');
    ctx.app.refresh();
  });

  /* ============================================================
     AISLAR Y OCULTAR OBJETOS
     ============================================================ */
  Cmd.add(['AISLAROBJETOS', 'ISOLATEOBJECTS', 'AISLAR'], { group: 'view', icon: 'view', title: 'Aislar objetos' }, async function (ctx) {
    var sel = await ctx.getSelection('Designe objetos a aislar');
    if (!sel || !sel.length) return;
    ctx.doc.entities.forEach(function (e) { if (sel.indexOf(e) < 0) e.hidden = true; });
    ctx.app.isolated = true;
    ctx.app.selSet = [];
    ctx.out(sel.length + ' objeto(s) aislado(s). FINAISLAR los devuelve todos.');
    ctx.app.refresh();
  });

  Cmd.add(['OCULTAROBJETOS', 'HIDEOBJECTS'], { group: 'view', icon: 'view', title: 'Ocultar objetos' }, async function (ctx) {
    var sel = await ctx.getSelection('Designe objetos a ocultar');
    if (!sel || !sel.length) return;
    sel.forEach(function (e) { e.hidden = true; });
    ctx.app.isolated = true;
    ctx.app.selSet = [];
    ctx.out(sel.length + ' objeto(s) oculto(s).');
    ctx.app.refresh();
  });

  Cmd.add(['FINAISLAR', 'UNISOLATEOBJECTS', 'MOSTRARTODO'], { group: 'view', icon: 'view', title: 'Finalizar aislamiento' }, async function (ctx) {
    var n = 0;
    ctx.doc.entities.forEach(function (e) { if (e.hidden) { delete e.hidden; n++; } });
    ctx.doc.layouts.forEach(function (l) { l.entities.forEach(function (e) { if (e.hidden) { delete e.hidden; n++; } }); });
    ctx.app.isolated = false;
    ctx.out(n + ' objeto(s) devuelto(s) a la vista.');
    ctx.app.refresh();
  });

  /* ============================================================
     CUBRIR
     ============================================================ */
  Cmd.add(['CUBRIR', 'WIPEOUT'], { group: 'draw', icon: 'wipeout', title: 'Cubrir' }, async function (ctx) {
    var p0 = await ctx.getPoint('Precise el primer punto o', { keywords: ['Marcos', 'Polilínea'] });
    if (p0 === null) return;
    if (isKw(p0)) {
      if (p0.kw === 'P') {
        var e = await ctx.getEntity('Designe una polilínea cerrada', {
          filter: function (x) { return x.type === 'LWPOLYLINE' && x.closed; }
        });
        if (!e) return;
        ctx.doc.mark('CUBRIR');
        var w = E.hatch([E.plinePts(e.ent, 2)], { layer: ctx.doc.vars.CLAYER });
        w.wipeout = true; w.solid = true; w.pattern = 'SOLID';
        ctx.doc.add(w);
        ctx.app.refresh();
        return;
      }
      if (p0.kw === 'M') {
        var m = await ctx.getKeyword('Indique el modo de los marcos', ['ACT', 'DES'], { def: 'ACT' });
        ctx.app.wipeoutFrames = !m || m.kw === 'A';
        ctx.app.refresh();
        return;
      }
      return;
    }
    var pts = [p0];
    while (true) {
      var p = await ctx.getPoint('Precise el punto siguiente o', {
        base: pts[pts.length - 1], keywords: pts.length > 2 ? ['Cerrar', 'desHacer'] : ['desHacer'], allowNone: true,
        preview: function (c) {
          var h = E.hatch([pts.concat([c])], {});
          h.wipeout = true; h.solid = true;
          return [h];
        }
      });
      if (p === null) break;
      if (isKw(p)) {
        if (p.kw === 'C') break;
        if (p.kw === 'H' && pts.length > 1) pts.pop();
        continue;
      }
      pts.push(p);
      ctx.app.refresh();
    }
    if (pts.length < 3) return;
    ctx.doc.mark('CUBRIR');
    var wo = E.hatch([pts], { layer: ctx.doc.vars.CLAYER });
    wo.wipeout = true; wo.solid = true; wo.pattern = 'SOLID';
    ctx.doc.add(wo);
    ctx.app.refresh();
  });

  /* ============================================================
     CAPA PREVIA
     ============================================================ */
  Cmd.add(['CAPAPREV', 'LAYERP'], { group: 'layer', icon: 'layer', title: 'Capa previa' }, async function (ctx) {
    var app = ctx.app;
    if (!app.layerStates || !app.layerStates.length) { ctx.err('No hay ningún estado de capa anterior.'); return; }
    var st = app.layerStates.pop();
    ctx.doc.layerOrder.forEach(function (n) {
      if (st[n]) Object.assign(ctx.doc.layers[n], st[n]);
    });
    ctx.out('Se ha restablecido el estado anterior de las capas.');
    ctx.app.refresh();
  });

  /* ============================================================
     CAMBIAR PROPIEDADES
     ============================================================ */
  Cmd.add(['CAMBIA', 'CHANGE', 'CHPROP'], { group: 'props', icon: 'props', title: 'Cambiar propiedades' }, async function (ctx) {
    var sel = await ctx.getSelection('Designe objetos');
    if (!sel || !sel.length) return;
    while (true) {
      var o = await ctx.getKeyword('Indique la propiedad a cambiar', ['Color', 'CApa', 'TIpo de línea', 'EScala TL', 'GRosor', 'Altura', 'salir'], { def: 'salir' });
      if (!o || o.kw === 'S') break;
      ctx.doc.mark('CAMBIA');
      if (o.kw === 'C') {
        var c = await ctx.app.ui.colorDialog(256);
        if (c !== null) sel.forEach(function (e) { e.color = c; });
      } else if (o.kw === 'CA') {
        var l = await ctx.app.ui.listDialog('Capa nueva', ctx.doc.layerOrder, ctx.doc.vars.CLAYER);
        if (l) sel.forEach(function (e) { e.layer = l; });
      } else if (o.kw === 'TI') {
        var t = await ctx.app.ui.listDialog('Tipo de línea', ['ByLayer'].concat(Object.keys(ctx.doc.ltypes)), 'ByLayer');
        if (t) sel.forEach(function (e) { e.ltype = t; });
      } else if (o.kw === 'ES') {
        var s = await ctx.getReal('Nueva escala de tipo de línea', { def: 1 });
        if (typeof s === 'number') sel.forEach(function (e) { e.ltscale = s; });
      } else if (o.kw === 'GR') {
        var w = await ctx.app.ui.lweightDialog(-1);
        if (w !== null) sel.forEach(function (e) { e.lw = w; });
      } else if (o.kw === 'A') {
        var h = await ctx.getReal('Nueva altura de texto', { def: ctx.doc.vars.TEXTSIZE });
        if (typeof h === 'number' && h > 0) sel.forEach(function (e) { if (e.h !== undefined) e.h = h; });
      }
      ctx.app.refresh();
    }
    ctx.app.selSet = [];
    ctx.app.refresh();
  });

  Cmd.add(['DEFINIRPORCAPA', 'SETBYLAYER'], { group: 'props', title: 'Definir por capa' }, async function (ctx) {
    var sel = await ctx.getSelection('Designe objetos');
    if (!sel || !sel.length) return;
    ctx.doc.mark('DEFINIRPORCAPA');
    sel.forEach(function (e) { e.color = 256; e.ltype = 'ByLayer'; e.lw = -1; });
    ctx.out(sel.length + ' objeto(s) cambiado(s) a PorCapa.');
    ctx.app.selSet = [];
    ctx.app.refresh();
  });

  /* ============================================================
     TEXTO: ESCALA Y JUSTIFICACIÓN
     ============================================================ */
  Cmd.add(['ESCALATEXTO', 'SCALETEXT'], { group: 'annot', icon: 'text', title: 'Escalar texto' }, async function (ctx) {
    var sel = await ctx.getSelection('Designe objetos de anotación');
    if (!sel || !sel.length) return;
    var txts = sel.filter(function (e) { return e.type === 'TEXT' || e.type === 'MTEXT' || e.type === 'ATTDEF'; });
    if (!txts.length) { ctx.err('No se han designado textos.'); return; }
    var base = await ctx.getKeyword('Indique el punto base', ['Existente', 'Izquierda', 'Centro', 'Derecha'], { def: 'Existente' });
    var mode = await ctx.getKeyword('Precise la altura nueva o', ['Factor de escala', 'Altura'], { def: 'Altura' });
    var val = await ctx.getReal(mode && mode.kw === 'F' ? 'Precise el factor de escala' : 'Precise la altura nueva',
      { def: mode && mode.kw === 'F' ? 2 : ctx.doc.vars.TEXTSIZE });
    if (typeof val !== 'number' || val <= 0) return;
    ctx.doc.mark('ESCALATEXTO');
    txts.forEach(function (e) {
      var f = (mode && mode.kw === 'F') ? val : val / (e.h || 1);
      var anchor = { x: e.p.x, y: e.p.y };
      E.transform(e, G.mScale(f, f, anchor), ctx.doc);
    });
    ctx.out(txts.length + ' objeto(s) escalado(s).');
    ctx.app.selSet = [];
    ctx.app.refresh();
  });

  Cmd.add(['JUSTIFICATEXTO', 'JUSTIFYTEXT'], { group: 'annot', icon: 'text', title: 'Justificar texto' }, async function (ctx) {
    var sel = await ctx.getSelection('Designe objetos de anotación');
    if (!sel || !sel.length) return;
    var j = await ctx.getKeyword('Indique la justificación', ['Izquierda', 'Centro', 'Derecha', 'MEdio'], { def: 'Izquierda' });
    if (!j) return;
    var map = { I: [0, 0], C: [1, 0], D: [2, 0], ME: [4, 2] };
    var m = map[j.kw] || [0, 0];
    ctx.doc.mark('JUSTIFICATEXTO');
    sel.forEach(function (e) {
      if (e.type !== 'TEXT' && e.type !== 'ATTDEF' && e.type !== 'ATTRIB') return;
      e.halign = m[0]; e.valign = m[1];
      e.p2 = { x: e.p.x, y: e.p.y };
    });
    ctx.app.selSet = [];
    ctx.app.refresh();
  });

  /* ============================================================
     PUNTO BASE
     ============================================================ */
  Cmd.add(['PUNTOBASE', 'BASE'], { group: 'settings', title: 'Punto base de inserción' }, async function (ctx) {
    var p = await ctx.getPoint('Precise el punto base', { def: '0,0' });
    if (!pt(p)) return;
    ctx.doc.vars.INSBASE = { x: p.x, y: p.y };
    ctx.out('Punto base de inserción: ' + G.fmt(p.x, 2) + ', ' + G.fmt(p.y, 2));
  });

  /* ============================================================
     REGIONES Y OPERACIONES BOOLEANAS
     ============================================================ */
  Cmd.add(['REGION', 'REGIONES'], { group: 'draw', icon: 'boundary', title: 'Región' }, async function (ctx) {
    var sel = await ctx.getSelection('Designe objetos');
    if (!sel || !sel.length) return;
    ctx.doc.mark('REGION');
    var n = 0;
    sel.forEach(function (e) {
      var l = CAD.Region.loopOf(e, ctx.doc);
      if (!l) return;
      if (e.type === 'LWPOLYLINE' && e.closed) { e.region = true; n++; return; }
      var pl = E.pline(l, true, { layer: e.layer, color: e.color, ltype: e.ltype, lw: e.lw });
      pl.region = true;
      ctx.doc.remove(e);
      ctx.doc.add(pl);
      n++;
    });
    ctx.out(n + ' bucle(s) extraído(s).');
    ctx.out(n + ' región(es) creada(s).');
    ctx.app.selSet = [];
    ctx.app.refresh();
  });

  function boolCmd(names, op, label, prompt2) {
    Cmd.add(names, { group: 'modify', icon: 'boolean', title: label }, async function (ctx) {
      var a = await ctx.getSelection(op === 'diff' ? 'Designe la región de la que restar' : 'Designe las regiones');
      if (!a || !a.length) return;
      var b = a;
      if (op === 'diff') {
        ctx.app.selSet = [];
        b = await ctx.getSelection(prompt2, { force: true });
        if (!b || !b.length) return;
      } else if (a.length < 2) {
        ctx.err('Se requieren al menos dos contornos cerrados.');
        return;
      }
      var doc = ctx.doc;
      var loops = [];
      var src = op === 'diff' ? a.concat(b) : a;
      for (var i = 0; i < src.length; i++) {
        var l = CAD.Region.loopOf(src[i], doc);
        if (!l) { ctx.err('Todos los objetos deben ser contornos cerrados (polilínea cerrada, círculo, elipse o sombreado).'); return; }
        loops.push(l);
      }
      doc.mark(label);
      var res;
      if (op === 'diff') {
        var acc = [loops[0]];
        for (var k = a.length; k < loops.length; k++) {
          var next = [];
          acc.forEach(function (cur) {
            var r = CAD.Region.boolean(cur, loops[k], 'diff');
            if (r === null) next.push(cur);
            else if (!r.length) { if (!G.ptInPoly(cur[0], loops[k])) next.push(cur); }
            else r.forEach(function (x) { next.push(x); });
          });
          acc = next;
        }
        res = { loops: acc };
      } else {
        res = CAD.Region.apply(doc, src, op);
      }
      if (res.error) { ctx.err(res.error); doc.undoStack.pop(); return; }
      var proto = src[0];
      doc.removeAll(src);
      (res.loops || []).forEach(function (l) {
        var pl = E.pline(l, true, { layer: proto.layer, color: proto.color, ltype: proto.ltype, lw: proto.lw });
        pl.region = true;
        doc.add(pl);
      });
      ctx.out((res.loops || []).length + ' región(es) resultante(s).');
      ctx.app.selSet = [];
      ctx.app.refresh();
    });
  }
  boolCmd(['UNION', 'UNIONREG'], 'union', 'Unión');
  boolCmd(['DIFERENCIA', 'SUBTRACT'], 'diff', 'Diferencia', 'Designe las regiones a restar');
  boolCmd(['INTERSEC', 'INTERSECT'], 'inter', 'Intersección');

  /* ============================================================
     TABLA
     ============================================================ */
  Cmd.add(['TABLA', 'TABLE'], { group: 'annot', icon: 'table', title: 'Tabla' }, async function (ctx) {
    var cfg = await ctx.app.ui.tableDialog(ctx.doc.vars.TEXTSIZE);
    if (!cfg) return;
    var p = await ctx.getPoint('Precise el punto de inserción', {
      preview: function (c) { return tableEnts(ctx, cfg, c); }
    });
    if (!pt(p)) return;
    ctx.doc.mark('TABLA');
    tableEnts(ctx, cfg, p).forEach(function (e) { ctx.doc.add(e); });
    ctx.app.refresh();
  });

  function tableEnts(ctx, cfg, p) {
    var out = [];
    var lay = { layer: ctx.doc.vars.CLAYER };
    var cw = cfg.colw, rh = cfg.rowh, nc = cfg.cols, nr = cfg.rows;
    var W = cw * nc;
    var titleH = cfg.title ? rh * 1.4 : 0;
    var H = rh * nr + titleH;
    var top = p.y, left = p.x;
    /* marco exterior */
    out.push(E.pline([
      { x: left, y: top }, { x: left + W, y: top },
      { x: left + W, y: top - H }, { x: left, y: top - H }
    ], true, Object.assign({ lw: 35 }, lay)));
    var y = top;
    if (cfg.title) {
      y -= titleH;
      out.push(E.line({ x: left, y: y }, { x: left + W, y: y }, lay));
      var t = E.text({ x: left + W / 2, y: y + titleH / 2 }, cfg.h * 1.25, cfg.title, 0, lay);
      t.halign = 1; t.valign = 2; t.p2 = { x: left + W / 2, y: y + titleH / 2 };
      out.push(t);
    }
    for (var r = 0; r < nr; r++) {
      var ry = y - rh * r;
      if (r > 0) out.push(E.line({ x: left, y: ry }, { x: left + W, y: ry }, lay));
      for (var c = 0; c < nc; c++) {
        var txt = (cfg.data[r] && cfg.data[r][c]) || '';
        if (!txt) continue;
        var te = E.text({ x: left + cw * c + cw / 2, y: ry - rh / 2 }, cfg.h, txt, 0, lay);
        te.halign = 1; te.valign = 2; te.p2 = { x: left + cw * c + cw / 2, y: ry - rh / 2 };
        out.push(te);
      }
    }
    for (var k = 1; k < nc; k++) {
      out.push(E.line({ x: left + cw * k, y: y }, { x: left + cw * k, y: top - H }, lay));
    }
    return out;
  }

  /* ============================================================
     DEPURAR OBJETOS DUPLICADOS
     ============================================================ */
  Cmd.add(['DEPURAR', 'OVERKILL'], { group: 'modify', icon: 'purge', title: 'Depurar duplicados' }, async function (ctx) {
    var sel = await ctx.getSelection('Designe objetos o <todo el dibujo>', { force: true, allowNone: true });
    var list = (sel && sel.length) ? sel : ctx.doc.ents().slice();
    var tol = await ctx.getReal('Precise la tolerancia', { def: 0.000001 });
    if (typeof tol !== 'number') tol = 1e-6;
    ctx.doc.mark('DEPURAR');
    var seen = [], dup = [];
    list.forEach(function (e) {
      var k = sig(e, ctx.doc, tol);
      if (!k) return;
      if (seen.indexOf(k) >= 0) dup.push(e); else seen.push(k);
    });
    ctx.doc.removeAll(dup);
    ctx.out(list.length + ' objeto(s) analizado(s).');
    ctx.out(dup.length + ' objeto(s) duplicado(s) eliminado(s).', dup.length ? 'ok' : undefined);
    if (!dup.length) ctx.doc.undoStack.pop();
    ctx.app.selSet = [];
    ctx.app.refresh();
  });

  function sig(e, doc, tol) {
    var q = function (v) { return Math.round(v / Math.max(tol, 1e-9)); };
    switch (e.type) {
      case 'LINE': {
        var a = [q(e.p1.x), q(e.p1.y)], b = [q(e.p2.x), q(e.p2.y)];
        var f = (a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1])) ? a.concat(b) : b.concat(a);
        return 'L' + e.layer + f.join(',');
      }
      case 'CIRCLE': return 'C' + e.layer + [q(e.c.x), q(e.c.y), q(e.r)].join(',');
      case 'ARC': return 'A' + e.layer + [q(e.c.x), q(e.c.y), q(e.r), q(G.deg(G.na(e.a0))), q(G.deg(G.na(e.a1)))].join(',');
      case 'POINT': return 'P' + e.layer + [q(e.p.x), q(e.p.y)].join(',');
      case 'TEXT': return 'T' + e.layer + [q(e.p.x), q(e.p.y), e.text].join(',');
      case 'LWPOLYLINE': return 'W' + e.layer + (e.closed ? '1' : '0') +
        e.verts.map(function (v) { return q(v.x) + ':' + q(v.y) + ':' + q(v.b || 0); }).join(',');
      case 'INSERT': return 'I' + e.layer + e.name + [q(e.p.x), q(e.p.y), q(e.rot), q(e.sx)].join(',');
      default: return null;
    }
  }

  /* ============================================================
     MULTIPLE
     ============================================================ */
  Cmd.add(['MULTIPLE', 'MULTIPLES'], { group: 'edit', title: 'Repetir comando' }, async function (ctx) {
    var name = await ctx.getString('Indique el nombre del comando a repetir');
    if (!name) return;
    var def = Cmd.find(name);
    if (!def) { ctx.err('Comando desconocido "' + name + '".'); return; }
    ctx.app.multipleCmd = def.name;
    ctx.out('Se repetirá ' + def.name + ' hasta pulsar Esc.');
    ctx.app.startCommand(def.name);
  });

  /* ============================================================
     CALCULADORA RÁPIDA
     ============================================================ */
  var CALC = {
    fns: {
      sin: function (x) { return Math.sin(G.rad(x)); },
      cos: function (x) { return Math.cos(G.rad(x)); },
      tan: function (x) { return Math.tan(G.rad(x)); },
      asin: function (x) { return G.deg(Math.asin(x)); },
      acos: function (x) { return G.deg(Math.acos(x)); },
      atan: function (x) { return G.deg(Math.atan(x)); },
      sqrt: Math.sqrt, abs: Math.abs, ln: Math.log, log: function (x) { return Math.log(x) / Math.LN10; },
      round: Math.round, floor: Math.floor, ceil: Math.ceil, exp: Math.exp
    },
    consts: { pi: Math.PI, e: Math.E }
  };
  CAD.calc = function (expr) {
    var s = String(expr).toLowerCase().replace(/\s+/g, '').replace(/,/g, '.');
    var i = 0;
    function peek() { return s[i]; }
    function num() {
      var m = /^\d*\.?\d+(e[-+]?\d+)?/.exec(s.slice(i));
      if (!m) return null;
      i += m[0].length;
      return parseFloat(m[0]);
    }
    function factor() {
      if (peek() === '+') { i++; return factor(); }
      if (peek() === '-') { i++; return -factor(); }
      if (peek() === '(') {
        i++;
        var v = expr2();
        if (peek() === ')') i++;
        return v;
      }
      var id = /^[a-z]+/.exec(s.slice(i));
      if (id) {
        i += id[0].length;
        if (CALC.consts[id[0]] !== undefined && peek() !== '(') return CALC.consts[id[0]];
        var fn = CALC.fns[id[0]];
        if (!fn) throw new Error('Función desconocida: ' + id[0]);
        if (peek() !== '(') throw new Error('Falta "(" tras ' + id[0]);
        i++;
        var a = expr2();
        if (peek() === ')') i++;
        return fn(a);
      }
      var n = num();
      if (n === null) throw new Error('Expresión no válida');
      return n;
    }
    function power() {
      var b = factor();
      if (peek() === '^') { i++; return Math.pow(b, power()); }
      return b;
    }
    function term() {
      var v = power();
      while (peek() === '*' || peek() === '/' || peek() === '%') {
        var op = s[i++];
        var r = power();
        v = op === '*' ? v * r : op === '/' ? v / r : v % r;
      }
      return v;
    }
    function expr2() {
      var v = term();
      while (peek() === '+' || peek() === '-') {
        var op = s[i++];
        v = op === '+' ? v + term() : v - term();
      }
      return v;
    }
    var out = expr2();
    if (i < s.length) throw new Error('Sobra "' + s.slice(i) + '"');
    if (!isFinite(out)) throw new Error('Resultado no finito');
    return out;
  };

  Cmd.add(['CALCRAPIDA', 'QUICKCALC', 'CAL'], { group: 'inquiry', icon: 'calc', title: 'Calculadora', transparent: true }, async function (ctx) {
    await ctx.app.ui.calcDialog();
  });
})();
