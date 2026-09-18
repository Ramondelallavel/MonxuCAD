/* ============================================================
   commands-extra4.js — Estados de capa, edición de bloques,
   estilos de punto, dibujo a mano alzada, vistas 3D avanzadas
   y utilidades de consulta.
   ============================================================ */
(function () {
  'use strict';
  var CAD = window.CAD, G = CAD.G, G3 = CAD.G3, E = CAD.E, Cmd = CAD.Cmd, CU = CAD.CU;
  var M = CAD.Mesh, S = CAD.Solid;
  var isKw = CU.isKw;
  function pt(v) { return v && v.x !== undefined ? v : null; }
  function num(v) { return typeof v === 'number' && isFinite(v); }
  function kw(v) { return v && v.kw ? v.kw : null; }

  /* ============================================================
     ESTADOSCAPA — guardar y restituir configuraciones de capa
     ============================================================ */
  function layerSnapshot(doc) {
    var st = {};
    doc.layerOrder.forEach(function (n) {
      var l = doc.layers[n];
      st[n] = { on: l.on, frozen: l.frozen, locked: l.locked, plot: l.plot,
                color: l.color, ltype: l.ltype, lw: l.lw, transparency: l.transparency };
    });
    return { layers: st, current: doc.vars.CLAYER };
  }
  function layerRestore(doc, snap, what) {
    what = what || {};
    Object.keys(snap.layers).forEach(function (n) {
      var l = doc.layers[n], s = snap.layers[n];
      if (!l) { doc.addLayer(Object.assign({ name: n }, s)); return; }
      if (what.estado !== false) { l.on = s.on; l.frozen = s.frozen; l.locked = s.locked; l.plot = s.plot; }
      if (what.props !== false) { l.color = s.color; l.ltype = s.ltype; l.lw = s.lw; l.transparency = s.transparency; }
    });
    if (what.current !== false && doc.layers[snap.current]) doc.vars.CLAYER = snap.current;
  }

  Cmd.add(['ESTADOSCAPA', 'LAYERSTATE', 'LAYSTATE'], { group: 'layer', icon: 'layerstate', title: 'Estados de capa' },
  async function (ctx) {
    var doc = ctx.doc;
    doc.layerStates = doc.layerStates || {};
    var names = Object.keys(doc.layerStates);
    if (names.length) ctx.out('Estados guardados: ' + names.join(', '));
    else ctx.out('No hay ningún estado de capa guardado.');
    var k = await ctx.getKeyword('Estados de capa',
      ['Guardar', 'Restituir', 'Eliminar', 'Renombrar', 'Listar'], { def: 'Guardar' });
    if (!k) return;
    var m = k.kw;
    if (m === 'G') {
      var nm = await ctx.getString('Nombre del estado nuevo', { def: 'Estado' + (names.length + 1) });
      if (!nm) return;
      ctx.doc.mark('ESTADOSCAPA');
      doc.layerStates[String(nm)] = layerSnapshot(doc);
      ctx.out('Estado "' + nm + '" guardado con ' + doc.layerOrder.length + ' capa(s).');
      return;
    }
    if (!names.length) { ctx.err('No hay estados guardados.'); return; }
    if (m === 'R') {
      var sel = await ctx.app.ui.listDialog('Restituir estado de capa', names, names[0]);
      if (!sel || !doc.layerStates[sel]) return;
      var w = await ctx.getKeyword('¿Qué se restituye?',
        ['Todo', 'Sólo Estado', 'sólo Propiedades'], { def: 'Todo' });
      ctx.doc.mark('ESTADOSCAPA');
      var wk = kw(w);
      layerRestore(doc, doc.layerStates[sel],
        { estado: wk !== 'P', props: wk !== 'SE' });
      ctx.app.refresh(true);
      ctx.out('Estado "' + sel + '" restituido.');
      return;
    }
    if (m === 'E') {
      var del = await ctx.app.ui.listDialog('Eliminar estado de capa', names, names[0]);
      if (!del) return;
      delete doc.layerStates[del];
      ctx.out('Estado "' + del + '" eliminado.');
      return;
    }
    if (m === 'RE') {
      var old = await ctx.app.ui.listDialog('Renombrar estado', names, names[0]);
      if (!old) return;
      var nn = await ctx.getString('Nombre nuevo', { def: old });
      if (!nn || nn === old) return;
      doc.layerStates[String(nn)] = doc.layerStates[old];
      delete doc.layerStates[old];
      ctx.out('Renombrado a "' + nn + '".');
      return;
    }
    ctx.out('=== ESTADOS DE CAPA ===');
    names.forEach(function (n) {
      var s = doc.layerStates[n];
      var nOn = Object.keys(s.layers).filter(function (x) { return s.layers[x].on && !s.layers[x].frozen; }).length;
      ctx.out('  ' + n + '   ' + Object.keys(s.layers).length + ' capa(s), ' + nOn + ' visible(s), actual "' + s.current + '"');
    });
  });

  /* ============================================================
     ESTILOPUNTO — forma y tamaño de los puntos (PDMODE / PDSIZE)
     ============================================================ */
  Cmd.add(['ESTILOPUNTO', 'DDPTYPE', 'PTYPE'], { group: 'draw', icon: 'point', title: 'Estilo de punto' },
  async function (ctx) {
    var doc = ctx.doc;
    if (ctx.app.ui.pointStyleDialog) {
      var r = await ctx.app.ui.pointStyleDialog(doc.vars.PDMODE || 0, doc.vars.PDSIZE || 0);
      if (!r) return;
      ctx.doc.mark('ESTILOPUNTO');
      doc.vars.PDMODE = r.mode;
      doc.vars.PDSIZE = r.size;
    } else {
      ctx.out('PDMODE: 0 punto · 1 nada · 2 cruz + · 3 aspa × · 4 tick |');
      ctx.out('        súmele 32 para un círculo y 64 para un cuadrado (p. ej. 35, 66, 99)');
      var md = await ctx.getReal('Introduzca el valor de PDMODE', { def: doc.vars.PDMODE || 0 });
      if (!num(md)) return;
      var sz = await ctx.getReal('Introduzca el valor de PDSIZE (0 = 5% de la pantalla, negativo = relativo)',
                                 { def: doc.vars.PDSIZE || 0 });
      if (!num(sz)) return;
      ctx.doc.mark('ESTILOPUNTO');
      doc.vars.PDMODE = Math.round(md);
      doc.vars.PDSIZE = sz;
    }
    ctx.app.refresh(true);
    ctx.out('PDMODE = ' + doc.vars.PDMODE + '   PDSIZE = ' + G.fmt(doc.vars.PDSIZE, 4));
  });

  /* ============================================================
     BOCETO — dibujo a mano alzada
     ============================================================ */
  Cmd.add(['BOCETO', 'SKETCH'], { group: 'draw', icon: 'sketch', title: 'Boceto a mano alzada' },
  async function (ctx) {
    var doc = ctx.doc;
    var inc = await ctx.getDist('Precise el incremento de registro', { def: doc.vars.SKPOLY_INC || 1 });
    if (!num(inc) || inc <= 0) return;
    doc.vars.SKPOLY_INC = inc;
    var tipo = await ctx.getKeyword('Tipo de objeto', ['Polilínea', 'Líneas', 'Spline'], { def: 'Polilínea' });
    if (!tipo) return;
    ctx.out('Trace con el botón izquierdo pulsado. Intro o botón derecho para terminar.');
    var app = ctx.app, cv = app.cv;
    var pts = [], drawing = false, done = false;
    doc.mark('BOCETO');

    function onDown(e) { if (e.button !== 0) return; drawing = true; pts.push([]); add(); }
    function onMove() { if (drawing) add(); }
    function onUp() { drawing = false; }
    function add() {
      var w = app.cursorWorld;
      var run = pts[pts.length - 1];
      if (!run.length || G.dist(run[run.length - 1], w) >= inc) {
        run.push({ x: w.x, y: w.y });
        app.preview = build(true);
        app.refresh();
      }
    }
    function build(prev) {
      var out = [];
      pts.forEach(function (run) {
        if (run.length < 2) return;
        var t = kw(tipo);
        if (t === 'L') {
          for (var i = 0; i + 1 < run.length; i++)
            out.push(E.line(run[i], run[i + 1], { layer: doc.vars.CLAYER }));
        } else if (t === 'S') {
          out.push(E.spline(run, false, { layer: doc.vars.CLAYER }));
        } else {
          out.push(E.pline(run, false, { layer: doc.vars.CLAYER }));
        }
      });
      return out;
    }
    cv.addEventListener('pointerdown', onDown);
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerup', onUp);
    try {
      await ctx.getKeyword('Pulse Intro para grabar el boceto', ['Grabar', 'Descartar'], { def: 'Grabar' });
    } catch (err) { done = true; }
    cv.removeEventListener('pointerdown', onDown);
    cv.removeEventListener('pointermove', onMove);
    cv.removeEventListener('pointerup', onUp);
    app.preview = [];
    var made = build(false);
    if (done || !made.length) { doc.discardTx(); ctx.app.refresh(); ctx.out('Boceto descartado.'); return; }
    made.forEach(function (e) { doc.add(e); });
    ctx.app.refresh(true);
    var total = pts.reduce(function (s, r) {
      var L = 0;
      for (var i = 0; i + 1 < r.length; i++) L += G.dist(r[i], r[i + 1]);
      return s + L;
    }, 0);
    ctx.out(made.length + ' objeto(s) de boceto, longitud total ' + G.fmt(total, 3) + '.');
  });

  /* ============================================================
     OCULTA — líneas ocultas en la vista 3D
     ============================================================ */
  Cmd.add(['OCULTA', 'HIDE', 'OCULTAR'], { group: 'view3d', icon: 'vstyle', title: 'Ocultar líneas', transparent: true },
  async function (ctx) {
    ctx.app.set3D(true);
    if (!ctx.app.view3d || !ctx.app.view3d.ok) { ctx.err('La vista 3D no está disponible.'); return; }
    ctx.app.view3d.style = 'OCULTA';
    ctx.app.view3d.dirty = true;
    ctx.app.refresh();
    ctx.out('Regenerando modelo con líneas ocultas.');
  });

  Cmd.add(['REGENAUTO'], { group: 'view', icon: 'regen', title: 'Regeneración automática' },
  async function (ctx) {
    var k = await ctx.getKeyword('Introduzca el modo', ['ACT', 'DES'], { def: ctx.doc.vars.REGENAUTO === 0 ? 'DES' : 'ACT' });
    if (!k) return;
    ctx.doc.vars.REGENAUTO = kw(k) === 'ACT' ? 1 : 0;
    ctx.out('REGENAUTO ' + (ctx.doc.vars.REGENAUTO ? 'activada' : 'desactivada') + '.');
  });

  /* ============================================================
     CAMARA — sitúa la vista 3D con ojo y mira
     ============================================================ */
  Cmd.add(['CAMARA', 'CAMERA'], { group: 'view3d', icon: 'persp', title: 'Cámara' },
  async function (ctx) {
    ctx.app.set3D(true);
    if (!ctx.app.view3d || !ctx.app.view3d.ok) { ctx.err('La vista 3D no está disponible.'); return; }
    var eye = await ctx.getPoint('Precise la posición de la cámara'); if (!pt(eye)) return;
    var ez = await ctx.getDist('Precise la altura de la cámara', { def: 100 });
    if (!num(ez)) return;
    var tgt = await ctx.getPoint('Precise el punto de mira', { base: eye }); if (!pt(tgt)) return;
    var tz = await ctx.getDist('Precise la altura del punto de mira', { def: 0 });
    if (!num(tz)) tz = 0;
    var lens = await ctx.getReal('Precise la longitud focal en mm', { def: 50 });
    var cam = ctx.app.view3d.cam;
    cam.target = G3.v(tgt.x, tgt.y, tz);
    var d = G3.sub(G3.v(eye.x, eye.y, ez), cam.target);
    cam.dist = Math.max(1e-3, G3.len(d));
    cam.dir = G3.norm(d);
    cam.up = G3.v(0, 0, 1);
    cam.up = G3.norm(G3.sub(cam.up, G3.mul(cam.dir, G3.dot(cam.up, cam.dir))));
    if (G3.len2(cam.up) < 1e-9) cam.up = G3.perp(cam.dir);
    if (num(lens) && lens > 1) {
      /* fotograma de 35 mm: ángulo vertical a partir de la focal */
      cam.fov = 2 * Math.atan(24 / (2 * lens));
      cam.persp = true;
    }
    ctx.app.refresh();
    ctx.out('Cámara en ' + G.fmt(eye.x, 2) + ',' + G.fmt(eye.y, 2) + ',' + G.fmt(ez, 2) +
            '  mirando a ' + G.fmt(tgt.x, 2) + ',' + G.fmt(tgt.y, 2) + ',' + G.fmt(tz, 2) +
            (num(lens) ? '   focal ' + G.fmt(lens, 1) + ' mm' : ''));
  });

  /* ============================================================
     PASEO — recorrido en primera persona por el modelo
     ============================================================ */
  Cmd.add(['PASEO', '3DWALK', 'VUELO', '3DFLY'], { group: 'view3d', icon: 'orbit', title: 'Paseo por el modelo' },
  async function (ctx) {
    ctx.app.set3D(true);
    var v = ctx.app.view3d;
    if (!v || !v.ok) { ctx.err('La vista 3D no está disponible.'); return; }
    v.cam.persp = true;
    ctx.app.walkMode = true;
    ctx.out('Paseo: W/S adelante y atrás, A/D a los lados, Q/E subir y bajar,');
    ctx.out('       arrastre con el ratón para mirar. Esc o Intro para salir.');
    var speed = G3.boxDiag(v.box || { x1: 0, y1: 0, z1: 0, x2: 100, y2: 100, z2: 100 }) / 40;
    function onKey(e) {
      var k = e.key.toLowerCase();
      var fwd = G3.neg(v.cam.dir);
      var right = G3.norm(G3.cross(fwd, v.cam.up));
      var d = null;
      if (k === 'w') d = G3.mul(fwd, speed);
      else if (k === 's') d = G3.mul(fwd, -speed);
      else if (k === 'a') d = G3.mul(right, -speed);
      else if (k === 'd') d = G3.mul(right, speed);
      else if (k === 'q') d = G3.v(0, 0, speed);
      else if (k === 'e') d = G3.v(0, 0, -speed);
      if (!d) return;
      e.preventDefault();
      v.cam.target = G3.add(v.cam.target, d);
      ctx.app.refresh();
    }
    document.addEventListener('keydown', onKey, true);
    try {
      await ctx.getKeyword('Pulse Intro para salir del paseo', ['Salir'], { def: 'Salir' });
    } catch (err) { }
    document.removeEventListener('keydown', onKey, true);
    ctx.app.walkMode = false;
    ctx.out('Fin del paseo.');
  });

  /* ============================================================
     CONVERTIRAPOLI — une segmentos sueltos en polilíneas
     ============================================================ */
  Cmd.add(['CONVERTIRAPOLI', 'CONVERTPOLY', 'APOLI'], { group: 'modify', icon: 'pline', title: 'Convertir en polilínea' },
  async function (ctx) {
    var sel = await ctx.getSelection('Designe líneas y arcos a unir');
    if (!sel || !sel.length) return;
    var tol = await ctx.getDist('Tolerancia de unión de extremos', { def: 1e-6 });
    if (!num(tol) || tol < 0) tol = 1e-6;
    var segs = [], used = [];
    sel.forEach(function (e) {
      if (e.type === 'LINE') { segs.push({ a: e.p1, b: e.p2, b1: 0, ent: e }); used.push(e); }
      else if (e.type === 'ARC') {
        var a = G.polar(e.c, e.a0, e.r), b = G.polar(e.c, e.a1, e.r);
        var sw = e.a1 - e.a0; while (sw < 0) sw += Math.PI * 2;
        segs.push({ a: a, b: b, b1: Math.tan(sw / 4), ent: e });
        used.push(e);
      }
    });
    if (segs.length < 2) { ctx.err('Se necesitan al menos dos líneas o arcos.'); return; }
    var chains = chainSegs(segs, Math.max(tol, 1e-9));
    var good = chains.filter(function (c) { return c.length >= 2; });
    if (!good.length) { ctx.err('Los objetos designados no encadenan.'); return; }
    ctx.doc.mark('CONVERTIRAPOLI');
    var made = 0;
    good.forEach(function (ch) {
      var verts = [], i;
      for (i = 0; i < ch.length; i++) verts.push({ x: ch[i].a.x, y: ch[i].a.y, b: ch[i].b1 });
      var last = ch[ch.length - 1];
      var closed = G.dist(last.b, ch[0].a) <= Math.max(tol, 1e-9);
      if (!closed) verts.push({ x: last.b.x, y: last.b.y, b: 0 });
      var src = ch[0].ent;
      ctx.doc.add(E.pline(verts, closed, { layer: src.layer, color: src.color, ltype: src.ltype, lw: src.lw }));
      ch.forEach(function (s) { ctx.doc.remove(s.ent); });
      made++;
    });
    ctx.app.selSet = [];
    ctx.app.refresh(true);
    ctx.out(made + ' polilínea(s) creada(s) a partir de ' +
            good.reduce(function (s, c) { return s + c.length; }, 0) + ' objeto(s).');
  });

  /* Encadena segmentos por sus extremos, invirtiéndolos si hace falta */
  function chainSegs(segs, tol) {
    var left = segs.slice(), out = [];
    function near(a, b) { return G.dist(a, b) <= tol; }
    while (left.length) {
      var ch = [left.shift()], grew = true;
      while (grew) {
        grew = false;
        for (var i = 0; i < left.length; i++) {
          var s = left[i], tail = ch[ch.length - 1], head = ch[0];
          if (near(tail.b, s.a)) { ch.push(s); }
          else if (near(tail.b, s.b)) { ch.push({ a: s.b, b: s.a, b1: -s.b1, ent: s.ent }); }
          else if (near(head.a, s.b)) { ch.unshift(s); }
          else if (near(head.a, s.a)) { ch.unshift({ a: s.b, b: s.a, b1: -s.b1, ent: s.ent }); }
          else continue;
          left.splice(i, 1);
          grew = true;
          break;
        }
      }
      out.push(ch);
    }
    return out;
  }

  /* ============================================================
     ACOTAREASOCIA — vuelve a asociar cotas a la geometría
     ============================================================ */
  Cmd.add(['ACOTAREASOCIA', 'DIMREASSOCIATE'], { group: 'annot', icon: 'dimlin', title: 'Reasociar cotas' },
  async function (ctx) {
    var sel = await ctx.getSelection('Designe las cotas a reasociar');
    if (!sel || !sel.length) return;
    var dims = sel.filter(function (e) { return e.type === 'DIMENSION'; });
    if (!dims.length) { ctx.err('No se han designado cotas.'); return; }
    var tol = await ctx.getDist('Distancia máxima de búsqueda', { def: 1 });
    if (!num(tol) || tol <= 0) tol = 1;
    ctx.doc.mark('ACOTAREASOCIA');
    var n = 0, m = 0;
    var pool = ctx.doc.visible().filter(function (e) { return e.type !== 'DIMENSION'; });
    dims.forEach(function (d) {
      ['p1', 'p2', 'p3'].forEach(function (key) {
        var p = d[key];
        if (!p) return;
        var best = null, bd = tol;
        pool.forEach(function (e) {
          var sp = E.snapPoints(e, ctx.doc) || [];
          sp.forEach(function (s, i) {
            if (!s.p) return;
            var dd = G.dist(p, s.p);
            if (dd < bd) { bd = dd; best = { id: e.id, type: s.type, i: i }; }
          });
        });
        if (best) {
          ctx.doc.touch(d);
          d.assoc = d.assoc || {};
          d.assoc[key] = best;
          n++;
        } else m++;
      });
    });
    ctx.app.refresh(true);
    ctx.out(n + ' punto(s) de cota reasociado(s)' + (m ? ', ' + m + ' sin geometría cercana' : '') + '.');
  });

  /* ============================================================
     BLOQUEEDIT — redefine un bloque a partir de objetos del dibujo
     ============================================================ */
  Cmd.add(['BLOQUEEDIT', 'BEDIT', 'EDITBLOQUE'], { group: 'insert', icon: 'block', title: 'Editar bloque' },
  async function (ctx) {
    var doc = ctx.doc;
    var names = Object.keys(doc.blocks).filter(function (n) { return n[0] !== '*'; }).sort();
    if (!names.length) { ctx.err('El dibujo no contiene bloques.'); return; }
    var name = await ctx.app.ui.listDialog('Editar definición de bloque', names, names[0]);
    if (!name) return;
    var blk = doc.blocks[name];
    var refs = doc.ents().filter(function (e) { return e.type === 'INSERT' && e.name === name; }).length;
    ctx.out('Bloque "' + name + '": ' + blk.entities.length + ' objeto(s), ' + refs + ' referencia(s) en el dibujo.');
    var k = await ctx.getKeyword('Acción',
      ['Descomponer para editar', 'Redefinir con objetos designados', 'Cambiar punto base', 'Renombrar'],
      { def: 'Descomponer para editar' });
    if (!k) return;
    var m = kw(k);

    if (m === 'D') {
      var p = await ctx.getPoint('Precise dónde colocar una copia editable', { def: { x: 0, y: 0 } });
      if (!pt(p)) return;
      doc.mark('BLOQUEEDIT');
      var mm = G.mMul(G.mTrans(-blk.base.x, -blk.base.y), G.mTrans(p.x, p.y));
      var made = [];
      blk.entities.forEach(function (e) {
        var c = E.deep(e); c.id = 0;
        doc.add(c);
        E.transform(c, mm, doc);
        made.push(c);
      });
      ctx.app.selSet = made;
      ctx.app.refresh(true);
      ctx.out(made.length + ' objeto(s) del bloque puestos en el dibujo. Edítelos y vuelva a ejecutar');
      ctx.out('BLOQUEEDIT ▸ "Redefinir con objetos designados" para actualizar todas las referencias.');
      return;
    }
    if (m === 'R') {
      ctx.app.selSet = [];
      var sel = await ctx.getSelection('Designe los objetos que forman el bloque nuevo', { force: true });
      if (!sel || !sel.length) return;
      var bp = await ctx.getPoint('Precise el punto base');
      if (!pt(bp)) return;
      doc.mark('BLOQUEEDIT');
      blk.entities = sel.map(function (e) {
        var c = E.deep(e); c.id = 0;
        E.transform(c, G.mTrans(-bp.x, -bp.y), null);
        return c;
      });
      var del = await ctx.getKeyword('¿Borrar los objetos designados?', ['Sí', 'No'], { def: 'Sí' });
      if (kw(del) === 'S') sel.forEach(function (e) { doc.remove(e); });
      ctx.app.selSet = [];
      ctx.app.refresh(true);
      ctx.out('Bloque "' + name + '" redefinido. ' + refs + ' referencia(s) actualizada(s).');
      return;
    }
    if (m === 'C') {
      var nb = await ctx.getPoint('Precise el punto base nuevo (en coordenadas del bloque)', { def: blk.base });
      if (!pt(nb)) return;
      doc.mark('BLOQUEEDIT');
      var dx = nb.x - blk.base.x, dy = nb.y - blk.base.y;
      blk.entities.forEach(function (e) { E.transform(e, G.mTrans(-dx, -dy), null); });
      blk.base = { x: nb.x, y: nb.y };
      ctx.app.refresh(true);
      ctx.out('Punto base del bloque "' + name + '" cambiado.');
      return;
    }
    var nn = await ctx.getString('Nombre nuevo del bloque', { def: name });
    if (!nn || nn === name) return;
    if (doc.blocks[nn]) { ctx.err('Ya existe un bloque con ese nombre.'); return; }
    doc.mark('BLOQUEEDIT');
    doc.blocks[nn] = blk;
    blk.name = String(nn);
    delete doc.blocks[name];
    doc.ents().forEach(function (e) {
      if (e.type === 'INSERT' && e.name === name) { doc.touch(e); e.name = String(nn); }
    });
    ctx.app.refresh(true);
    ctx.out('Bloque renombrado a "' + nn + '".');
  });

  /* ============================================================
     REFEDIT — edita en el sitio los objetos de una referencia
     ============================================================ */
  Cmd.add(['REFEDIT', 'EDITREF'], { group: 'insert', icon: 'block', title: 'Editar referencia en el sitio' },
  async function (ctx) {
    var doc = ctx.doc;
    if (ctx.app.refEdit) {
      ctx.err('Ya hay una referencia en edición. Termine con REFCERRAR.');
      return;
    }
    var r = await ctx.getEntity('Designe la referencia a editar');
    if (!r || !r.ent || r.ent.type !== 'INSERT') { ctx.err('Debe designar una referencia a bloque.'); return; }
    var ins = r.ent, blk = doc.blocks[ins.name];
    if (!blk) { ctx.err('No se encuentra la definición del bloque.'); return; }
    doc.mark('REFEDIT');
    var bx = blk.base ? blk.base.x : 0, by = blk.base ? blk.base.y : 0;
    var m = G.mMul(G.mMul(G.mTrans(-bx, -by),
                          G.mScale(ins.sx === undefined ? 1 : ins.sx, ins.sy === undefined ? 1 : ins.sy)),
                   G.mMul(G.mRot(ins.rot || 0), G.mTrans(ins.p.x, ins.p.y)));
    var made = [];
    blk.entities.forEach(function (e) {
      var c = E.deep(e); c.id = 0;
      doc.add(c);
      E.transform(c, m, doc);
      made.push(c);
    });
    doc.remove(ins);
    ctx.app.refEdit = { name: ins.name, ins: ins, ents: made, m: m };
    ctx.app.selSet = made;
    ctx.app.refresh(true);
    ctx.out('Editando "' + ins.name + '" en el sitio: ' + made.length + ' objeto(s).');
    ctx.out('Modifíquelos y ejecute REFCERRAR para guardar o REFDESCARTAR para deshacer.');
  });

  Cmd.add(['REFCERRAR', 'REFCLOSE'], { group: 'insert', icon: 'block', title: 'Guardar edición de referencia' },
  async function (ctx) {
    var re = ctx.app.refEdit;
    if (!re) { ctx.err('No hay ninguna referencia en edición.'); return; }
    var doc = ctx.doc;
    var inv = G.mInv ? G.mInv(re.m) : null;
    if (!inv) { ctx.err('No se puede invertir la transformación de la referencia.'); return; }
    doc.mark('REFCERRAR');
    var blk = doc.blocks[re.name];
    blk.entities = re.ents.filter(function (e) { return doc.ents().indexOf(e) >= 0; })
      .map(function (e) {
        var c = E.deep(e); c.id = 0;
        E.transform(c, inv, null);
        return c;
      });
    re.ents.forEach(function (e) { doc.remove(e); });
    var again = E.deep(re.ins); again.id = 0;
    doc.add(again);
    ctx.app.refEdit = null;
    ctx.app.selSet = [again];
    ctx.app.refresh(true);
    var refs = doc.ents().filter(function (e) { return e.type === 'INSERT' && e.name === re.name; }).length;
    ctx.out('Cambios guardados en "' + re.name + '". ' + refs + ' referencia(s) actualizada(s).');
  });

  Cmd.add(['REFDESCARTAR', 'REFDISCARD'], { group: 'insert', icon: 'block', title: 'Descartar edición de referencia' },
  async function (ctx) {
    var re = ctx.app.refEdit;
    if (!re) { ctx.err('No hay ninguna referencia en edición.'); return; }
    var doc = ctx.doc;
    doc.mark('REFDESCARTAR');
    re.ents.forEach(function (e) { doc.remove(e); });
    var again = E.deep(re.ins); again.id = 0;
    doc.add(again);
    ctx.app.refEdit = null;
    ctx.app.selSet = [];
    ctx.app.refresh(true);
    ctx.out('Edición de "' + re.name + '" descartada.');
  });

  /* ============================================================
     PROYECTAGEOM — proyecta curvas sobre un sólido
     ============================================================ */
  Cmd.add(['PROYECTAGEOM', 'PROJECTGEOMETRY'], { group: '3d', icon: 'flatshot', title: 'Proyectar geometría' },
  async function (ctx) {
    var sel = await ctx.getSelection('Designe las curvas a proyectar');
    if (!sel || !sel.length) return;
    ctx.app.selSet = [];
    var tgt = await ctx.getSelection('Designe el sólido o la superficie de destino', { force: true });
    if (!tgt || !tgt.length) return;
    var sol = tgt.filter(S.is3D);
    if (!sol.length) { ctx.err('El destino debe ser un sólido o una malla.'); return; }
    var k = await ctx.getKeyword('Dirección de proyección', ['Z del SCP', 'Vista'], { def: 'Z del SCP' });
    var dir = G3.v(0, 0, -1);
    if (kw(k) === 'V' && ctx.app.view3d) dir = G3.neg(ctx.app.view3d.cam.dir);
    ctx.doc.mark('PROYECTAGEOM');
    var meshes = sol.map(function (e) { return S.meshOf(e); }).filter(Boolean);
    var box = null;
    meshes.forEach(function (m) { box = G3.boxMerge(box, m.bbox()); });
    var far = G3.boxValid(box) ? G3.boxDiag(box) * 2 + 10 : 1000;
    var made = 0;
    sel.forEach(function (e) {
      var segs = E.segs(e, ctx.doc, 'high');
      if (!segs) return;
      segs.forEach(function (sg) {
        var pts = sg.pts || sg;
        var proj = [];
        for (var i = 0; i < pts.length; i++) {
          var org = G3.add(G3.v(pts[i].x, pts[i].y, pts[i].z || 0), G3.mul(dir, -far));
          var best = null;
          for (var q = 0; q < meshes.length; q++) {
            var h = meshes[q].rayHit(org, dir);
            if (h && (!best || h.t < best.t)) best = h;
          }
          if (best) proj.push({ x: best.p.x, y: best.p.y, z: best.p.z });
        }
        if (proj.length >= 2) {
          var pl = E.pline(proj, !!sg.closed, { layer: e.layer, color: e.color });
          pl.pts3 = proj;
          ctx.doc.add(pl);
          made++;
        }
      });
    });
    if (!made) { ctx.doc.discardTx(); ctx.err('Las curvas no caen sobre el sólido.'); return; }
    ctx.app.refresh(true);
    ctx.out(made + ' curva(s) proyectada(s).');
  });

  /* ============================================================
     NORMALIZAR — endereza la geometría a la rejilla
     ============================================================ */
  Cmd.add(['NORMALIZAR', 'SNAPTOGRID', 'REDONDEAR'], { group: 'modify', icon: 'snapg', title: 'Ajustar a la rejilla' },
  async function (ctx) {
    var sel = await ctx.getSelection('Designe los objetos a ajustar');
    if (!sel || !sel.length) return;
    var step = await ctx.getDist('Precise el paso de redondeo', { def: ctx.doc.vars.SNAPUNIT || 1 });
    if (!num(step) || step <= 0) return;
    var k = await ctx.getKeyword('¿Qué se ajusta?', ['Todo', 'sólo Ángulos', 'sólo Puntos'], { def: 'Todo' });
    var mk = kw(k);
    ctx.doc.mark('NORMALIZAR');
    function q(v) { return Math.round(v / step) * step; }
    var n = 0, moved = 0;
    sel.forEach(function (e) {
      ctx.doc.touch(e);
      var before = JSON.stringify(e);
      if (mk !== 'Á') {
        ['p', 'p1', 'p2', 'p3', 'c'].forEach(function (key) {
          if (e[key] && e[key].x !== undefined) {
            var d = G.dist(e[key], { x: q(e[key].x), y: q(e[key].y) });
            e[key] = { x: q(e[key].x), y: q(e[key].y) };
            if (d > 1e-12) moved++;
          }
        });
        if (e.verts) e.verts = e.verts.map(function (v) {
          return { x: q(v.x), y: q(v.y), b: v.b || 0, sw: v.sw || 0, ew: v.ew || 0 };
        });
        if (e.fit) e.fit = e.fit.map(function (v) { return { x: q(v.x), y: q(v.y) }; });
        if (e.r !== undefined) e.r = Math.max(step * 0.001, q(e.r));
      }
      if (mk !== 'P' && e.type === 'LINE') {
        /* endereza a múltiplos de 90° si está muy cerca */
        var a = G.ang(e.p1, e.p2), L = G.dist(e.p1, e.p2);
        var snapA = Math.round(a / (Math.PI / 2)) * (Math.PI / 2);
        if (Math.abs(G.normAng ? G.normAng(a - snapA) : (a - snapA)) < 0.035) {
          e.p2 = G.polar(e.p1, snapA, L);
        }
      }
      if (JSON.stringify(e) !== before) n++;
    });
    if (!n) { ctx.doc.discardTx(); ctx.out('No hacía falta ajustar nada.'); return; }
    ctx.app.refresh(true);
    ctx.out(n + ' objeto(s) ajustado(s) a múltiplos de ' + G.fmt(step, 4) + '.');
  });

  /* ============================================================
     CONSULTA: ÁNGULO entre dos objetos
     ============================================================ */
  Cmd.add(['ANGULO', 'MEDIRANGULO'], { group: 'inquiry', icon: 'dimang', title: 'Medir ángulo' },
  async function (ctx) {
    var a = await ctx.getEntity('Designe la primera línea o arco'); if (!a || !a.ent) return;
    var b = await ctx.getEntity('Designe la segunda línea o arco'); if (!b || !b.ent) return;
    function dirOf(e) {
      if (e.type === 'LINE') return G.ang(e.p1, e.p2);
      if (e.type === 'LWPOLYLINE' && e.verts.length > 1) return G.ang(e.verts[0], e.verts[1]);
      if (e.type === 'ARC') return e.a0 + Math.PI / 2;
      return null;
    }
    var d1 = dirOf(a.ent), d2 = dirOf(b.ent);
    if (d1 === null || d2 === null) { ctx.err('Los objetos deben ser líneas, polilíneas o arcos.'); return; }
    var dd = d2 - d1;
    while (dd < 0) dd += Math.PI * 2;
    var deg = dd * 180 / Math.PI;
    var agudo = deg > 180 ? 360 - deg : deg;
    if (agudo > 90) agudo = 180 - agudo;
    ctx.out('Ángulo entre los objetos: ' + G.fmt(deg, 4) + '°');
    ctx.out('   suplementario ' + G.fmt(180 - (deg > 180 ? 360 - deg : deg), 4) +
            '°   agudo ' + G.fmt(agudo, 4) + '°');
    var ip = G.interLine ? G.interLine(a.ent.p1 || a.p, a.ent.p2 || a.p, b.ent.p1 || b.p, b.ent.p2 || b.p, true, true) : null;
    if (ip) ctx.out('   se cortan en ' + G.fmt(ip.x, 4) + ', ' + G.fmt(ip.y, 4));
  });

  /* ============================================================
     ESTADÍSTICA del dibujo
     ============================================================ */
  Cmd.add(['ESTADISTICA', 'DWGSTATS', 'RESUMEN'], { group: 'inquiry', icon: 'audit', title: 'Estadística del dibujo' },
  async function (ctx) {
    var doc = ctx.doc;
    var ents = doc.ents();
    var tipos = {}, capas = {}, total3d = 0, vol = 0, long = 0;
    ents.forEach(function (e) {
      tipos[e.type] = (tipos[e.type] || 0) + 1;
      capas[e.layer] = (capas[e.layer] || 0) + 1;
      if (S.is3D(e)) {
        total3d++;
        var m = S.meshOf(e);
        if (m) vol += Math.abs(m.volume());
      } else if (CAD.entLength) long += CAD.entLength(e, doc) || 0;
    });
    ctx.out('=== RESUMEN DEL DIBUJO "' + (doc.name || 'Dibujo1') + '" ===');
    ctx.out('  Objetos:      ' + ents.length + '   (' + total3d + ' sólido(s) 3D)');
    ctx.out('  Capas:        ' + doc.layerOrder.length + '   bloques: ' + Object.keys(doc.blocks).length +
            '   estilos de texto: ' + Object.keys(doc.textStyles).length +
            '   estilos de cota: ' + Object.keys(doc.dimStyles).length);
    ctx.out('  Presentaciones: ' + doc.layouts.length + '   grupos: ' + Object.keys(doc.groups).length);
    ctx.out('  Longitud total de curvas: ' + G.fmt(long, 3));
    if (vol) ctx.out('  Volumen total de sólidos: ' + G.fmt(vol, 3) + ' mm³');
    ctx.out('  Por tipo:');
    Object.keys(tipos).sort(function (a, b) { return tipos[b] - tipos[a]; }).forEach(function (t) {
      ctx.out('     ' + t + ': ' + tipos[t]);
    });
    ctx.out('  Por capa:');
    Object.keys(capas).sort(function (a, b) { return capas[b] - capas[a]; }).slice(0, 12).forEach(function (l) {
      ctx.out('     ' + l + ': ' + capas[l]);
    });
    var b = null;
    ents.forEach(function (e) {
      var x = E.extents(e, doc);
      if (x && isFinite(x.x1)) b = b ? { x1: Math.min(b.x1, x.x1), y1: Math.min(b.y1, x.y1),
                                         x2: Math.max(b.x2, x.x2), y2: Math.max(b.y2, x.y2) } : x;
    });
    if (b) ctx.out('  Extensión: ' + G.fmt(b.x1, 3) + ',' + G.fmt(b.y1, 3) + '  a  ' +
                   G.fmt(b.x2, 3) + ',' + G.fmt(b.y2, 3) +
                   '   (' + G.fmt(b.x2 - b.x1, 3) + ' × ' + G.fmt(b.y2 - b.y1, 3) + ')');
  });
})();
