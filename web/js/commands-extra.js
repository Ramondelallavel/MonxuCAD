/* ============================================================
   commands-extra.js — Multilínea, contornos, matrices avanzadas,
   SCP, vistas, grupos, atributos, espacio papel y utilidades.
   ============================================================ */
(function () {
  'use strict';
  var CAD = window.CAD, G = CAD.G, E = CAD.E, Cmd = CAD.Cmd, CU = CAD.CU;
  var isKw = CU.isKw;
  function pt(v) { return v && v.x !== undefined ? v : null; }

  /* ============================================================
     MULTILÍNEA
     ============================================================ */
  function mlineOffsets(just, scale, n) {
    /* dos elementos por defecto, separados por "scale" */
    var half = scale / 2;
    var base = n === 3 ? [half, 0, -half] : [half, -half];
    if (just === 'T') return base.map(function (v) { return v - half; });
    if (just === 'B') return base.map(function (v) { return v + half; });
    return base;
  }

  function mlineEnts(pts, just, scale, closed, layer, elems) {
    var offs = mlineOffsets(just, scale, elems || 2);
    var out = [];
    offs.forEach(function (o, idx) {
      var line = offsetPolyline(pts, o, closed);
      if (!line || line.length < 2) return;
      var pl = E.pline(line, closed, { layer: layer });
      if (elems === 3 && idx === 1) pl.ltype = 'CENTER';
      out.push(pl);
    });
    if (!closed && out.length >= 2 && pts.length >= 2) {
      var a = out[0].verts, b = out[out.length - 1].verts;
      out.push(E.line({ x: a[0].x, y: a[0].y }, { x: b[0].x, y: b[0].y }, { layer: layer }));
      out.push(E.line({ x: a[a.length - 1].x, y: a[a.length - 1].y }, { x: b[b.length - 1].x, y: b[b.length - 1].y }, { layer: layer }));
    }
    return out;
  }

  function offsetPolyline(pts, d, closed) {
    if (Math.abs(d) < 1e-12) return pts.map(function (p) { return { x: p.x, y: p.y }; });
    var n = pts.length;
    var lines = [];
    for (var i = 0; i < n - (closed ? 0 : 1); i++) {
      var a = pts[i], b = pts[(i + 1) % n];
      if (G.dist(a, b) < 1e-12) continue;
      var dir = G.norm(G.sub(b, a)), nn = { x: -dir.y, y: dir.x };
      lines.push([G.add(a, G.mul(nn, d)), G.add(b, G.mul(nn, d))]);
    }
    if (!lines.length) return null;
    var out = [];
    if (!closed) out.push(lines[0][0]);
    for (var k = 0; k < lines.length - (closed ? 0 : 1); k++) {
      var L1 = lines[k], L2 = lines[(k + 1) % lines.length];
      var ii = G.interLine(L1[0], L1[1], L2[0], L2[1], true, true);
      out.push(ii.length ? { x: ii[0].x, y: ii[0].y } : { x: L1[1].x, y: L1[1].y });
    }
    if (!closed) out.push(lines[lines.length - 1][1]);
    return out;
  }

  Cmd.add(['LINEAM', 'MLINE', 'ML'], { group: 'draw', icon: 'mline', title: 'Multilínea' }, async function (ctx) {
    var app = ctx.app;
    var just = app.mlJust || 'Z', scale = app.mlScale === undefined ? 250 : app.mlScale;
    var elems = app.mlElems || 2;
    var pts = [];
    while (true) {
      ctx.out('Actual: justificación = ' + ({ T: 'Superior', Z: 'Cero', B: 'Inferior' }[just]) +
        ', escala = ' + G.fmt(scale, 2) + ', estilo = ' + (elems === 3 ? 'TRES' : 'ESTANDAR'));
      var p0 = await ctx.getPoint(pts.length ? 'Precise punto siguiente o' : 'Precise punto inicial o', {
        base: pts.length ? pts[pts.length - 1] : null,
        keywords: pts.length >= 2 ? ['Justificación', 'Escala', 'esTilo', 'Cerrar', 'desHacer'] : ['Justificación', 'Escala', 'esTilo'],
        allowNone: pts.length > 0,
        preview: function (c) { return mlineEnts(pts.concat([c]), just, scale, false, ctx.doc.vars.CLAYER, elems); }
      });
      if (p0 === null) break;
      if (isKw(p0)) {
        if (p0.kw === 'J') {
          var j = await ctx.getKeyword('Indique tipo de justificación', ['Superior', 'Cero', 'Inferior'], { def: 'Cero' });
          if (j) { just = j.kw === 'S' ? 'T' : j.kw === 'I' ? 'B' : 'Z'; app.mlJust = just; }
        } else if (p0.kw === 'E') {
          var sc = await ctx.getReal('Indique escala de multilínea', { def: G.fmt(scale, 2) });
          if (typeof sc === 'number') { scale = sc; app.mlScale = sc; }
        } else if (p0.kw === 'T') {
          var st = await ctx.getKeyword('Indique estilo', ['ESTandar', 'TRES elementos'], { def: 'ESTandar' });
          if (st) { elems = st.kw === 'TRE' ? 3 : 2; app.mlElems = elems; }
        } else if (p0.kw === 'C' && pts.length >= 2) {
          ctx.doc.mark('LINEAM');
          mlineEnts(pts, just, scale, true, ctx.doc.vars.CLAYER, elems).forEach(function (e) { ctx.doc.add(e); });
          ctx.app.refresh();
          return;
        } else if (p0.kw === 'H' && pts.length) { pts.pop(); ctx.app.refresh(); }
        continue;
      }
      pts.push(p0);
      ctx.app.refresh();
    }
    if (pts.length < 2) return;
    ctx.doc.mark('LINEAM');
    mlineEnts(pts, just, scale, false, ctx.doc.vars.CLAYER, elems).forEach(function (e) { ctx.doc.add(e); });
    ctx.app.refresh();
  });

  /* ============================================================
     CONTORNO
     ============================================================ */
  Cmd.add(['CONTORNO', 'BOUNDARY', 'BO'], { group: 'draw', icon: 'boundary', title: 'Contorno' }, async function (ctx) {
    ctx.out('Designe puntos internos para crear una polilínea de contorno.');
    var made = 0;
    ctx.doc.mark('CONTORNO');
    while (true) {
      var p = await ctx.getPoint('Designe un punto interno o <salir>', { allowNone: true });
      if (!pt(p)) break;
      var res = CAD.Boundary.trace(ctx.app, p);
      if (res.error) { ctx.err(res.error); continue; }
      res.loops.forEach(function (l) {
        ctx.doc.add(E.pline(l, true, { layer: ctx.doc.vars.CLAYER }));
        made++;
      });
      ctx.out('Contorno creado: ' + made + ' polilínea(s).');
      ctx.app.refresh();
    }
    if (!made) ctx.doc.discardTx();
  });

  /* ============================================================
     MATRICES
     ============================================================ */
  Cmd.add(['MATRIZRECT', 'ARRAYRECT'], { group: 'modify', icon: 'array', title: 'Matriz rectangular' }, async function (ctx) {
    var sel = await ctx.getSelection('Designe objetos');
    if (!sel || !sel.length) return;
    var cfg = await ctx.app.ui.arrayDialog('rect');
    if (!cfg) return;
    ctx.doc.mark('MATRIZRECT');
    var n = 0;
    for (var r = 0; r < cfg.rows; r++) {
      for (var c = 0; c < cfg.cols; c++) {
        if (!r && !c) continue;
        CAD.ghost(ctx, sel, G.mTrans(c * cfg.dx, r * cfg.dy)).forEach(function (e) { ctx.doc.add(e); });
        n++;
      }
    }
    ctx.out(n + ' copia(s) creada(s).');
    ctx.app.refresh();
  });

  Cmd.add(['MATRIZPOLAR', 'ARRAYPOLAR'], { group: 'modify', icon: 'array', title: 'Matriz polar' }, async function (ctx) {
    var sel = await ctx.getSelection('Designe objetos');
    if (!sel || !sel.length) return;
    var center = await ctx.getPoint('Precise centro de matriz');
    if (!pt(center)) return;
    var cfg = await ctx.app.ui.arrayDialog('polar');
    if (!cfg) return;
    ctx.doc.mark('MATRIZPOLAR');
    polarArray(ctx, sel, center, cfg);
    ctx.app.refresh();
  });

  function polarArray(ctx, sel, center, cfg) {
    var total = G.rad(cfg.fill);
    var full = Math.abs(Math.abs(total) - G.TAU) < 1e-6;
    var div = full ? cfg.count : Math.max(1, cfg.count - 1);
    for (var i = 1; i < cfg.count; i++) {
      var ang = (total * i) / div;
      var m;
      if (cfg.rotate) m = G.mRot(ang, center);
      else {
        var b = E.extentsAll(sel, ctx.doc);
        var cc = { x: (b.x1 + b.x2) / 2, y: (b.y1 + b.y2) / 2 };
        var np = G.rotAbout(cc, center, ang);
        m = G.mTrans(np.x - cc.x, np.y - cc.y);
      }
      CAD.ghost(ctx, sel, m).forEach(function (e) { ctx.doc.add(e); });
    }
  }

  Cmd.add(['MATRIZCAMINO', 'ARRAYPATH'], { group: 'modify', icon: 'array', title: 'Matriz de camino' }, async function (ctx) {
    var sel = await ctx.getSelection('Designe objetos');
    if (!sel || !sel.length) return;
    var path = await ctx.getEntity('Designe la curva de camino');
    if (!path) return;
    var pts = CAD.polyOf(ctx, path.ent);
    if (!pts || pts.length < 2) { ctx.err('El objeto designado no sirve como camino.'); return; }
    var total = G.polyLen(pts, false);
    var mode = await ctx.getKeyword('Indique el método de distribución', ['Dividir uniformemente', 'Medir a intervalos'], { def: 'Dividir uniformemente' });
    if (!mode) return;
    var count, step;
    if (mode.kw === 'DU' || mode.kw === 'D') {
      count = await ctx.getInt('Indique número de elementos', { def: 6 });
      if (!count || count < 2) return;
      step = total / (count - 1);
    } else {
      step = await ctx.getReal('Precise distancia entre elementos', { def: G.fmt(total / 6, 2) });
      if (!step || step <= 0) return;
      count = Math.floor(total / step) + 1;
    }
    var align = await ctx.getKeyword('¿Alinear elementos con el camino?', ['Sí', 'No'], { def: 'Sí' });
    var doAlign = !align || align.kw === 'S';
    ctx.doc.mark('MATRIZCAMINO');
    var b = E.extentsAll(sel, ctx.doc);
    var src = { x: (b.x1 + b.x2) / 2, y: (b.y1 + b.y2) / 2 };
    var n = 0;
    for (var i = 1; i < count; i++) {
      var L = step * i;
      if (L > total + 1e-9) break;
      var p = CAD.atLength(pts, L);
      var p2 = CAD.atLength(pts, Math.min(total, L + Math.max(1e-6, total / 1000)));
      var ang = doAlign ? G.ang(p, p2) - (i === 1 ? G.ang(CAD.atLength(pts, 0), CAD.atLength(pts, Math.min(total, total / 1000))) : 0) : 0;
      var m = G.mTrans(p.x - src.x, p.y - src.y);
      if (doAlign) m = G.mMul(G.mRot(G.ang(p, p2), src), m);
      CAD.ghost(ctx, sel, m).forEach(function (e) { ctx.doc.add(e); });
      n++;
    }
    ctx.out(n + ' elemento(s) distribuido(s) a lo largo del camino.');
    ctx.app.refresh();
  });

  /* ============================================================
     ESTILOS DE TEXTO
     ============================================================ */
  Cmd.add(['ESTILO', 'STYLE', 'ST'], { group: 'annot', icon: 'textstyle', title: 'Estilo de texto' }, async function (ctx) {
    await ctx.app.ui.textStyleDialog();
    ctx.app.refresh();
  });

  Cmd.add(['RENOMBRA', 'RENAME', 'REN'], { group: 'settings', title: 'Renombrar' }, async function (ctx) {
    var r = await ctx.app.ui.renameDialog();
    if (r) ctx.app.refresh();
  });

  /* ============================================================
     SCP
     ============================================================ */
  Cmd.add(['SCP', 'UCS'], { group: 'view', icon: 'ucs', title: 'SCP' }, async function (ctx) {
    var doc = ctx.doc, app = ctx.app;
    var opt = await ctx.getPoint('Precise origen de SCP o', {
      keywords: ['Cara', 'Objeto', 'Previo', 'Vista', 'Global', 'Girar Z', '3 puntos'],
      def: 'Global'
    });
    function save() {
      app.ucsPrev = { org: { x: doc.vars.UCSORG.x, y: doc.vars.UCSORG.y }, ang: doc.vars.UCSANG };
    }
    if (opt === null || (isKw(opt) && (opt.kw === 'G'))) {
      save();
      doc.vars.UCSORG = { x: 0, y: 0 }; doc.vars.UCSANG = 0;
      ctx.out('SCP global restablecido.');
      app.refresh(); return;
    }
    if (isKw(opt)) {
      if (opt.kw === 'P') {
        if (app.ucsPrev) { doc.vars.UCSORG = app.ucsPrev.org; doc.vars.UCSANG = app.ucsPrev.ang; ctx.out('SCP anterior restablecido.'); }
        app.refresh(); return;
      }
      if (opt.kw === 'GZ') {
        var a = await ctx.getAngle('Precise ángulo de rotación alrededor del eje Z', { def: 0, base: doc.vars.UCSORG });
        if (typeof a !== 'number') return;
        save();
        doc.vars.UCSANG = (doc.vars.UCSANG || 0) + a;
        app.refresh(); return;
      }
      if (opt.kw === 'O') {
        var e = await ctx.getEntity('Designe un objeto para alinear el SCP');
        if (!e) return;
        save();
        var ent = e.ent;
        if (ent.type === 'LINE') { doc.vars.UCSORG = { x: ent.p1.x, y: ent.p1.y }; doc.vars.UCSANG = G.ang(ent.p1, ent.p2); }
        else if (ent.type === 'CIRCLE' || ent.type === 'ARC') { doc.vars.UCSORG = { x: ent.c.x, y: ent.c.y }; doc.vars.UCSANG = 0; }
        else if (ent.type === 'LWPOLYLINE' && ent.verts.length > 1) {
          doc.vars.UCSORG = { x: ent.verts[0].x, y: ent.verts[0].y };
          doc.vars.UCSANG = G.ang(ent.verts[0], ent.verts[1]);
        } else if (ent.p) { doc.vars.UCSORG = { x: ent.p.x, y: ent.p.y }; doc.vars.UCSANG = ent.rot || 0; }
        app.refresh(); return;
      }
      if (opt.kw === '3P' || opt.kw === '3') {
        var o3 = await ctx.getPoint('Precise nuevo punto de origen'); if (!pt(o3)) return;
        var x3 = await ctx.getPoint('Precise punto en la parte positiva del eje X', { base: o3 }); if (!pt(x3)) return;
        save();
        doc.vars.UCSORG = { x: o3.x, y: o3.y };
        doc.vars.UCSANG = G.ang(o3, x3);
        app.refresh(); return;
      }
      if (opt.kw === 'V') {
        save(); doc.vars.UCSANG = 0; app.refresh(); return;
      }
      return;
    }
    if (!opt || !isFinite(opt.x) || !isFinite(opt.y)) { ctx.err('Punto no válido para el origen del SCP.'); return; }
    save();
    doc.vars.UCSORG = { x: opt.x, y: opt.y };
    ctx.out('Origen del SCP trasladado.');
    app.refresh();
  });

  Cmd.add(['SCPGLOBAL', 'UCSWORLD', 'SCPG'], { group: 'view', title: 'SCP global' }, async function (ctx) {
    ctx.doc.vars.UCSORG = { x: 0, y: 0 };
    ctx.doc.vars.UCSANG = 0;
    ctx.out('SCP global restablecido.');
    ctx.app.refresh();
  });

  /* ============================================================
     VISTAS GUARDADAS
     ============================================================ */
  Cmd.add(['VISTA', 'VIEW', 'V'], { group: 'view', icon: 'view', title: 'Vistas guardadas' }, async function (ctx) {
    var app = ctx.app;
    app.views = app.views || {};
    var r = await ctx.app.ui.viewDialog(app.views);
    if (!r) return;
    if (r.action === 'save') {
      app.views[r.name] = { cx: app.r.view.cx, cy: app.r.view.cy, zoom: app.r.view.zoom };
      ctx.out('Vista "' + r.name + '" guardada.');
    } else if (r.action === 'restore' && app.views[r.name]) {
      app.r.pushView();
      Object.assign(app.r.view, app.views[r.name]);
      ctx.out('Restableciendo vista "' + r.name + '".');
      app.refresh();
    } else if (r.action === 'delete') {
      delete app.views[r.name];
    }
  });

  /* ============================================================
     GRUPOS
     ============================================================ */
  Cmd.add(['GRUPO', 'GROUP', 'G'], { group: 'edit', icon: 'group', title: 'Grupo' }, async function (ctx) {
    var sel = await ctx.getSelection('Designe objetos para agrupar');
    if (!sel || !sel.length) return;
    var name = await ctx.app.ui.promptDialog('Agrupar', 'Nombre del grupo:', 'GRUPO' + (Object.keys(ctx.doc.groups).length + 1));
    if (!name) return;
    ctx.doc.mark('GRUPO');
    ctx.doc.groups[name] = sel.map(function (e) { return e.id; });
    sel.forEach(function (e) { e.group = name; });
    ctx.out('Grupo "' + name + '" creado con ' + sel.length + ' objeto(s).');
    ctx.app.selSet = [];
    ctx.app.refresh();
  });

  Cmd.add(['DESAGRUPA', 'UNGROUP'], { group: 'edit', title: 'Desagrupar' }, async function (ctx) {
    var sel = await ctx.getSelection('Designe un objeto del grupo');
    if (!sel || !sel.length) return;
    var name = sel[0].group;
    if (!name) { ctx.err('El objeto no pertenece a ningún grupo.'); return; }
    ctx.doc.mark('DESAGRUPA');
    ctx.doc.entities.forEach(function (e) { if (e.group === name) delete e.group; });
    delete ctx.doc.groups[name];
    ctx.out('Grupo "' + name + '" deshecho.');
    ctx.app.refresh();
  });

  /* ============================================================
     EDITAR SOMBREADO
     ============================================================ */
  Cmd.add(['EDITSOMB', 'HATCHEDIT', 'HE'], { group: 'draw', icon: 'hatch', title: 'Editar sombreado' }, async function (ctx) {
    var e = await ctx.getEntity('Designe un objeto de sombreado', {
      filter: function (x) { return x.type === 'HATCH'; }
    });
    if (!e) return;
    var h = e.ent;
    var cfg = await ctx.app.ui.hatchDialog({
      pattern: h.pattern, scale: h.scale, angle: G.deg(h.angle), transparency: h.transparency || 0, edit: true
    });
    if (!cfg) return;
    ctx.doc.mark('EDITSOMB');
    h.pattern = cfg.pattern;
    h.solid = CAD.HatchLib.isSolid(cfg.pattern);
    h.scale = cfg.scale;
    h.angle = G.rad(cfg.angle);
    h.transparency = cfg.transparency || 0;
    ctx.app.refresh();
  });

  Cmd.add(['DEGRADADO', 'GRADIENT'], { group: 'draw', icon: 'hatch', title: 'Degradado' }, async function (ctx) {
    var cols = await ctx.app.ui.gradientDialog();
    if (!cols) return;
    ctx.out('Designe un punto interno.');
    var p = await ctx.getPoint('Designe un punto interno');
    if (!pt(p)) return;
    var res = CAD.Boundary.trace(ctx.app, p);
    if (res.error) { ctx.err(res.error); return; }
    ctx.doc.mark('DEGRADADO');
    var h = E.hatch(res.loops, { layer: ctx.doc.vars.CLAYER });
    h.gradient = [cols.a, cols.b];
    h.pattern = 'SOLID';
    ctx.doc.add(h);
    ctx.app.refresh();
  });

  Cmd.add(['CARGAPAT', 'LOADPAT'], { group: 'draw', title: 'Cargar archivo .pat' }, async function (ctx) {
    var txt = await ctx.app.ui.patDialog();
    if (!txt) return;
    var added = CAD.HatchLib.load(txt.text, txt.mm);
    if (!added.length) { ctx.err('No se ha reconocido ningún patrón en el archivo.'); return; }
    ctx.out(added.length + ' patrón(es) cargado(s): ' + added.slice(0, 12).join(', ') + (added.length > 12 ? '…' : ''), 'ok');
  });

  /* ============================================================
     ACOTACIÓN AVANZADA
     ============================================================ */
  Cmd.add(['MARCACENTRO', 'CENTERMARK', 'DIMCENTER'], { group: 'dim', icon: 'centermark', title: 'Marca de centro' }, async function (ctx) {
    var e = await ctx.getEntity('Designe arco o círculo', {
      filter: function (x) { return x.type === 'ARC' || x.type === 'CIRCLE'; }
    });
    if (!e) return;
    var lines = await ctx.getKeyword('Tipo de marca', ['Marca', 'Líneas de centro'], { def: 'Líneas de centro' });
    ctx.doc.mark('MARCACENTRO');
    var d = E.dim('centermark', {
      center: { x: e.ent.c.x, y: e.ent.c.y }, radius: e.ent.r,
      lines: !lines || lines.kw === 'LDC' || lines.kw === 'L',
      layer: ctx.doc.vars.CLAYER
    });
    d.style = ctx.doc.vars.DIMSTYLE;
    ctx.doc.add(d);
    ctx.app.refresh();
  });

  Cmd.add(['ACOTARAPIDA', 'QDIM'], { group: 'dim', icon: 'dimcont', title: 'Acotación rápida' }, async function (ctx) {
    var sel = await ctx.getSelection('Designe la geometría a acotar');
    if (!sel || !sel.length) return;
    var mode = await ctx.getKeyword('Precise posición de la línea de cota o', ['Continua', 'Línea base', 'Coordenada'], { def: 'Continua' });
    if (!mode) return;
    /* recoge los puntos notables y los ordena */
    var pts = [];
    sel.forEach(function (e) {
      E.snapPoints(e, ctx.doc).forEach(function (s) { if (s.type === 'end') pts.push(s.p); });
    });
    if (pts.length < 2) { ctx.err('No hay suficientes puntos para acotar.'); return; }
    var b = E.extentsAll(sel, ctx.doc);
    var horiz = (b.x2 - b.x1) >= (b.y2 - b.y1);
    var key = horiz ? 'x' : 'y';
    var uniq = [];
    pts.sort(function (a, c) { return a[key] - c[key]; }).forEach(function (p) {
      if (!uniq.length || Math.abs(uniq[uniq.length - 1][key] - p[key]) > 1e-6) uniq.push(p);
    });
    if (uniq.length < 2) { ctx.err('No hay suficientes puntos distintos.'); return; }
    var loc = await ctx.getPoint('Precise ubicación de la línea de cota', {
      preview: function (c) { return qdimEnts(ctx, uniq, horiz, c, mode.kw); }
    });
    if (!pt(loc)) return;
    ctx.doc.mark('ACOTARAPIDA');
    qdimEnts(ctx, uniq, horiz, loc, mode.kw).forEach(function (d) { ctx.doc.add(d); CAD.Dim.build(d, ctx.doc); });
    ctx.app.selSet = [];
    ctx.app.refresh();
  });

  function qdimEnts(ctx, uniq, horiz, loc, mode) {
    var out = [];
    var rot = horiz ? 0 : Math.PI / 2;
    var st = ctx.doc.dimStyles[ctx.doc.vars.DIMSTYLE] || {};
    var dli = (st.DIMDLI || 3.75) * (st.DIMSCALE || 1) * (ctx.doc.vars.DIMSCALE || 1);
    for (var i = 1; i < uniq.length; i++) {
      var p1 = mode === 'LB' || mode === 'L' ? uniq[0] : uniq[i - 1];
      var p3 = { x: loc.x, y: loc.y };
      if (mode === 'LB' || mode === 'L') {
        var n = horiz ? { x: 0, y: 1 } : { x: 1, y: 0 };
        p3 = { x: loc.x + n.x * dli * (i - 1), y: loc.y + n.y * dli * (i - 1) };
      }
      var d = E.dim('linear', { p1: p1, p2: uniq[i], p3: p3, rot: rot, layer: ctx.doc.vars.CLAYER });
      d.style = ctx.doc.vars.DIMSTYLE;
      out.push(d);
    }
    return out;
  }

  Cmd.add(['ACOTAEDIC', 'DIMEDIT', 'DED'], { group: 'dim', title: 'Editar cota' }, async function (ctx) {
    var opt = await ctx.getKeyword('Indique tipo de edición de cota', ['Inicio', 'Nuevo', 'Girar', 'Oblicuo'], { def: 'Inicio' });
    if (!opt) return;
    var sel = await ctx.getSelection('Designe objetos', { force: true });
    if (!sel || !sel.length) return;
    var dims = sel.filter(function (e) { return e.type === 'DIMENSION'; });
    if (!dims.length) { ctx.err('No se han designado cotas.'); return; }
    ctx.doc.mark('ACOTAEDIC');
    if (opt.kw === 'I') dims.forEach(function (d) { d.textPos = null; d.textAngle = 0; });
    else if (opt.kw === 'N') {
      var t = await ctx.getString('Indique el nuevo texto de cota (<> = medida)', { allowNone: true });
      if (t !== null) dims.forEach(function (d) { d.textOverride = t; });
    } else if (opt.kw === 'G') {
      var a = await ctx.getAngle('Precise ángulo para el texto de cota', { def: 0 });
      if (typeof a === 'number') dims.forEach(function (d) { d.textAngle = a; });
    } else if (opt.kw === 'O') {
      var ob = await ctx.getAngle('Indique ángulo oblicuo', { def: 0 });
      if (typeof ob === 'number') dims.forEach(function (d) { if (d.kind === 'linear') d.rot = ob; });
    }
    ctx.app.selSet = [];
    ctx.app.refresh();
  });

  Cmd.add(['ACOTATEDIC', 'DIMTEDIT', 'DIMTED'], { group: 'dim', title: 'Mover texto de cota' }, async function (ctx) {
    var e = await ctx.getEntity('Designe la cota', { filter: function (x) { return x.type === 'DIMENSION'; } });
    if (!e) return;
    var p = await ctx.getPoint('Precise nueva ubicación del texto o', {
      keywords: ['Izquierda', 'Derecha', 'Centro', 'Inicio'],
      preview: function (c) { var d = E.deep(e.ent); d.textPos = c; return [d]; }
    });
    ctx.doc.mark('ACOTATEDIC');
    if (isKw(p)) { e.ent.textPos = null; }
    else if (pt(p)) e.ent.textPos = { x: p.x, y: p.y };
    ctx.app.refresh();
  });

  /* ============================================================
     ATRIBUTOS
     ============================================================ */
  Cmd.add(['ATRDEF', 'ATTDEF', 'ATT'], { group: 'block', icon: 'attdef', title: 'Definir atributo' }, async function (ctx) {
    var cfg = await ctx.app.ui.attdefDialog();
    if (!cfg) return;
    var p = await ctx.getPoint('Precise punto inicial', {
      preview: function (c) {
        var a = E.attdef(c, cfg.h, cfg.tag, cfg.prompt, cfg.def, { layer: ctx.doc.vars.CLAYER });
        return [a];
      }
    });
    if (!pt(p)) return;
    ctx.doc.mark('ATRDEF');
    var a = E.attdef(p, cfg.h, cfg.tag, cfg.prompt, cfg.def, { layer: ctx.doc.vars.CLAYER });
    a.rot = G.rad(cfg.rot || 0);
    a.style = ctx.doc.vars.TEXTSTYLE;
    ctx.doc.add(a);
    ctx.app.refresh();
  });

  Cmd.add(['EDITATR', 'ATTEDIT', 'ATE', 'EATTEDIT'], { group: 'block', icon: 'attdef', title: 'Editar atributos' }, async function (ctx) {
    var e = await ctx.getEntity('Designe una referencia de bloque', {
      filter: function (x) { return x.type === 'INSERT'; }
    });
    if (!e) return;
    var ins = e.ent;
    if (!ins.attribs || !ins.attribs.length) { ctx.err('El bloque no tiene atributos.'); return; }
    var vals = await ctx.app.ui.attribDialog(ins.name, ins.attribs.map(function (a) {
      return { tag: a.tag, prompt: a.prompt || a.tag, value: a.text };
    }));
    if (!vals) return;
    ctx.doc.mark('EDITATR');
    ins.attribs.forEach(function (a, i) { a.text = vals[i]; });
    ctx.app.refresh();
  });

  /* ============================================================
     ESPACIO PAPEL
     ============================================================ */
  Cmd.add(['VENTANAS', 'MVIEW', 'MV'], { group: 'layout', icon: 'mview', title: 'Ventana gráfica' }, async function (ctx) {
    var app = ctx.app;
    if (!app.paperMode) { ctx.err('**  El comando sólo es válido en una presentación  **'); return; }
    if (app.activeVp) app.exitVp();
    var lay = app.layout;
    var p1 = await ctx.getPoint('Precise esquina de ventana o', { keywords: ['Ajustar', '2', '3', '4'] });
    if (p1 === null) return;
    var rect;
    if (isKw(p1)) {
      var m = lay.margin || 10;
      rect = { x: m, y: m, w: lay.w - 2 * m, h: lay.h - 2 * m };
    } else {
      var p2 = await ctx.getCorner('Precise esquina opuesta', p1);
      if (!pt(p2)) return;
      rect = {
        x: Math.min(p1.x, p2.x), y: Math.min(p1.y, p2.y),
        w: Math.abs(p2.x - p1.x), h: Math.abs(p2.y - p1.y)
      };
    }
    if (rect.w < 5 || rect.h < 5) { ctx.err('La ventana es demasiado pequeña.'); return; }
    ctx.doc.mark('VENTANAS');
    var b = E.extentsAll(ctx.doc.entities, ctx.doc);
    if (!G.bboxValid(b)) b = { x1: 0, y1: 0, x2: 100, y2: 100 };
    var sc = Math.min(rect.w / Math.max(1e-6, b.x2 - b.x1), rect.h / Math.max(1e-6, b.y2 - b.y1)) * 0.92;
    lay.viewports.push({
      x: rect.x, y: rect.y, w: rect.w, h: rect.h,
      cx: (b.x1 + b.x2) / 2, cy: (b.y1 + b.y2) / 2,
      scale: sc, locked: false, on: true, frozen: []
    });
    ctx.out('Ventana creada. Escala 1:' + G.fmt(1 / sc, 2) + '. Doble clic dentro para editar el modelo.');
    app.refresh();
  });

  Cmd.add(['ESPACIOM', 'MSPACE', 'MS'], { group: 'layout', title: 'Espacio modelo en ventana' }, async function (ctx) {
    var app = ctx.app;
    if (!app.paperMode) { ctx.err('**  El comando sólo es válido en una presentación  **'); return; }
    var vps = app.layout.viewports.filter(function (v) { return v.on !== false; });
    if (!vps.length) { ctx.err('No hay ninguna ventana gráfica activa.'); return; }
    app.enterVp(vps[0]);
    ctx.out('Espacio modelo dentro de la ventana.');
  });

  Cmd.add(['ESPACIOP', 'PSPACE', 'PS'], { group: 'layout', title: 'Espacio papel' }, async function (ctx) {
    var app = ctx.app;
    if (!app.paperMode) { ctx.err('**  El comando sólo es válido en una presentación  **'); return; }
    app.exitVp();
    ctx.out('Espacio papel.');
  });

  Cmd.add(['ESCALAVP', 'VPSCALE', 'ZOOMXP'], { group: 'layout', title: 'Escala de ventana' }, async function (ctx) {
    var app = ctx.app;
    if (!app.paperMode) { ctx.err('**  El comando sólo es válido en una presentación  **'); return; }
    var vp = app.activeVp || (app.layout.viewports || [])[0];
    if (!vp) { ctx.err('No hay ninguna ventana gráfica.'); return; }
    var r = await ctx.app.ui.vpScaleDialog(vp);
    if (!r) return;
    ctx.doc.mark('ESCALAVP');
    vp.scale = r.scale;
    vp.locked = r.locked;
    ctx.out('Escala de ventana 1:' + G.fmt(1 / r.scale, 2));
    app.refresh();
  });

  Cmd.add(['PRESENTACION', 'LAYOUT'], { group: 'layout', icon: 'layout', title: 'Presentaciones' }, async function (ctx) {
    var r = await ctx.app.ui.layoutDialog();
    if (r) { ctx.app.ui.buildLayoutTabs(); ctx.app.refresh(); }
  });

  Cmd.add(['CONFIGPAG', 'PAGESETUP'], { group: 'layout', title: 'Configurar página' }, async function (ctx) {
    if (!ctx.app.paperMode) { ctx.err('**  El comando sólo es válido en una presentación  **'); return; }
    var r = await ctx.app.ui.pageSetupDialog(ctx.app.layout);
    if (r) { ctx.app.setLayout(ctx.app.layoutIndex); ctx.app.refresh(); }
  });

  Cmd.add(['CAJETIN', 'TITLEBLOCK'], { group: 'layout', icon: 'block', title: 'Insertar cajetín' }, async function (ctx) {
    var app = ctx.app;
    if (!app.paperMode) { ctx.err('Cambie a una presentación para insertar el cajetín.'); return; }
    var lay = app.layout;
    var name = lay.w >= 400 ? 'CAJETIN-A3' : 'CAJETIN-A4';
    CAD.Blocks.ensure(ctx.doc, name);
    var blk = ctx.doc.blocks[name];
    if (!blk) { ctx.err('No se encontró el cajetín.'); return; }
    var bb = E.extentsAll(blk.entities, ctx.doc);
    var m = lay.margin || 10;
    var p = { x: lay.w - m - (bb.x2 - bb.x1), y: m };
    ctx.doc.mark('CAJETIN');
    var ins = E.insert(name, p, { layer: ctx.doc.vars.CLAYER });
    ins.attribs = blk.entities.filter(function (e) { return e.type === 'ATTDEF'; }).map(function (a) {
      var at = E.attrib({ x: a.p.x, y: a.p.y }, a.h, a.tag, a.def, { layer: a.layer });
      at.rot = a.rot; at.halign = a.halign; at.valign = a.valign; at.p2 = a.p2; at.prompt = a.prompt;
      return at;
    });
    var vals = await ctx.app.ui.attribDialog(name, ins.attribs.map(function (a) {
      return { tag: a.tag, prompt: a.prompt || a.tag, value: a.text };
    }));
    if (vals) ins.attribs.forEach(function (a, i) { a.text = vals[i]; });
    ctx.doc.add(ins);
    app.refresh();
  });

  /* ============================================================
     UTILIDADES
     ============================================================ */
  Cmd.add(['AUDITORIA', 'AUDIT'], { group: 'file', title: 'Auditoría' }, async function (ctx) {
    var doc = ctx.doc, errs = [], fixed = 0;
    var seen = {};
    doc.entities.forEach(function (e) {
      if (!doc.layers[e.layer]) { errs.push('Capa inexistente "' + e.layer + '" en objeto ' + e.id); doc.addLayer({ name: e.layer }); fixed++; }
      if (seen[e.id]) { errs.push('Identificador duplicado ' + e.id); e.id = doc.newId(); fixed++; }
      seen[e.id] = 1;
      if (e.type === 'INSERT' && !doc.blocks[e.name]) { errs.push('Bloque inexistente "' + e.name + '"'); }
      if (e.type === 'CIRCLE' && !(e.r > 0)) { errs.push('Círculo con radio no válido'); e.r = 1; fixed++; }
      if (e.type === 'LWPOLYLINE' && e.verts.length < 2) { errs.push('Polilínea con menos de 2 vértices'); }
      if (e.type === 'TEXT' && !(e.h > 0)) { errs.push('Texto con altura no válida'); e.h = doc.vars.TEXTSIZE; fixed++; }
    });
    ctx.app.ui.textWindow('Auditoría del dibujo',
      'Se han examinado ' + doc.entities.length + ' objeto(s), ' + doc.layerOrder.length + ' capa(s) y ' +
      Object.keys(doc.blocks).length + ' bloque(s).\n\n' +
      (errs.length ? errs.join('\n') + '\n\n' : 'No se han encontrado errores.\n\n') +
      'Total de errores encontrados: ' + errs.length + '\nErrores corregidos: ' + fixed);
    if (fixed) ctx.app.refresh();
  });

  Cmd.add(['ESTADO', 'STATUS'], { group: 'inquiry', title: 'Estado del dibujo' }, async function (ctx) {
    var doc = ctx.doc, app = ctx.app;
    var b = E.extentsAll(doc.entities, doc);
    var f = function (v) { return G.fmt(v, 4); };
    var counts = {};
    doc.entities.forEach(function (e) { counts[e.type] = (counts[e.type] || 0) + 1; });
    var lines = [
      doc.entities.length + ' objetos en ' + doc.name,
      '',
      'Límites del dibujo:   X: ' + f(doc.vars.LIMMIN.x) + '  Y: ' + f(doc.vars.LIMMIN.y),
      '                      X: ' + f(doc.vars.LIMMAX.x) + '  Y: ' + f(doc.vars.LIMMAX.y),
      'Extensión del dibujo: X: ' + f(b.x1) + '  Y: ' + f(b.y1),
      '                      X: ' + f(b.x2) + '  Y: ' + f(b.y2),
      'Extensión de pantalla:X: ' + f(app.r.s2w({ x: 0, y: app.r.H }).x) + '  Y: ' + f(app.r.s2w({ x: 0, y: app.r.H }).y),
      '',
      'Capa actual:          ' + doc.vars.CLAYER,
      'Color actual:         ' + (doc.vars.CECOLOR === 256 ? 'POR CAPA' : doc.vars.CECOLOR),
      'Tipo de línea actual: ' + doc.vars.CELTYPE,
      'Estilo de texto:      ' + doc.vars.TEXTSTYLE + '   altura ' + f(doc.vars.TEXTSIZE),
      'Estilo de cota:       ' + doc.vars.DIMSTYLE + '   escala ' + f(doc.vars.DIMSCALE),
      'Escala de tipo línea: ' + f(doc.vars.LTSCALE),
      '',
      'Modos:  Rejilla ' + (doc.vars.GRIDMODE ? 'ACT' : 'DES') +
      '  Forzcursor ' + (doc.vars.SNAPMODE ? 'ACT' : 'DES') +
      '  Orto ' + (doc.vars.ORTHOMODE ? 'ACT' : 'DES') +
      '  Refent ' + (app.osnapOn ? 'ACT' : 'DES'),
      '',
      'Recuento por tipo:'
    ];
    Object.keys(counts).sort().forEach(function (k) {
      lines.push('   ' + k.padEnd(14) + counts[k]);
    });
    lines.push('', 'Bloques definidos:    ' + Object.keys(doc.blocks).length);
    lines.push('Presentaciones:       ' + doc.layouts.length);
    ctx.app.ui.textWindow('Estado', lines.join('\n'));
  });

  Cmd.add(['TIEMPO', 'TIME'], { group: 'inquiry', title: 'Tiempo de sesión' }, async function (ctx) {
    var app = ctx.app;
    var ms = Date.now() - (app.startedAt || Date.now());
    function hhmmss(t) {
      var s = Math.floor(t / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
      return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    }
    ctx.app.ui.textWindow('Tiempo', [
      'Hora actual:                 ' + new Date().toLocaleString('es-ES'),
      '',
      'Creación del dibujo:         ' + new Date(app.startedAt).toLocaleString('es-ES'),
      'Tiempo de edición acumulado: ' + hhmmss(ms),
      'Temporizador transcurrido:   ' + hhmmss(ms),
      '',
      'Objetos creados en la sesión: ' + (ctx.doc.nextId - 1)
    ].join('\n'));
  });

  Cmd.add(['ORDENAOBJETOS', 'DRAWORDER', 'DR'], { group: 'edit', title: 'Orden de objetos' }, async function (ctx) {
    var sel = await ctx.getSelection('Designe objetos');
    if (!sel || !sel.length) return;
    var o = await ctx.getKeyword('Indique una opción', ['Encima de todo', 'Debajo de todo'], { def: 'Encima de todo' });
    if (!o) return;
    ctx.doc.mark('ORDENAOBJETOS');
    var list = ctx.doc.ents();
    ctx.doc.touchOrder(list);
    sel.forEach(function (e) {
      var i = list.indexOf(e);
      if (i >= 0) list.splice(i, 1);
    });
    if (o.kw === 'EDT' || o.kw === 'E') sel.forEach(function (e) { list.push(e); });
    else sel.slice().reverse().forEach(function (e) { list.unshift(e); });
    ctx.doc.rev++;               /* si no, el dibujo no se repinta */
    ctx.app.refresh(true);
    ctx.out(sel.length + ' objeto(s) ' + (o.kw === 'EDT' || o.kw === 'E' ? 'encima de todo.' : 'debajo de todo.'));
  });

  Cmd.add(['MEDIRGEOM', 'MEASUREGEOM', 'MEA'], { group: 'inquiry', icon: 'dist', title: 'Medir geometría', transparent: true }, async function (ctx) {
    var o = await ctx.getKeyword('Indique una opción', ['Distancia', 'Radio', 'Ángulo', 'áRea'], { def: 'Distancia' });
    if (!o) return;
    var pr = ctx.doc.vars.LUPREC;
    if (o.kw === 'D') { ctx.app.startCommand('DISTANCIA'); return; }
    if (o.kw === 'R') {
      var e = await ctx.getEntity('Designe arco o círculo', { filter: function (x) { return x.type === 'ARC' || x.type === 'CIRCLE'; } });
      if (!e) return;
      ctx.out('Radio = ' + G.fmt(e.ent.r, pr) + '   Diámetro = ' + G.fmt(e.ent.r * 2, pr));
      ctx.app.ui.flashResult('Radio = ' + G.fmt(e.ent.r, pr));
      return;
    }
    if (o.kw === 'A') {
      var v = await ctx.getPoint('Precise vértice del ángulo'); if (!pt(v)) return;
      var a1 = await ctx.getPoint('Precise primer extremo', { base: v }); if (!pt(a1)) return;
      var a2 = await ctx.getPoint('Precise segundo extremo', { base: v }); if (!pt(a2)) return;
      var ang = G.deg(G.sweep(G.ang(v, a1), G.ang(v, a2)));
      ctx.out('Ángulo = ' + G.fmt(ang, 2) + '°');
      ctx.app.ui.flashResult('Ángulo = ' + G.fmt(ang, 2) + '°');
      return;
    }
    ctx.app.startCommand('AREA');
  });

  Cmd.add(['REGENTODO', 'REGENALL', 'REA'], { group: 'view', title: 'Regenerar todo' }, async function (ctx) {
    ctx.out('Regenerando modelo y presentaciones.');
    ctx.app.refresh(true);
  });

  Cmd.add(['COPIABASE', 'COPYBASE'], { group: 'edit', title: 'Copiar con punto base' }, async function (ctx) {
    var base = await ctx.getPoint('Precise punto base');
    if (!pt(base)) return;
    var sel = await ctx.getSelection('Designe objetos', { force: true });
    if (!sel || !sel.length) return;
    CAD.clipboard = { base: { x: base.x, y: base.y }, ents: sel.map(E.copyEnt) };
    ctx.out(sel.length + ' objeto(s) copiado(s) al Portapapeles.');
    ctx.app.selSet = [];
    ctx.app.refresh();
  });

  Cmd.add(['PEGARBLOQUE', 'PASTEBLOCK'], { group: 'edit', title: 'Pegar como bloque' }, async function (ctx) {
    if (!CAD.clipboard || !CAD.clipboard.ents.length) { ctx.err('El Portapapeles está vacío.'); return; }
    var cb = CAD.clipboard, doc = ctx.doc;
    var p = await ctx.getPoint('Precise punto de inserción');
    if (!pt(p)) return;
    doc.mark('PEGARBLOQUE');
    var name = 'A$C' + Date.now().toString(36).toUpperCase();
    doc.blocks[name] = {
      name: name, base: { x: 0, y: 0 },
      entities: cb.ents.map(function (e) {
        var c = E.copyEnt(e);
        E.transform(c, G.mTrans(-cb.base.x, -cb.base.y), doc);
        return c;
      })
    };
    var ins = E.insert(name, p, { layer: doc.vars.CLAYER });
    doc.add(ins);
    ctx.app.selSet = [ins];
    ctx.app.refresh();
  });

  CAD.attachAttribs = async function (ctx, ins, blk) {
    var defs = (blk.entities || []).filter(function (e) { return e.type === 'ATTDEF'; });
    if (!defs.length) return;
    ins.attribs = defs.map(function (a) {
      var at = E.attrib({ x: a.p.x, y: a.p.y }, a.h, a.tag, a.def, { layer: a.layer, color: a.color });
      at.rot = a.rot; at.halign = a.halign; at.valign = a.valign;
      at.p2 = a.p2 ? { x: a.p2.x, y: a.p2.y } : null;
      at.prompt = a.prompt; at.style = a.style;
      return at;
    });
    var vals = await ctx.app.ui.attribDialog(blk.name, ins.attribs.map(function (a) {
      return { tag: a.tag, prompt: a.prompt || a.tag, value: a.text };
    }));
    if (vals) ins.attribs.forEach(function (a, i) { a.text = vals[i]; });
  };

  Cmd.add(['INSERTARBLOQUE'], { group: 'block', icon: 'insert', title: 'Insertar bloque' }, async function (ctx, args) {
    var name = args && args[0];
    var doc = ctx.doc;
    var blk = doc.blocks[name];
    if (!blk) { ctx.err('Bloque "' + name + '" no encontrado.'); return; }
    var sx = ctx.app.lastInsScale || 1, rot = 0;
    while (true) {
      var p = await ctx.getPoint('Precise punto de inserción de "' + name + '" o', {
        keywords: ['Escala', 'Girar'],
        preview: function (c) {
          var i = E.insert(name, c, { layer: doc.vars.CLAYER });
          i.sx = sx; i.sy = sx; i.rot = rot;
          return [i];
        }
      });
      if (p === null) return;
      if (isKw(p)) {
        if (p.kw === 'E') {
          var v = await ctx.getReal('Precise factor de escala', { def: sx });
          if (typeof v === 'number' && v !== 0) { sx = v; ctx.app.lastInsScale = v; }
        } else {
          var a = await ctx.getAngle('Precise ángulo de rotación', { def: 0 });
          if (typeof a === 'number') rot = a;
        }
        continue;
      }
      doc.mark('INSERT');
      var ins = E.insert(name, p, { layer: doc.vars.CLAYER });
      ins.sx = sx; ins.sy = sx; ins.rot = rot;
      await CAD.attachAttribs(ctx, ins, blk);
      doc.add(ins);
      ctx.app.refresh();
      return;
    }
  });

  Cmd.add(['PALETABLOQUES', 'TOOLPALETTES', 'TP'], { group: 'block', icon: 'block', title: 'Paleta de bloques' }, async function (ctx) {
    ctx.app.ui.togglePalette('blocks', true);
  });

  Cmd.add(['PLANTILLA', 'TEMPLATE'], { group: 'file', icon: 'new', title: 'Nuevo desde plantilla' }, async function (ctx) {
    var id = await ctx.app.ui.templateDialog();
    if (!id) return;
    ctx.app.newDrawing(id);
  });

  Cmd.add(['EXPORTAPDF', 'EXPORTPDF'], { group: 'file', icon: 'plot', title: 'Exportar a PDF' }, async function (ctx) {
    await ctx.app.ui.plotDialog();
  });

  Cmd.add(['CERRAR', 'CLOSE', 'SALIR', 'QUIT', 'EXIT'], { group: 'file', title: 'Cerrar dibujo' }, async function (ctx) {
    var ok = await ctx.app.ui.confirmDialog('¿Desea cerrar el dibujo actual? Los cambios no guardados se perderán.');
    if (!ok) return;
    ctx.app.newDrawing();
  });
})();
